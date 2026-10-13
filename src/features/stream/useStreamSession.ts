// Mở một phiên stream tới máy tính ở nhà: xác nhận tài khoản, tìm host Moonlight,
// xin quyền dùng máy (lease), nối WebRTC trực tiếp, giữ nhịp heartbeat và trả
// phiên khi thoát. Là phần logic của jetson-phone/src/screens/RemoteScreen.tsx,
// tách khỏi giao diện để màn stream landscape dùng lại nguyên vẹn luồng nối.
//
// Hai khác biệt có chủ ý so với bản cũ:
//  - Chờ chủ phiên chấp nhận yêu cầu dùng máy bằng Realtime (không lặp 2,5 giây).
//  - Cài đặt đọc theo loại màn hình (điện thoại / lớn) như bản web mới.

import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ensureClientDeviceId } from '@/lib/client-device';
import { detectRegion } from '@/lib/detect-region';
import { displayRefreshHz } from '@/lib/display-refresh';
import { describeError } from '@/lib/friendly';
import { DEFAULT_LOADING_THEME_ID, type LoadingThemeId } from '@/lib/loading-themes';
import {
  fetchMoonlightTarget,
  NativeMoonlightClient,
} from '@/lib/moonlight-native';
import { PC_ROUTES, pcFetch } from '@/lib/pc-api';
import { realtimeChannelInstance, realtimeChannels } from '@/lib/realtime-channels';
import {
  claimLease,
  heartbeatLeaseRpc,
  postSessionBeat,
  postSessionClaim,
  postSessionRelease,
  releaseLeaseRpc,
  watchSessionReleased,
  type LeaseHandle,
} from '@/lib/session-lease';
import { createStreamSetupToken } from '@/lib/setup-token';
import { loadInputSettings, subscribeInputSettings, DEFAULT_INPUT_SETTINGS, type InputSettings } from '@/lib/input-settings';
import { detectStreamDeviceClass } from '@/lib/stream-device';
import { applyStreamHostPolicy, applyStreamTargetTransportPolicy } from '@/lib/stream-host-policy';
import { fetchDeviceNetworkMeasurement } from '@/lib/stream-network';
import { acquireStreamSetupLock } from '@/lib/stream-setup-lock';
import {
  completeSettings,
  fetchStreamSettingsDefaults,
  resolveMoonlightSettings,
  STREAM_SETTINGS_TABLE,
  type HostDisplay,
  type MoonlightSettings,
  type StreamSettings,
  type ViewerRegion,
} from '@/lib/stream-settings';
import { subscribeStreamSettings } from '@/lib/stream-settings-events';
import { createClient } from '@/lib/supabase';
import { startSpeakerRoute, stopSpeakerRoute } from 'jetsona-input';

export type StreamPhase = 'connecting' | 'waiting' | 'live' | 'error';

type Options = {
  userId: string;
  /** Đổi giá trị này để mở lại phiên từ đầu (Kết nối lại, đổi độ phân giải). */
  attempt: number;
  /** Phiên bị đóng từ bên ngoài (app xuống nền): màn gọi sẽ thoát. */
  onBackground: () => void;
  onSessionChanged?: () => void;
};

const RESOURCE_KEY = 'home-pc';
const TARGET_ID = 'pc' as const;
const ACCESS_WAIT_MS = 90_000;

function friendlyConnectError(error: unknown): string {
  const message = describeError(error);
  if (message.includes('target_in_use')) return 'Thiết bị đang có người sử dụng.';
  if (message.includes('rate_limit')) return 'Bạn đã gửi yêu cầu quá nhanh. Hãy đợi một chút rồi thử lại.';
  if (/network request failed|failed to fetch/i.test(message)) return 'Không kết nối được tới máy chủ.';
  return message || 'Không mở được phiên điều khiển.';
}

