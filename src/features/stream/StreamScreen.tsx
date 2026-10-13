// Màn stream (landscape): video WebRTC, cảm ứng -> chuột/cuộn, tay cầm/bàn phím/
// chuột vật lý -> PC, màn loading vào game, thanh điều khiển, HUD, menu Guide.
//
// Luồng chơi game: Play -> kết nối vào máy tính (PC đã bật booster) -> chờ PC báo
// cửa sổ game đã lên foreground -> vào thẳng màn hình loading của game.

import * as Haptics from 'expo-haptics';
import { useKeepAwake } from 'expo-keep-awake';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, TextInput, View } from 'react-native';
import { RTCView } from 'react-native-webrtc';
import * as Clipboard from 'expo-clipboard';
import { addListener, grabFrame } from 'jetsona-input';

import { useUserProfile } from '@/hooks/useUserProfile';
import { useSignedInUser } from '@/features/auth';
import { useBack } from '@/features/gamepad/hooks';
import { DEFAULT_INPUT_SETTINGS } from '@/lib/input-settings';
import { readPendingGameLaunch, type PendingGameLaunch } from '@/lib/game-launch';
import { NativeMouseButton } from '@/lib/moonlight-native';
import { PC_ROUTES, pcFetch } from '@/lib/pc-api';
import { pointOnStream, streamStretchStyle } from '@/lib/stream-fit';
import type { HostShortcutAction } from '@/lib/input-settings';
import type { Resolution } from '@/lib/stream-settings';
import { BlurView } from 'expo-blur';
import { colors, glass, glassShadowSubtle } from '@/theme';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { GuideMenu } from './GuideMenu';
import { StreamBar } from './StreamBar';
import { StreamHud } from './StreamHud';
import { StreamLoading } from './StreamLoading';
import { useGameLaunchGate } from './useGameLaunchGate';
import { createRumbleHandler, useInputBridge } from './useInputBridge';
import { useStreamSession } from './useStreamSession';
import { useWatchPartyHost } from './useWatchPartyHost';

const TAP_THRESHOLD = 9;
const VK_BACK = 8;
const VK_RETURN = 13;
const KEYBOARD_SENTINEL = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

