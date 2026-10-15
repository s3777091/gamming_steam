// Theo dõi lượt tải game Steam trên PC bằng đường nối THẲNG điện thoại <-> PC.
//
// Agent tải game (deploy/pc/steam-downloads) chỉ chạy khi có game đang tải. Nó
// báo có mặt bằng presence trên STEAM_DOWNLOADS_PRESENCE; thấy nó là app mở một
// RTCPeerConnection với DataChannel, gom đủ ICE rồi ghi SDP offer vào
// public.pc_download_links (RLS gắn user_id = người đang đăng nhập). Agent trả SDP
// answer vào chính hàng đó, app nghe UPDATE bằng Realtime. Từ đó mọi cập nhật
// (phần trăm, tốc độ, ETA, điều khoản cần đồng ý) đi trên DataChannel, không qua
// VM hay Supabase, và không có hỏi thăm định kỳ.

import type { RealtimeChannel } from '@supabase/supabase-js';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { RTCPeerConnection, RTCSessionDescription } from 'react-native-webrtc';

import { PC_ROUTES, pcFetchJson, pcPostJson } from '@/lib/pc-api';
import { startAsyncPoll } from '@/lib/async-poll';
import { realtimeChannelInstance } from '@/lib/realtime-channels';
import {
  type AppCommand,
  type DownloadsState,
  STEAM_DOWNLOADS_CHANNEL,
  STEAM_DOWNLOADS_PRESENCE,
  parseAgentMessage,
  hasPendingDownloads,
  reuseDownloadSnapshot,
} from '@/lib/steam-downloads';
import { createClient } from '@/lib/supabase';

type DataChannel = ReturnType<RTCPeerConnection['createDataChannel']>;
type Link = { peer: RTCPeerConnection; channel: DataChannel };

// Cùng STUN với moonlight-web và agent: máy ở nhà chỉ đi đường direct.
const ICE_SERVERS = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:3478'] }];
const GATHER_TIMEOUT_MS = 3_000;
const ANSWER_TIMEOUT_MS = 15_000;
const OPEN_TIMEOUT_MS = 15_000;
const RETRY_DELAY_MS = 2_500;
const MAX_FAILURES = 3;

function waitGathering(peer: RTCPeerConnection): Promise<void> {
  if (peer.iceGatheringState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      peer.onicegatheringstatechange = null;
      resolve();
    };
    // Gom đủ host + srflx chỉ mất vài trăm ms; mạng lạ thì gửi những gì đã có.
    const timer = setTimeout(finish, GATHER_TIMEOUT_MS);
    peer.onicegatheringstatechange = () => { if (peer.iceGatheringState === 'complete') finish(); };
  });
}

type LinksRow = { id?: string; answer?: string | null; error?: string | null };

/** Ghi offer, chờ agent trả answer trên chính hàng đó. */
async function exchangeOffer(userId: string, offer: string): Promise<string> {
  const supabase = createClient();
  if (!supabase) throw new Error('Chưa kết nối được dịch vụ.');
  let channel: RealtimeChannel | null = null;
  try {
    return await new Promise<string>((resolve, reject) => {
      let rowId: string | null = null;
      const early = new Map<string, LinksRow>();
      const timer = setTimeout(() => reject(new Error('Máy tính chưa trả lời kết nối.')), ANSWER_TIMEOUT_MS);
      const settle = (row: LinksRow) => {
        if (row.error) { clearTimeout(timer); reject(new Error(row.error)); }
        else if (row.answer) { clearTimeout(timer); resolve(row.answer); }
      };
      channel = supabase
        .channel(realtimeChannelInstance('jetsona:steam-downloads:link'))
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'pc_download_links', filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as LinksRow;
            if (!row?.id) return;
            if (rowId === row.id) settle(row);
            else if (!rowId) early.set(row.id, row);
          },
        )
        // Nghe TRƯỚC rồi mới ghi offer, để answer nhanh tới đâu cũng không lỡ.
        .subscribe(async (status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            clearTimeout(timer);
            reject(new Error('Kênh kết nối tới máy tính vừa rớt.'));
            return;
          }
          if (status !== 'SUBSCRIBED' || rowId) return;
          const { data, error } = await supabase
            .from('pc_download_links')
            .insert({ offer })
            .select('id')
            .single();
          if (error || !data?.id) {
            clearTimeout(timer);
            reject(new Error('Chưa gửi được yêu cầu kết nối tới máy tính.'));
            return;
          }
          rowId = data.id as string;
          const arrived = early.get(rowId);
          if (arrived) settle(arrived);
        });
    });
  } finally {
    if (channel) void supabase.removeChannel(channel);
  }
}

