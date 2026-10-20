import type { RealtimeChannel, SupabaseClient } from '@supabase/supabase-js';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  MediaStream,
  RTCPeerConnection,
  RTCSessionDescription,
  type MediaStreamTrack,
} from 'react-native-webrtc';

import { apiFetch } from '@/lib/api';
import { WATCH_PARTY_LOCKED_MESSAGE } from '@/lib/feature-flags';
import type { NativeMoonlightClient } from '@/lib/moonlight-native';
import { realtimeChannels } from '@/lib/realtime-channels';
import { createClient } from '@/lib/supabase';

type Description = { type: string | null; sdp: string };
type Candidate = { candidate: string; sdpMid?: string | null; sdpMLineIndex?: number | null };
type PointerInput = {
  action: 'move' | 'down' | 'up' | 'wheel';
  x: number;
  y: number;
  button?: number;
  deltaX?: number;
  deltaY?: number;
};
type WatchSignal = {
  kind:
    | 'host-ready' | 'join' | 'offer' | 'answer' | 'viewer-offer' | 'ice' | 'leave'
    | 'room-closed' | 'host-error' | 'control-request' | 'control-release'
    | 'control-response' | 'control-input' | 'control-cursor' | 'control-cursor-remove' | 'reaction';
  from: string;
  to?: string;
  name?: string;
  description?: Description;
  candidate?: Candidate;
  message?: string;
  approved?: boolean;
  pointer?: PointerInput;
};
type Viewer = { id: string; name: string };
type PeerState = {
  peer: RTCPeerConnection;
  pendingCandidates: Candidate[];
  startedAt: number;
};
type IceServer = { urls?: string | string[]; username?: string; credential?: string };

const ROOM_HEARTBEAT_MS = 10_000;
const HOST_ANNOUNCE_MS = 8_000;
const HANDSHAKE_STALE_MS = 12_000;

function sendSignal(channel: RealtimeChannel | null, signal: WatchSignal): void {
  if (!channel) return;
  void channel.send({ type: 'broadcast', event: 'signal', payload: signal });
}

function viewersFromPresence(channel: RealtimeChannel): Viewer[] {
  const state = channel.presenceState() as unknown as Record<string, {
    role?: string;
    userId?: string;
    name?: string;
  }[]>;
  const viewers = new Map<string, Viewer>();
  Object.values(state).flat().forEach((presence) => {
    if (presence.role !== 'viewer' || !presence.userId) return;
    viewers.set(presence.userId, { id: presence.userId, name: presence.name || 'Người xem' });
  });
  return [...viewers.values()];
}

function hasRelay(server: IceServer): boolean {
  const urls = Array.isArray(server.urls) ? server.urls : server.urls ? [server.urls] : [];
  return urls.some((url) => /^turns?:/i.test(url));
}

async function loadIce(): Promise<{ iceServers: IceServer[]; relayAvailable: boolean }> {
  const fallback = {
    iceServers: [{ urls: ['stun:stun.l.google.com:19302'] }],
    relayAvailable: false,
  };
  try {
    const response = await apiFetch('/api/watch/ice', { cache: 'no-store' });
    const data = await response.json().catch(() => null) as {
      iceServers?: IceServer[];
      relayAvailable?: boolean;
    } | null;
    if (!response.ok || !Array.isArray(data?.iceServers)) return fallback;
    return {
      iceServers: data.iceServers,
      relayAvailable: data.relayAvailable ?? data.iceServers.some(hasRelay),
    };
  } catch {
    return fallback;
  }
}

function watchSignalFor(signal: WatchSignal, userId: string): boolean {
  return !signal.to || signal.to === userId;
}

function stale(state: PeerState): boolean {
  const connection = state.peer.connectionState;
  if (connection === 'failed' || connection === 'closed') return true;
  if (connection === 'connected') return false;
  return Date.now() - state.startedAt > HANDSHAKE_STALE_MS;
}

function streamForWatch(client: NativeMoonlightClient): MediaStream {
  const source = client.getRemoteStream();
  const tracks = source?.getTracks().filter((track) => track.readyState === 'live') ?? [];
  if (!tracks.some((track) => track.kind === 'video')) {
    throw new Error('Luồng hình chưa sẵn sàng để bật streaming.');
  }
  // Không sở hữu các track này. Chúng vẫn thuộc phiên Moonlight và tuyệt đối không được stop.
  return new MediaStream(tracks as MediaStreamTrack[]);
}

export type WatchPartyState = {
  live: boolean;
  busy: boolean;
  viewers: Viewer[];
  message: string | null;
  relayAvailable: boolean | null;
  start: () => Promise<void>;
  stop: () => void;
};