async function fetchHostDisplay(): Promise<HostDisplay | null> {
  try {
    const response = await pcFetch(PC_ROUTES.display, { cache: 'no-store' });
    if (!response.ok) return null;
    const data = (await response.json()) as {
      ok?: boolean; width?: unknown; height?: unknown; canSwitchResolution?: unknown; modes?: unknown;
      captureTargetStale?: unknown; displays?: unknown;
    };
    const width = Number(data.width);
    const height = Number(data.height);
    if (!data.ok || width < 640 || height < 480) return null;
    const modes = Array.isArray(data.modes)
      ? data.modes
        .map((mode) => ({ width: Number((mode as { width?: unknown }).width), height: Number((mode as { height?: unknown }).height) }))
        .filter((mode) => Number.isFinite(mode.width) && Number.isFinite(mode.height))
      : undefined;
    return {
      width: Math.round(width),
      height: Math.round(height),
      canSwitchResolution: Boolean(data.canSwitchResolution),
      modes,
      ...(data.captureTargetStale !== undefined ? { captureTargetStale: Boolean(data.captureTargetStale) } : {}),
      ...(data.displays !== undefined ? { displays: Number(data.displays) } : {}),
    };
  } catch {
    return null;
  }
}

export function useStreamSession({ userId, attempt, onBackground, onSessionChanged }: Options) {
  const [phase, setPhase] = useState<StreamPhase>('connecting');
  const [status, setStatus] = useState('Đang chuẩn bị phiên điều khiển…');
  const [progress, setProgress] = useState(3);
  const [streamURL, setStreamURL] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState({ width: 16, height: 9 });
  const [inputReady, setInputReady] = useState(false);
  const [audioReady, setAudioReady] = useState(false);
  const [streamSettings, setStreamSettings] = useState<StreamSettings | null>(null);
  const [moonlightSettings, setMoonlightSettings] = useState<MoonlightSettings | null>(null);
  const [hostDisplay, setHostDisplay] = useState<HostDisplay | null>(null);
  const [loadingThemeId, setLoadingThemeId] = useState<LoadingThemeId>(DEFAULT_LOADING_THEME_ID);
  const [errorDetail, setErrorDetail] = useState<string | null>(null);
  // Client sống ngoài state để đường nhập liệu đọc mà không kéo theo render.
  const clientRef = useRef<NativeMoonlightClient | null>(null);
  const [client, setClient] = useState<NativeMoonlightClient | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  // Màn stream gắn xử lý rung (slot tay cầm -> thiết bị thật) sau khi dựng cầu nhập liệu.
  const rumbleRef = useRef<((rumble: { slot: number; low: number; high: number }) => void) | null>(null);
  const inputSettingsRef = useRef<InputSettings>(DEFAULT_INPUT_SETTINGS);
  const onBackgroundRef = useRef(onBackground);
  const onSessionChangedRef = useRef(onSessionChanged);
  onBackgroundRef.current = onBackground;
  onSessionChangedRef.current = onSessionChanged;

  useEffect(() => {
    let cancelled = false;
    void loadInputSettings().then((value) => { if (!cancelled) inputSettingsRef.current = value; });
    const off = subscribeInputSettings((value) => { inputSettingsRef.current = value; });
    return () => { cancelled = true; off(); };
  }, []);

  // Cài đặt stream đổi giữa phiên (HUD...) thì cập nhật bản đang giữ.
  useEffect(() => subscribeStreamSettings((next) => setStreamSettings(next)), []);

  useEffect(() => {
    const supabase = createClient();
    let disposed = false;
    let clientDeviceId = '';
    let activeHandle: (LeaseHandle & { clientDeviceId: string }) | null = null;
    let heartbeatTimer: ReturnType<typeof setInterval> | null = null;
    let heartbeatBusy = false;
    let releasing = false;
    let activeClient: NativeMoonlightClient | null = null;
    let unwatchRelease: (() => void) | null = null;
    let releaseLock: (() => void) | null = null;
    // clientId là mã tương quan phiên Sunshine (mỗi lần mở một mã); khác
    // clientDeviceId (ổn định, dùng cho lease và đo mạng).
    const clientId = `native-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const setupToken = createStreamSetupToken();
    const deviceClass = detectStreamDeviceClass();

    setPhase('connecting');
    setStatus('Đang xác nhận tài khoản…');
    setProgress(4);
    setStreamURL(null);
    setInputReady(false);
    setAudioReady(false);
    setErrorDetail(null);
    setStreamSettings(null);
    setMoonlightSettings(null);
    setHostDisplay(null);
    setSessionId(null);

    const release = async (handle: (LeaseHandle & { clientDeviceId: string }) | null, reason: string) => {
      if (!handle || releasing) return;
      if (activeHandle !== handle) return; // generation guard: không bao giờ trả phiên kế cận
      releasing = true;
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      activeHandle = null;
      setSessionId(null);
      unwatchRelease?.();
      unwatchRelease = null;
      await Promise.allSettled([
        postSessionRelease({
          clientId, targetId: TARGET_ID, cloudSessionId: handle.sessionId, setupToken: handle.setupToken,
          setupGeneration: handle.generation, clientDeviceId: handle.clientDeviceId, reason,
        }),
        supabase ? releaseLeaseRpc(supabase, handle, reason) : Promise.resolve(),
      ]);
      onSessionChangedRef.current?.();
    };

    const fail = (message: string, detail?: string) => {
      if (disposed) return;
      activeClient?.stop();
      stopSpeakerRoute();
      activeClient = null;
      clientRef.current = null;
      setClient(null);
      setStreamURL(null);
      setStatus(friendlyConnectError(message));
      setErrorDetail(detail ?? (message && message !== friendlyConnectError(message) ? message : null));
      setProgress((value) => Math.max(6, value - 22));
      setPhase('error');
      void release(activeHandle, 'connection_error');
    };

    /** Chờ chủ phiên hiện tại đồng ý nhường máy — bằng sự kiện Realtime. */
    const waitForAccess = (requestId: string): Promise<void> => new Promise((resolve, reject) => {
      if (!supabase) { reject(new Error('Supabase chưa được cấu hình.')); return; }
      setPhase('waiting');
      setStatus('Đã gửi yêu cầu · đang chờ người dùng hiện tại chấp nhận…');
      setProgress((value) => Math.max(value, 18));
      let settled = false;
      const settle = (result: 'approved' | 'denied' | 'expired' | undefined) => {
        if (settled || !result) return;
        settled = true;
        clearTimeout(deadline);
        void supabase.removeChannel(channel);
        if (result === 'approved') {
          setPhase('connecting');
          setStatus('Đã được chấp nhận · đang chuyển phiên…');
          setProgress((value) => Math.max(value, 30));
          resolve();
        } else if (result === 'denied') reject(new Error('Người dùng hiện tại đã từ chối yêu cầu.'));
        else reject(new Error('Yêu cầu nhường phiên đã hết hạn.'));
      };
      const deadline = setTimeout(() => settle('expired'), ACCESS_WAIT_MS);
      const channel = supabase
        .channel(realtimeChannelInstance(realtimeChannels.accessRequesterResult(requestId)))
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'access_requests', filter: `id=eq.${requestId}` },
          (payload) => settle((payload.new as { status?: 'approved' | 'denied' | 'expired' }).status),
        )
        .subscribe((state) => {
          if (state !== 'SUBSCRIBED' || settled) return;
          // Một lần đọc ngay sau khi kênh mở để không lỡ quyết định đến trước.
          void supabase.from('access_requests').select('status').eq('id', requestId).maybeSingle()
            .then(({ data }) => settle((data as { status?: 'approved' | 'denied' | 'expired' } | null)?.status));
        });
    });

    const claimLeaseSession = async (): Promise<LeaseHandle> => {
      if (!supabase) throw new Error('Supabase chưa được cấu hình.');
      while (!disposed) {
        try {
          return await claimLease(supabase, TARGET_ID, clientDeviceId, setupToken);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          if (!message.includes('target_in_use')) throw error;
        }
        // Máy đang bận: xin nhường phiên rồi claim lại.
        const request = await supabase.rpc('request_stream_access', {
          p_target_id: TARGET_ID,
          p_client_device_id: clientDeviceId,
        });
        if (request.error?.message.includes('target_available')) continue;
        if (request.error) throw request.error;
        await waitForAccess(String(request.data.id));
      }
      throw new Error('Phiên đã đóng.');
    };

    const heartbeat = async () => {
      if (disposed || heartbeatBusy || !activeHandle || !supabase) return;
      heartbeatBusy = true;
      try {
        const [serviceStatus, cloudAlive] = await Promise.all([
          postSessionBeat({
            clientId, targetId: TARGET_ID, cloudSessionId: activeHandle.sessionId, setupToken: activeHandle.setupToken,
            setupGeneration: activeHandle.generation, clientDeviceId: activeHandle.clientDeviceId,
          }),
          heartbeatLeaseRpc(supabase, activeHandle),
        ]);
        if (serviceStatus === 410 || cloudAlive === false) fail('Phiên đã được mở trên một thiết bị khác.');
      } catch {
        // Một nhịp lỗi mạng chưa đủ để kết luận phiên đã chết; service có thời gian ân hạn.
      } finally {
        heartbeatBusy = false;
      }
    };

    void (async () => {
      try {
        if (!supabase) throw new Error('Supabase chưa được cấu hình.');
        const { data: auth } = await supabase.auth.getSession();
        const token = auth.session?.access_token;
        if (!token) throw new Error('Phiên đăng nhập đã hết hạn.');

        clientDeviceId = await ensureClientDeviceId(supabase);
        releaseLock = await acquireStreamSetupLock(RESOURCE_KEY);
        if (disposed) return;

        setStatus('Đang tìm host và ứng dụng streaming…');
        setProgress(9);
        const [target, defaults, storedResult, inputSettings, display, refreshHz] = await Promise.all([
          fetchMoonlightTarget(TARGET_ID),
          fetchStreamSettingsDefaults(supabase, deviceClass),
          supabase.from(STREAM_SETTINGS_TABLE[deviceClass]).select('*').eq('user_id', userId).maybeSingle(),
          loadInputSettings(),
          fetchHostDisplay(),
          displayRefreshHz(),
        ]);
        if (disposed) return;
        if (storedResult.error) throw storedResult.error;

        inputSettingsRef.current = inputSettings;
        const stored = (storedResult.data as Partial<StreamSettings> | null) ?? null;
        const currentRegion: ViewerRegion = (stored?.region ?? 'vn') as ViewerRegion;
        const region = await detectRegion(currentRegion);
        const settings = completeSettings(userId, { ...stored, region }, defaults);
        setLoadingThemeId(settings.loading_theme);
        setStreamSettings(settings);
        setHostDisplay(display);

        const policyHost = applyStreamHostPolicy(display, TARGET_ID);
        const measurement = await fetchDeviceNetworkMeasurement(supabase, userId, clientDeviceId);
        if (disposed) return;
        const resolved = applyStreamTargetTransportPolicy(
          resolveMoonlightSettings(settings, measurement, policyHost, refreshHz, undefined, deviceClass),
          TARGET_ID,
        ) as MoonlightSettings;
        setMoonlightSettings(resolved);
        setVideoSize({ width: resolved.videoSizeCustom.width, height: resolved.videoSizeCustom.height });

        setStatus('Đang đăng ký quyền sử dụng thiết bị…');
        setProgress(24);
        const handle = await claimLeaseSession();
        if (disposed) return;
        activeHandle = { ...handle, clientDeviceId };
        setSessionId(activeHandle.sessionId);
        onSessionChangedRef.current?.();

        // Revalidate lease trước khi Moonlight: có thể đã bị thiết bị khác cướp.
        const alive = await heartbeatLeaseRpc(supabase, activeHandle);
        if (!alive) throw new Error('Phiên vừa được mở trên một thiết bị khác.');

        const sessionClaim = await postSessionClaim(target, clientId, TARGET_ID, activeHandle, clientDeviceId);
        if (!sessionClaim.ok) throw new Error(sessionClaim.error || 'Không đăng ký được phiên Sunshine.');
        if (disposed) return;
        setStatus(sessionClaim.action === 'resume' ? 'Đang tiếp tục phiên trước…' : 'Đang khởi động phiên WebRTC native…');
        setProgress(46);

        unwatchRelease = watchSessionReleased(supabase, activeHandle.sessionId, () => {
          fail('Phiên đã được kết thúc bởi chủ khác.');
        });

        activeClient = new NativeMoonlightClient(
          TARGET_ID,
          target,
          token,
          resolved,
          { muted: inputSettings.audioMuted, volume: inputSettings.audioVolume },
          {
            onStatus: (message) => {
              if (disposed) return;
              setStatus(message);
              setProgress((value) => Math.min(88, Math.max(value + 5, 52)));
            },
            onStream: (url) => {
              if (disposed) return;
              setStreamURL(url);
              setStatus('Đang truyền trực tiếp');
              setProgress(100);
              setPhase('live');
            },
            onReady: (dimensions) => {
              if (disposed) return;
              if (dimensions) setVideoSize(dimensions);
              setProgress((value) => Math.max(value, 92));
              setStatus('Đã kết nối · đang chờ khung hình đầu tiên…');
            },
            onVideoDimensions: (dimensions) => { if (!disposed) setVideoSize(dimensions); },
            onInputReady: () => { if (!disposed) setInputReady(true); },
            onAudioReady: () => {
              if (disposed) return;
              startSpeakerRoute();
              setAudioReady(!inputSettings.audioMuted);
            },
            onError: (message) => fail(message),
            onRumble: (rumble) => rumbleRef.current?.(rumble),
          },
          settings.ice_mode,
        );
        clientRef.current = activeClient;
        setClient(activeClient);
        activeClient.start();
        heartbeatTimer = setInterval(() => { void heartbeat(); }, 5_000);
      } catch (error) {
        if (!disposed) {
          setStatus(friendlyConnectError(error));
          setPhase('error');
          void release(activeHandle, 'startup_error');
        }
      }
    })();

    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'background' && activeHandle && !disposed) {
        activeClient?.stop();
        activeClient = null;
        clientRef.current = null;
        setClient(null);
        if (heartbeatTimer) clearInterval(heartbeatTimer);
        heartbeatTimer = null;
        void release(activeHandle, 'app_background');
        onBackgroundRef.current();
      }
    });

    return () => {
      disposed = true;
      appState.remove();
      if (heartbeatTimer) clearInterval(heartbeatTimer);
      heartbeatTimer = null;
      activeClient?.stop();
      stopSpeakerRoute();
      activeClient = null;
      clientRef.current = null;
      setClient(null);
      void release(activeHandle, 'user_exit');
      releaseLock?.();
      releaseLock = null;
    };
  }, [attempt, userId]);

  const persistSettings = useCallback(async (patch: Partial<StreamSettings>): Promise<StreamSettings | null> => {
    const supabase = createClient();
    if (!supabase || !streamSettings) return null;
    const next = { ...streamSettings, ...patch };
    setStreamSettings(next);
    await supabase.from(STREAM_SETTINGS_TABLE[detectStreamDeviceClass()]).upsert(next, { onConflict: 'user_id' });
    return next;
  }, [streamSettings]);

  return {
    phase, status, progress, streamURL, videoSize, inputReady, audioReady, errorDetail,
    streamSettings, moonlightSettings, hostDisplay, loadingThemeId,
    client, clientRef, sessionId, inputSettingsRef, rumbleRef, persistSettings,
  };
}