async function openLink(userId: string): Promise<Link> {
  const peer = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  try {
    const channel = peer.createDataChannel(STEAM_DOWNLOADS_CHANNEL, { ordered: true });
    const offer = await peer.createOffer({});
    await peer.setLocalDescription(offer);
    await waitGathering(peer);
    const sdp = peer.localDescription?.sdp;
    if (!sdp) throw new Error('Không tạo được yêu cầu kết nối.');

    const answer = await exchangeOffer(userId, sdp);
    await peer.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: answer }));
    if (channel.readyState !== 'open') {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Không nối thẳng được tới máy tính.')), OPEN_TIMEOUT_MS);
        channel.onopen = () => { clearTimeout(timer); resolve(); };
        channel.onclose = () => { clearTimeout(timer); reject(new Error('Máy tính vừa đóng kết nối.')); };
      });
    }
    return { peer, channel };
  } catch (error) {
    peer.close();
    throw error;
  }
}

export type ConfigAnswer =
  | { accept: true; folder: number; desktopShortcut: boolean; startMenuShortcut: boolean }
  | { accept: false };

export type SteamDownloads = {
  /** Trạng thái cuối cùng agent gửi (giữ lại sau khi agent thoát). */
  state: DownloadsState | null;
  agentOnline: boolean;
  connected: boolean;
  /** Chỉ người bấm Tải mới đồng ý điều khoản / tạm dừng được. */
  canControl: boolean;
  notice: string | null;
  /** Gọi ngay sau khi PC nhận lệnh cài: hiện "đang chuẩn bị" trong lúc agent khởi động. */
  expect: (appid: number) => void;
  expectedAppId: number | null;
  /** Gọi sau khi PC nhận lệnh gỡ để hiện trạng thái trong lúc agent khởi động. */
  expectUninstall: (appid: number) => void;
  expectedUninstallAppId: number | null;
  answerEula: (appid: number, accept: boolean) => void;
  /** Trả lời hộp thoại Install: ổ đĩa + lối tắt; accept=false là huỷ cài đặt. */
  answerConfig: (appid: number, answer: ConfigAnswer) => void;
  pause: (appid: number) => void;
  resume: (appid: number) => void;
};

