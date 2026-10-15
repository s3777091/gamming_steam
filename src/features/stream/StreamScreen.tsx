// Màn stream (landscape): video WebRTC, cảm ứng -> chuột/cuộn, tay cầm/bàn phím/
// chuột vật lý -> PC, màn loading vào game, thanh điều khiển, HUD, menu Guide.
//
// Luồng chơi game: Play -> kết nối vào máy tính (PC đã bật booster) -> chờ PC báo
// cửa sổ game đã lên foreground -> vào thẳng màn hình loading của game.

import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import * as Clipboard from 'expo-clipboard';
import { addListener, grabFrame } from 'jetsona-input';

import { useUserProfile } from '@/hooks/useUserProfile';
import { useSignedInUser } from '@/features/auth';
import { useBack } from '@/features/gamepad/hooks';
import { readPendingGameLaunch, type PendingGameLaunch } from '@/lib/game-launch';
import { PC_ROUTES, pcFetch } from '@/lib/pc-api';
import { streamStretchStyle } from '@/lib/stream-fit';
import type { HostShortcutAction } from '@/lib/input-settings';
import { BlurView } from 'expo-blur';
import { glass, glassShadowSubtle } from '@/theme';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { GuideMenu } from './GuideMenu';
import { StreamHud } from './StreamHud';
import { StreamTouchpad } from './StreamTouchpad';
import { StreamTelemetry } from './useStreamTelemetry';
import { StreamLoading } from './StreamLoading';
import { useGameLaunchGate } from './useGameLaunchGate';
import { createRumbleHandler, useInputBridge } from './useInputBridge';
import { useStreamSession } from './useStreamSession';
import { useWatchPartyHost } from './useWatchPartyHost';