export function useWatchPartyHost({
  sessionId,
  client,
  userId,
  name,
}: {
  sessionId: string | null;
  client: NativeMoonlightClient | null;
  userId: string;
  name: string;
}): WatchPartyState {
  const [room, setRoom] = useState<{ sessionId: string; client: NativeMoonlightClient; supabase: SupabaseClient } | null>(null);
  const live = Boolean(room && room.sessionId === sessionId && room.client === client);
  if (room && !live) setRoom(null);
  const [busy, setBusy] = useState(false);
  const [viewers, setViewers] = useState<Viewer[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [relayAvailable, setRelayAvailable] = useState<boolean | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const peersRef = useRef(new Map<string, PeerState>());
  const creationsRef = useRef(new Map<string, Promise<PeerState>>());

  const closePeer = useCallback((viewerId: string) => {
    const state = peersRef.current.get(viewerId);
    if (!state) return;
    state.peer.onicecandidate = null;
    state.peer.onconnectionstatechange = null;
    state.peer.close();
    peersRef.current.delete(viewerId);
  }, []);

  const start = useCallback(async () => {
    if (busy || live) return;
    if (!sessionId || !client) {
      setMessage('Phiên streaming chưa sẵn sàng.');
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      streamForWatch(client);
      const supabase = createClient();
      if (!supabase) throw new Error('Chưa kết nối được dịch vụ phòng xem.');
      const { error } = await supabase.rpc('open_watch_room', {
        p_session_id: sessionId,
        p_voice_enabled: false,
      });
      if (error) throw error;
      setRoom({ sessionId, client, supabase });
      setMessage('Đã bật streaming cho người xem.');
    } catch (error) {
      const reason = (error as Error).message;
      setMessage(reason?.includes('watch_party_disabled')
        ? WATCH_PARTY_LOCKED_MESSAGE
        : reason || 'Chưa bật được streaming.');
    } finally {
      setBusy(false);
    }
  }, [busy, client, live, sessionId]);

  const stop = useCallback(() => {
    if (!live) return;
    setRoom(null);
    setMessage('Đã dừng streaming cho người xem.');
  }, [live]);

  useEffect(() => {
    if (!live || !sessionId || !client || !room) return;
    const supabase = room.supabase;
    let disposed = false;
    let announceTimer: ReturnType<typeof setTimeout> | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

    const closeAllPeers = () => {
      [...peersRef.current.keys()].forEach(closePeer);
      creationsRef.current.clear();
    };

    const flushCandidates = async (state: PeerState) => {
      for (const candidate of state.pendingCandidates.splice(0)) {
        await state.peer.addIceCandidate(candidate).catch(() => {});
      }
    };

    const negotiate = async (viewerId: string) => {
      const state = peersRef.current.get(viewerId);
      if (!state || state.peer.signalingState !== 'stable') return;
      const offer = await state.peer.createOffer();
      await state.peer.setLocalDescription(offer);
      const local = state.peer.localDescription?.toJSON() ?? offer;
      sendSignal(channelRef.current, {
        kind: 'offer', from: userId, to: viewerId, description: local,
      });
    };

    const createPeer = (viewerId: string): Promise<PeerState> => {
      const pending = creationsRef.current.get(viewerId);
      if (pending) return pending;
      const creation = (async () => {
        closePeer(viewerId);
        const stream = streamForWatch(client);
        const ice = await loadIce();
        if (disposed) throw new Error('Phòng xem đã đóng.');
        setRelayAvailable(ice.relayAvailable);
        const peer = new RTCPeerConnection({
          bundlePolicy: 'max-bundle',
          rtcpMuxPolicy: 'require',
          iceCandidatePoolSize: 2,
          iceServers: ice.iceServers,
        });
        const state: PeerState = { peer, pendingCandidates: [], startedAt: Date.now() };
        peersRef.current.set(viewerId, state);
        stream.getTracks().forEach((track) => peer.addTrack(track, stream));
        peer.onicecandidate = (event: unknown) => {
          const candidate = (event as { candidate?: { toJSON: () => Candidate } | null }).candidate?.toJSON();
          if (!candidate) return;
          sendSignal(channelRef.current, {
            kind: 'ice', from: userId, to: viewerId, candidate,
          });
        };
        peer.onconnectionstatechange = () => {
          if (peer.connectionState === 'failed') {
            setMessage(ice.relayAvailable
              ? 'Một người xem vừa mất kết nối. Họ có thể thử vào lại.'
              : 'Không nối được tới người xem vì TURN chưa sẵn sàng.');
            closePeer(viewerId);
          } else if (peer.connectionState === 'closed') {
            closePeer(viewerId);
          }
        };
        return state;
      })();
      creationsRef.current.set(viewerId, creation);
      void creation.finally(() => {
        if (creationsRef.current.get(viewerId) === creation) creationsRef.current.delete(viewerId);
      }).catch(() => {});
      return creation;
    };

    const channel = supabase
      // Broadcast/presence must use the exact shared topic; an instance suffix would
      // isolate this native host from viewers on the web client.
      .channel(realtimeChannels.watchParty(sessionId), {
        config: { broadcast: { self: false }, presence: { key: userId } },
      })
      .on('presence', { event: 'sync' }, () => {
        if (!disposed) setViewers(viewersFromPresence(channel));
      })
      .on('broadcast', { event: 'signal' }, async ({ payload }) => {
        const signal = payload as WatchSignal;
        if (disposed || signal.from === userId || !watchSignalFor(signal, userId)) return;
        try {
          if (signal.kind === 'join') {
            if (creationsRef.current.has(signal.from)) return;
            const existing = peersRef.current.get(signal.from);
            if (existing && !stale(existing)) return;
            const state = await createPeer(signal.from);
            await negotiate(signal.from);
            await flushCandidates(state);
          } else if (signal.kind === 'answer' && signal.description) {
            const state = peersRef.current.get(signal.from);
            if (!state || state.peer.signalingState !== 'have-local-offer') return;
            await state.peer.setRemoteDescription(new RTCSessionDescription(signal.description));
            await flushCandidates(state);
          } else if (signal.kind === 'viewer-offer' && signal.description) {
            const state = peersRef.current.get(signal.from) ?? await createPeer(signal.from);
            if (state.peer.signalingState !== 'stable') return;
            await state.peer.setRemoteDescription(new RTCSessionDescription(signal.description));
            await flushCandidates(state);
            const answer = await state.peer.createAnswer();
            await state.peer.setLocalDescription(answer);
            const local = state.peer.localDescription?.toJSON() ?? answer;
            sendSignal(channelRef.current, {
              kind: 'answer', from: userId, to: signal.from, description: local,
            });
          } else if (signal.kind === 'ice' && signal.candidate) {
            const state = peersRef.current.get(signal.from);
            if (!state) return;
            if (state.peer.remoteDescription) await state.peer.addIceCandidate(signal.candidate).catch(() => {});
            else state.pendingCandidates.push(signal.candidate);
          } else if (signal.kind === 'leave') {
            closePeer(signal.from);
          } else if (signal.kind === 'control-request') {
            sendSignal(channelRef.current, {
              kind: 'control-response', from: userId, to: signal.from, approved: false, name,
            });
            setMessage('Co-control chưa được bật trên thiết bị này.');
          } else if (signal.kind === 'reaction') {
            setMessage(`${signal.name || 'Một người xem'} vừa gửi cảm xúc.`);
          }
        } catch (error) {
          closePeer(signal.from);
          const failure = (error as Error).message || 'Một người xem chưa kết nối được.';
          setMessage(failure);
          sendSignal(channelRef.current, {
            kind: 'host-error', from: userId, to: signal.from, message: failure,
          });
        }
      });
    channelRef.current = channel;
    channel.subscribe(async (status) => {
      if (disposed) return;
      if (status === 'SUBSCRIBED') {
        await channel.track({ role: 'host', userId, name, checkedAt: Date.now() });
        sendSignal(channel, { kind: 'host-ready', from: userId, name });
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setMessage('Kênh phòng xem vừa mất kết nối.');
      }
    });

    const announce = async () => {
      if (disposed) return;
      if (channel.state === 'joined') {
        await channel.track({ role: 'host', userId, name, checkedAt: Date.now() });
        sendSignal(channel, { kind: 'host-ready', from: userId, name });
      }
      announceTimer = setTimeout(() => void announce(), HOST_ANNOUNCE_MS);
    };
    announceTimer = setTimeout(() => void announce(), HOST_ANNOUNCE_MS);

    const heartbeat = async () => {
      const { data, error } = await supabase.rpc('heartbeat_watch_room', { p_session_id: sessionId });
      if (disposed || error || data === true) return;
      await supabase.rpc('open_watch_room', { p_session_id: sessionId, p_voice_enabled: false });
    };
    void heartbeat();
    heartbeatTimer = setInterval(() => void heartbeat(), ROOM_HEARTBEAT_MS);

    return () => {
      disposed = true;
      if (announceTimer) clearTimeout(announceTimer);
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      sendSignal(channel, { kind: 'room-closed', from: userId });
      if (channelRef.current === channel) channelRef.current = null;
      void supabase.removeChannel(channel);
      closeAllPeers();
      setViewers([]);
      setRelayAvailable(null);
      void supabase.rpc('close_watch_room', { p_session_id: sessionId });
    };
  }, [client, closePeer, live, name, room, sessionId, userId]);

  return { live, busy, viewers, message, relayAvailable, start, stop };
}