export function useSteamDownloads(
  userId: string,
  onInstalled?: (appid: number) => void,
  onUninstalled?: (appid: number, name?: string | null) => void,
): SteamDownloads {
  const [state, setState] = useState<DownloadsState | null>(null);
  const [agentOnline, setAgentOnline] = useState(false);
  const [connected, setConnected] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [expectedAppId, setExpectedAppId] = useState<number | null>(null);
  const [expectedUninstallAppId, setExpectedUninstallAppId] = useState<number | null>(null);
  const [reconnectNonce, setReconnectNonce] = useState(0);
  const [foreground, setForeground] = useState(() => AppState.currentState !== 'background' && AppState.currentState !== 'inactive');
  const pollingDelay = useRef(8_000);
  useLayoutEffect(() => {
    pollingDelay.current = expectedAppId || expectedUninstallAppId || hasPendingDownloads(state) ? 2_500 : 8_000;
  }, [expectedAppId, expectedUninstallAppId, state]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', (next) => setForeground(next === 'active'));
    return () => listener.remove();
  }, []);
  const linkRef = useRef<Link | null>(null);
  const installedRef = useRef(new Set<number>());
  const uninstalledRef = useRef(new Set<number>());
  const farewellRef = useRef(false);
  const onInstalledRef = useRef(onInstalled);
  useEffect(() => { onInstalledRef.current = onInstalled; }, [onInstalled]);
  const onUninstalledRef = useRef(onUninstalled);
  useEffect(() => { onUninstalledRef.current = onUninstalled; }, [onUninstalled]);

  const send = useCallback((command: AppCommand) => {
    const channel = linkRef.current?.channel;
    if (channel?.readyState === 'open') {
      channel.send(JSON.stringify(command));
      return;
    }
    if (command.type === 'pause' || command.type === 'resume') {
      void pcPostJson(PC_ROUTES.gameDownloads, { action: command.type, appid: command.appid }, 'Không thực hiện được thao tác.')
        .catch(() => setNotice('Chưa nối được tới máy tính.'));
      return;
    }
    setNotice('Chưa nối được tới máy tính.');
  }, []);

  const applyState = useCallback((next: DownloadsState) => {
    setState((previous) => reuseDownloadSnapshot(previous, next));
    for (const flow of next.installs) {
      if (flow.phase !== 'installed' || installedRef.current.has(flow.appid)) continue;
      installedRef.current.add(flow.appid);
      onInstalledRef.current?.(flow.appid);
    }
    for (const flow of next.uninstalls ?? []) {
      if (flow.phase !== 'uninstalled' || uninstalledRef.current.has(flow.appid)) continue;
      uninstalledRef.current.add(flow.appid);
      onUninstalledRef.current?.(flow.appid, flow.name);
    }
    setExpectedAppId((current) => (
      current && next.installs.some((flow) => flow.appid === current) ? null : current
    ));
    setExpectedUninstallAppId((current) => (
      current && next.uninstalls?.some((flow) => flow.appid === current) ? null : current
    ));
  }, []);

  // Presence: biết agent đang chạy mà không phải hỏi PC.
  useEffect(() => {
    const supabase = createClient();
    if (!supabase) return;
    const channel = supabase.channel(STEAM_DOWNLOADS_PRESENCE);
    const sync = () => {
      const entries = Object.values(channel.presenceState() as Record<string, { role?: string }[]>).flat();
      setAgentOnline(entries.some((entry) => entry.role === 'agent'));
    };
    channel
      .on('presence', { event: 'sync' }, sync)
      .on('presence', { event: 'join' }, sync)
      .on('presence', { event: 'leave' }, sync)
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  // HTTP polling fallback khi WebRTC DataChannel chưa mở hoặc bị rớt
  useEffect(() => {
    if (connected || !foreground) return;
    return startAsyncPoll(async (signal) => {
      const resp = await pcFetchJson<{ ok?: boolean; state?: DownloadsState | null }>(
        PC_ROUTES.gameDownloads,
        'Không đọc được tiến trình tải',
        undefined,
        signal,
      );
      if (!signal.aborted && resp.ok && resp.state) applyState(resp.state);
    }, () => pollingDelay.current);
  }, [connected, foreground, expectedAppId, expectedUninstallAppId, applyState]);

  // Nối thẳng tới agent khi nó có mặt; rớt thì nối lại vài lần.
  useEffect(() => {
    if (!agentOnline) {
      // Agent rời đi mà không chào (bị tắt ngang): số liệu cũ không còn đúng.
      if (!farewellRef.current) setState(null);
      return;
    }
    farewellRef.current = false;
    let disposed = false;
    let failures = 0;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    const drop = (link: Link) => {
      if (linkRef.current !== link) return;
      linkRef.current = null;
      setConnected(false);
      link.peer.close();
    };

    const connect = async () => {
      if (disposed || linkRef.current) return;
      let link: Link;
      try {
        link = await openLink(userId);
      } catch (error) {
        if (disposed) return;
        failures += 1;
        if (failures >= MAX_FAILURES) {
          setNotice((error as Error).message || 'Không nối được tới máy tính.');
        } else {
          retryTimer = setTimeout(() => void connect(), RETRY_DELAY_MS * failures);
        }
        return;
      }
      if (disposed) { link.peer.close(); return; }
      failures = 0;
      linkRef.current = link;
      setConnected(true);
      setNotice(null);
      let leaving = false;

      link.channel.onmessage = (event: unknown) => {
        const message = parseAgentMessage((event as { data?: unknown }).data);
        if (!message) return;
        if (message.type === 'state') applyState(message);
        else if (message.type === 'notice') setNotice(message.message);
        else if (message.type === 'bye') {
          leaving = true;
          farewellRef.current = true;
          if (message.state) applyState(message.state);
        }
      };
      const lost = () => {
        drop(link);
        if (!disposed && !leaving) retryTimer = setTimeout(() => void connect(), RETRY_DELAY_MS);
      };
      link.channel.onopen = null;
      link.channel.onclose = lost;
      link.peer.onconnectionstatechange = () => {
        if (link.peer.connectionState === 'failed') lost();
      };
      link.channel.send(JSON.stringify({ type: 'hello' } satisfies AppCommand));
    };

    void connect();
    return () => {
      disposed = true;
      if (retryTimer) clearTimeout(retryTimer);
      const link = linkRef.current;
      if (link) drop(link);
    };
  }, [agentOnline, applyState, userId, reconnectNonce]);

  // Agent không lên sau khi bấm Tải (máy chưa cài agent): thôi chờ.
  useEffect(() => {
    if (!expectedAppId) return;
    const timer = setTimeout(() => setExpectedAppId(null), 90_000);
    return () => clearTimeout(timer);
  }, [expectedAppId]);

  useEffect(() => {
    if (!expectedUninstallAppId) return;
    const timer = setTimeout(() => setExpectedUninstallAppId(null), 90_000);
    return () => clearTimeout(timer);
  }, [expectedUninstallAppId]);

  const expect = useCallback((appid: number) => {
    installedRef.current.delete(appid);
    setNotice(null);
    setExpectedAppId(appid);
    setReconnectNonce((n) => n + 1);
  }, []);

  const expectUninstall = useCallback((appid: number) => {
    uninstalledRef.current.delete(appid);
    setNotice(null);
    setExpectedUninstallAppId(appid);
    setReconnectNonce((n) => n + 1);
  }, []);

  const actions = useMemo(() => ({
    answerEula: (appid: number, accept: boolean) => send({ type: 'eula', appid, accept }),
    answerConfig: (appid: number, answer: ConfigAnswer) => send({ type: 'config', appid, ...answer }),
    pause: (appid: number) => send({ type: 'pause', appid }),
    resume: (appid: number) => send({ type: 'resume', appid }),
  }), [send]);

  return useMemo(() => ({
    state,
    agentOnline,
    connected,
    canControl: Boolean(!state?.controllers.length || state?.controllers.includes(userId)),
    notice,
    expect,
    expectedAppId,
    expectUninstall,
    expectedUninstallAppId,
    ...actions,
  }), [state, agentOnline, connected, userId, notice, expect, expectedAppId, expectUninstall, expectedUninstallAppId, actions]);
}