type GestureState = {
  startX: number; startY: number; lastX: number; lastY: number; moved: number;
  twoFinger: boolean; scrolling: boolean; leftDown: boolean;
};

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
  const [barVisible, setBarVisible] = useState(true);
  const [hint, setHint] = useState<string | null>(null);
  const [stage, setStage] = useState({ width: 1, height: 1 });
  const [keyboardValue, setKeyboardValue] = useState(KEYBOARD_SENTINEL);
  const inputRef = useRef<TextInput | null>(null);
  const exitingRef = useRef(false);
  const guideGenerationRef = useRef(0);
  const resumeAfterPendingPauseRef = useRef(true);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  const exit = useCallback(() => {
    if (exitingRef.current) return;
    exitingRef.current = true;
    if (router.canGoBack()) router.back(); else router.replace('/');
  }, [router]);

  const session = useStreamSession({ userId, attempt, onBackground: exit });
  const {
    phase, status, progress, streamURL, videoSize, inputReady, audioReady, errorDetail,
    streamSettings, moonlightSettings, loadingThemeId, client, clientRef, sessionId, inputSettingsRef, rumbleRef, persistSettings,
  } = session;
  const live = phase === 'live';
  const gate = useGameLaunchGate(launch, live);
  const covering = live && gate.covering;
  const videoRef = useRef(videoSize);
  videoRef.current = videoSize;

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
  useEffect(() => {
    if (!hint) return;
    const timer = setTimeout(() => setHint(null), 3000);
    return () => clearTimeout(timer);
  }, [hint]);
  useEffect(() => {
    if (gate.notice) flashHint(gate.notice);
  }, [flashHint, gate.notice]);

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
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setGuideStatus('Đang pause game...');
    setGuideOpen(true);
    void gameRuntimeAction('pause')
      .then((paused) => {
        if (generation !== guideGenerationRef.current) {
          if (resumeAfterPendingPauseRef.current) void gameRuntimeAction('resume').catch(() => {});
          return;
        }
        setGuideStatus(paused ? 'Game đã tự pause.' : 'Không có game đang chạy để pause.');
      })
      .catch((error) => {
        if (generation === guideGenerationRef.current) {
          setGuideStatus((error as Error).message || 'Không tự pause được game.');
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
      case 'topbar': setBarVisible(true); break;
      case 'shutdown': flashHint('Dùng menu Home để tắt máy an toàn'); break;
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
  rumbleRef.current = createRumbleHandler(bridge.nativeIdForSlot, inputSettingsRef);

  // ---- cảm ứng -> chuột (kiểu touchpad tuyệt đối trên khung stream) ----
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const gestureRef = useRef<GestureState>({ startX: 0, startY: 0, lastX: 0, lastY: 0, moved: 0, twoFinger: false, scrolling: false, leftDown: false });
  const normalized = (x: number, y: number) => pointOnStream(x, y, videoRef.current, stageRef.current);
  const releaseLeft = () => {
    if (!gestureRef.current.leftDown) return;
    clientRef.current?.sendMouseButton(false, NativeMouseButton.LEFT);
    gestureRef.current.leftDown = false;
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => phaseRef.current === 'live',
    onMoveShouldSetPanResponder: () => phaseRef.current === 'live',
    onPanResponderGrant: (event, gesture) => {
      const first = event.nativeEvent.touches[0];
      const x = first?.locationX ?? event.nativeEvent.locationX;
      const y = first?.locationY ?? event.nativeEvent.locationY;
      gestureRef.current = { startX: x, startY: y, lastX: x, lastY: y, moved: 0, twoFinger: gesture.numberActiveTouches >= 2, scrolling: false, leftDown: false };
    },
    onPanResponderMove: (event, gesture) => {
      const touches = event.nativeEvent.touches;
      const state = gestureRef.current;
      if (gesture.numberActiveTouches >= 2 && touches.length >= 2) {
        if (state.leftDown) releaseLeft();
        const x = ((touches[0].locationX ?? state.lastX) + (touches[1].locationX ?? state.lastX)) / 2;
        const y = ((touches[0].locationY ?? state.lastY) + (touches[1].locationY ?? state.lastY)) / 2;
        const dy = y - state.lastY;
        state.twoFinger = true;
        state.moved += Math.abs(x - state.lastX) + Math.abs(dy);
        state.lastX = x;
        state.lastY = y;
        if (state.moved >= TAP_THRESHOLD) {
          state.scrolling = true;
          const settings = inputSettingsRef.current ?? DEFAULT_INPUT_SETTINGS;
          const direction = settings.invertScroll ? 1 : -1;
          clientRef.current?.sendScroll(0, dy * 3 * settings.scrollSensitivity * direction);
        }
        return;
      }
      const first = touches[0];
      if (!first) return;
      const x = first.locationX ?? state.lastX;
      const y = first.locationY ?? state.lastY;
      state.moved += Math.abs(x - state.lastX) + Math.abs(y - state.lastY);
      state.lastX = x;
      state.lastY = y;
      if (state.moved < TAP_THRESHOLD) return;
      if (!state.leftDown) {
        const start = normalized(state.startX, state.startY);
        clientRef.current?.sendMousePosition(start.x, start.y, true);
        clientRef.current?.sendMouseButton(true, NativeMouseButton.LEFT);
        state.leftDown = true;
      }
      const point = normalized(x, y);
      clientRef.current?.sendMousePosition(point.x, point.y);
    },
    onPanResponderRelease: () => {
      const state = gestureRef.current;
      const point = normalized(state.lastX, state.lastY);
      if (state.leftDown) {
        clientRef.current?.sendMousePosition(point.x, point.y, true);
        releaseLeft();
        return;
      }
      if (state.scrolling) return;
      clientRef.current?.sendMousePosition(point.x, point.y, true);
      const button = state.twoFinger ? NativeMouseButton.RIGHT : NativeMouseButton.LEFT;
      clientRef.current?.sendMouseButton(true, button);
      clientRef.current?.sendMouseButton(false, button);
    },
    onPanResponderTerminate: releaseLeft,
    onPanResponderTerminationRequest: () => true,
  })).current;

  const sendVirtualKey = (key: number) => {
    clientRef.current?.sendKey(true, key);
    clientRef.current?.sendKey(false, key);
  };

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
      onLayout={(event) => setStage({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
    >
      {streamURL ? (
        <RTCView streamURL={streamURL} style={[styles.video, stretch]} objectFit="contain" zOrder={0} />
      ) : <View style={styles.black} />}

      {live ? <View collapsable={false} style={styles.touch} {...panResponder.panHandlers} /> : null}

      <StreamLoading
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

      {live && !covering ? (
        <StreamBar
          visible={barVisible}
          onVisibleChange={setBarVisible}
          inputReady={inputReady}
          audioReady={audioReady}
          streamSettings={streamSettings}
          moonlightSettings={moonlightSettings}
          controller={controller}
          hudEnabled={Boolean(streamSettings?.hud_enabled)}
          onGuide={openGuide}
          onReconnect={reload}
          onKeyboard={() => inputRef.current?.focus()}
          onExit={exit}
          onToggleHud={() => persistHud(!streamSettings?.hud_enabled)}
          onSaveResolution={(resolution: Resolution) => {
            void persistSettings({ resolution }).then((next) => { if (next) setAttempt((value) => value + 1); });
          }}
          onSleep={() => { void pcFetch(PC_ROUTES.sleep, { method: 'POST' }).catch(() => {}).finally(exit); }}
        />
      ) : null}

      <StreamHud client={client} enabled={live && !covering && Boolean(streamSettings?.hud_enabled)} top={s(8) + Math.min(insets.top, 8)} left={insets.left + s(12)} />

      <GuideMenu
        open={live && guideOpen}
        profile={controller}
        hasFrame={hasFrame}
        status={guideStatus}
        watchParty={watchParty}
        onClose={() => closeGuide(true)}
        onHome={() => { closeGuide(false); exit(); }}
        onReload={reload}
        onSwitched={() => { closeGuide(false); flashHint('Đã chuyển sang game đã chọn'); }}
        onExitGame={() => { closeGuide(false); exit(); }}
      />

      {hint && live ? (
        <View pointerEvents="none" style={[styles.hint, { bottom: s(24) + insets.bottom, paddingHorizontal: s(16), paddingVertical: s(8), borderRadius: s(18) }]}>
          <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
          <T size={11.8} weight="medium" color="rgba(255,255,255,0.85)">{hint}</T>
        </View>
      ) : null}

      <TextInput
        ref={inputRef}
        value={keyboardValue}
        selection={{ start: KEYBOARD_SENTINEL.length, end: KEYBOARD_SENTINEL.length }}
        onFocus={() => setKeyboardValue(KEYBOARD_SENTINEL)}
        onChangeText={(value) => {
          if (value.startsWith(KEYBOARD_SENTINEL)) {
            const inserted = value.slice(KEYBOARD_SENTINEL.length);
            if (inserted) clientRef.current?.sendText(inserted);
          } else if (KEYBOARD_SENTINEL.startsWith(value)) {
            const removed = KEYBOARD_SENTINEL.length - value.length;
            for (let index = 0; index < removed; index += 1) sendVirtualKey(VK_BACK);
          } else if (value) {
            clientRef.current?.sendText(value);
          }
          setKeyboardValue(KEYBOARD_SENTINEL);
        }}
        onSubmitEditing={() => {
          sendVirtualKey(VK_RETURN);
          setKeyboardValue(KEYBOARD_SENTINEL);
          inputRef.current?.focus();
        }}
        blurOnSubmit={false}
        autoCorrect={false}
        autoCapitalize="none"
        caretHidden
        contextMenuHidden
        selectTextOnFocus={false}
        spellCheck={false}
        style={styles.keyboardBridge}
      />
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
  keyboardBridge: { position: 'absolute', left: -1000, top: 0, width: 1, height: 1, opacity: 0 },
});