export default function StreamScreen() {
  const { s, insets } = useUi();
  const router = useRouter();
  const { userId, email } = useSignedInUser();
  const { profile } = useUserProfile(userId, email);
  useKeepAwake();

  // Bàn giao từ kệ game: đọc đúng một lần khi màn mở.
  const [launch] = useState<PendingGameLaunch | null>(() => readPendingGameLaunch());
  const [attempt, setAttempt] = useState(0);
  const [guideOpen, setGuideOpen] = useState(false);
  const [guideStatus, setGuideStatus] = useState<string | null>(null);
  const [hasFrame, setHasFrame] = useState(false);
  const [hint, setHint] = useState<string | null>(null);
  const [dismissedNotice, setDismissedNotice] = useState<string | null>(null);
  const [stage, setStage] = useState({ width: 1, height: 1 });
  const exitingRef = useRef(false);
  const guideGenerationRef = useRef(0);
  const resumeAfterPendingPauseRef = useRef(true);

  const exit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    if (router.canGoBack()) router.back(); else router.replace('/');
  }, [router]);

  const session = useStreamSession({ userId, attempt, onBackground: exit });
  const {
    phase, status, progress, streamURL, videoSize, inputReady, errorDetail,
    streamSettings, loadingThemeId, client, clientRef, sessionId, inputSettingsRef, rumbleRef, persistSettings,
  } = session;
  const live = phase === 'live';
  const gate = useGameLaunchGate(launch, live);
  const covering = live && gate.covering;

  // Tay cầm không điều khiển được màn loading: sau khi che đủ lâu, A tan nó để thao tác launcher.
  const { skippable, skip } = gate;
  useEffect(() => {
    if (!covering || !skippable) return;
    return addListener('onGamepadButton', (event) => {
      if (event.down && event.button === 'a') skip();
    });
  }, [covering, skip, skippable]);

  const flashHint = useCallback((message: string) => {
    setHint(message);
  }, []);
  const visibleHint = hint ?? (gate.notice !== dismissedNotice ? gate.notice : null);
  useEffect(() => {
    if (!visibleHint) return;
    const timer = setTimeout(() => {
      setHint(null);
      setDismissedNotice(gate.notice);
    }, 3000);
    return () => clearTimeout(timer);
  }, [gate.notice, visibleHint]);

  const gameRuntimeAction = useCallback(async (
    action: 'pause' | 'resume',
  ): Promise<boolean> => {
    const response = await pcFetch(PC_ROUTES.gameRuntime, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, gameId: '' }),
    });
    const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
    if (response.status === 404) return false;
    if (!response.ok || !data?.ok) throw new Error(data?.error || 'Máy tính không nhận lệnh điều khiển game.');
    return true;
  }, []);

  const closeGuide = useCallback((resumeGame = true) => {
    guideGenerationRef.current += 1;
    resumeAfterPendingPauseRef.current = resumeGame;
    setGuideOpen(false);
    setGuideStatus(null);
    if (resumeGame) {
      void gameRuntimeAction('resume').catch((error) => {
        flashHint((error as Error).message || 'Không tự tiếp tục được game.');
      });
    }
  }, [flashHint, gameRuntimeAction]);

  const openGuide = useCallback(() => {
    if (!live) return;
    const generation = guideGenerationRef.current + 1;
    guideGenerationRef.current = generation;
    resumeAfterPendingPauseRef.current = true;
    // Giữ khung hình TRƯỚC khi menu che mất để còn chụp ảnh được.
    setHasFrame(false);
    void grabFrame().then(setHasFrame);
    setGuideStatus(null);
    setGuideOpen(true);
    void gameRuntimeAction('pause')
      .then((paused) => {
        if (generation !== guideGenerationRef.current) {
          if (resumeAfterPendingPauseRef.current) void gameRuntimeAction('resume').catch(() => {});
          return;
        }
        setGuideStatus(paused ? 'Game đã tự pause.' : null);
      })
      .catch((error) => {
        if (generation === guideGenerationRef.current) {
          setGuideStatus((error as Error).message || null);
        }
      });
  }, [gameRuntimeAction, live]);
  useBack(() => { if (guideOpen) closeGuide(); else return true; }, live);

  const reload = useCallback(() => {
    closeGuide(true);
    setAttempt((value) => value + 1);
  }, [closeGuide]);

  const persistHud = useCallback((enabled: boolean) => {
    void persistSettings({ hud_enabled: enabled });
  }, [persistSettings]);

  const pullClipboard = useCallback(async () => {
    try {
      const response = await pcFetch(PC_ROUTES.clipboard, { cache: 'no-store' });
      const data = await response.json().catch(() => null) as { ok?: boolean; text?: string } | null;
      if (data?.ok && data.text) {
        await Clipboard.setStringAsync(data.text);
        flashHint('Đã sao chép từ máy tính');
      } else flashHint('Clipboard của máy tính đang trống');
    } catch {
      flashHint('Không đọc được clipboard của máy tính');
    }
  }, [flashHint]);

  const onShortcut = useCallback((action: HostShortcutAction) => {
    switch (action) {
      case 'exit': exit(); break;
      case 'reload':
      case 'settings': reload(); break;
      case 'hud': persistHud(!streamSettings?.hud_enabled); break;
      case 'clipboard': void pullClipboard(); break;
      case 'shutdown': flashHint('Dùng menu tay cầm để tắt máy an toàn'); break;
      case 'zoom': flashHint('Khung hình luôn vừa màn hình'); break;
    }
  }, [exit, flashHint, persistHud, pullClipboard, reload, streamSettings?.hud_enabled]);

  const bridge = useInputBridge({
    client, inputReady, live,
    settingsRef: inputSettingsRef,
    guideOpen,
    onGuide: () => { if (guideOpen) closeGuide(); else openGuide(); },
    onShortcut,
  });
  useLayoutEffect(() => {
    rumbleRef.current = createRumbleHandler(bridge.nativeIdForSlot, inputSettingsRef);
    return () => { rumbleRef.current = null; };
  }, [bridge.nativeIdForSlot, inputSettingsRef, rumbleRef]);

  // ---- cảm ứng -> chuột (kiểu touchpad tuyệt đối trên khung stream) ----
  const [touchpad] = useState(() => new StreamTouchpad());
  useLayoutEffect(() => {
    touchpad.update({
      live, videoSize, stage,
      getClient: () => clientRef.current,
      getSettings: () => inputSettingsRef.current,
    });
  }, [clientRef, inputSettingsRef, live, stage, touchpad, videoSize]);
  useEffect(() => () => touchpad.release(), [touchpad]);

  const stretch = useMemo(() => streamStretchStyle(videoSize, stage), [stage, videoSize]);
  const controller = useMemo(
    () => ({ name: profile.displayName, avatarUrl: profile.avatarUrl }),
    [profile.avatarUrl, profile.displayName],
  );
  const watchParty = useWatchPartyHost({
    sessionId,
    client,
    userId,
    name: controller.name,
  });

  return (
    <View
      style={styles.root}
      collapsable={false}
      onLayout={(event) => setStage({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      {streamURL ? (
        <RTCView
          collapsable={false}
          streamURL={streamURL}
          style={[styles.video, stretch]}
          objectFit="contain"
          zOrder={0}
        />
      ) : <View style={styles.black} />}

      {live ? <View collapsable={false} style={styles.touch} {...touchpad.panHandlers} /> : null}

      <StreamLoading
        key={attempt}
        visible={!live || covering}
        phase={live ? 'connecting' : phase}
        status={covering ? gate.label : status}
        progress={!launch || phase === 'error' ? progress : covering ? 55 + gate.progress * 0.45 : Math.min(progress, 100) * 0.55}
        themeId={loadingThemeId}
        launch={launch}
        highlights={gate.highlights}
        detail={errorDetail}
        onRetry={() => setAttempt((value) => value + 1)}
        onExit={exit}
        onReveal={covering && gate.skippable ? gate.skip : undefined}
      />

      <StreamTelemetry client={client} enabled={live} />
      <StreamHud enabled={live && !covering && Boolean(streamSettings?.hud_enabled)} top={s(8) + Math.min(insets.top, 8)} left={insets.left + s(12)} />

      <GuideMenu
        open={live && guideOpen}
        profile={controller}
        hasFrame={hasFrame}
        status={guideStatus}
        watchParty={watchParty}
        launch={launch}
        videoSize={videoSize}
        streamSettings={streamSettings}
        onClose={() => closeGuide(true)}
        onHome={() => { closeGuide(false); exit(); }}
        onReload={reload}
        onSwitched={() => { closeGuide(false); flashHint('Đã chuyển sang game đã chọn'); }}
        onExitGame={() => { closeGuide(false); exit(); }}
      />

      {visibleHint && live ? (
        <View pointerEvents="none" style={[styles.hint, { bottom: s(24) + insets.bottom, paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(18) }]}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
          <T size={11.8} weight="medium" color="rgba(255,255,255,0.85)">{visibleHint}</T>
        </View>
      ) : null}

    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden', backgroundColor: '#020204' },
  black: { ...StyleSheet.absoluteFill, backgroundColor: '#020204' },
  video: { ...StyleSheet.absoluteFill, zIndex: 2, backgroundColor: '#000' },
  touch: { ...StyleSheet.absoluteFill, zIndex: 10 },
  hint: {
    position: 'absolute',
    alignSelf: 'center',
    zIndex: 90,
    backgroundColor: glass.surfaceRaised,
    borderWidth: 1,
    borderColor: glass.borderSpecular,
    overflow: 'hidden',
    ...glassShadowSubtle,
  },
});

