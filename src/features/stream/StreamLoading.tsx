// Loop the silent train video until the stream/game gate is ready, hold for two seconds,
// then play the door opening once and reveal the game artwork and title.
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, RefreshCw, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useReducer, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';

import type { PendingGameLaunch } from '@/lib/game-launch';
import type { LoadingThemeId } from '@/lib/loading-themes';
import {
  LOADING_READY_HOLD_MS,
  OPENING_WATCHDOG_MS,
  reduceLoadingSequence,
} from '@/lib/loading-sequence';
import { useUiSounds } from '@/features/sound/UiSoundProvider';
import { alpha, glassShadowSubtle, makeStyles, SeasonGreeting, ThemeDecor, useSeason, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { useMotion } from '@/ui/motion';
import { T } from '@/ui/Text';
import { TrainVideo } from './TrainVideo';

export type LoadingPhase = 'connecting' | 'waiting' | 'live' | 'error';

const COL_BG = '#05070D';
const COL_TEXT = '#F2F4F8';
const DEFAULT_PC_BACKDROP =
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1920&q=80';

export type StreamLoadingProps = {
  visible: boolean;
  phase: LoadingPhase;
  status: string;
  progress: number;
  themeId?: LoadingThemeId;
  launch: PendingGameLaunch | null;
  highlights?: string[];
  detail?: string | null;
  onRetry: () => void;
  onExit: () => void;
  onReveal?: () => void;
  /**
   * Nối lại phiên game đang chạy (nút Tải lại / quay lại từ Home): vẫn chạy
   * đoàn tàu trong lúc nối, nhưng xong thì tan thẳng vào stream, không mở cửa
   * tàu hay giới thiệu lại game.
   */
  direct?: boolean;
};

export function StreamLoading(props: StreamLoadingProps) {
  const [mounted, setMounted] = useState(props.visible);
  const hide = useCallback(() => setMounted(false), []);
  if (props.visible && !mounted) setMounted(true);
  if (!mounted) return null;
  return <StreamLoadingSequence {...props} onHidden={hide} />;
}

function StreamLoadingSequence({
  visible,
  phase,
  status,
  progress,
  launch,
  detail,
  onRetry,
  onExit,
  onReveal,
  direct = false,
  onHidden,
}: StreamLoadingProps & { onHidden: () => void }) {
  const { colors } = useTheme();
  const season = useSeason();
  const styles = useStyles();
  const { s, width, insets } = useUi();
  const { active, reduceMotion } = useMotion();
  const sounds = useUiSounds();
  const failure = phase === 'error';
  const canReveal = Boolean(visible && onReveal);
  // Only the parent knows whether BOTH the stream and game launch gate are done.
  const ready = !visible && !failure;
  const [stage, dispatch] = useReducer(reduceLoadingSequence, 'loading');
  const openingActive = stage === 'opening' || stage === 'revealing';
  const artworkVisible = ready && (stage === 'revealing' || stage === 'finished');
  const shouldShowRoot = visible || stage !== 'finished';
  const displayedProgress = ready ? 100 : Math.min(Math.max(progress, 0), 99);

  const [rootOpacity] = useState(() => new Animated.Value(1));
  const [videoOpacity] = useState(() => new Animated.Value(1));
  const [animProgress] = useState(() => new Animated.Value(displayedProgress));
  const [sheen] = useState(() => new Animated.Value(0));
  const [logoScale] = useState(() => new Animated.Value(0.92));
  const [logoOpacity] = useState(() => new Animated.Value(0));
  const [ambientZoom] = useState(() => new Animated.Value(0));

  const dissolve = useCallback(() => dispatch('dissolve'), []);
  const ended = useCallback(() => dispatch('ended'), []);

  useEffect(() => {
    dispatch(ready ? (direct ? 'readyDirect' : 'ready') : 'blocked');
  }, [direct, ready]);

  useEffect(() => {
    if (!ready || stage !== 'settling') return;
    const timer = setTimeout(() => dispatch('settled'), LOADING_READY_HOLD_MS);
    return () => clearTimeout(timer);
  }, [ready, stage]);

  // A broken video may skip the cinematic only AFTER real loading and the hold.
  useEffect(() => {
    if (!ready || !openingActive) return;
    const timer = setTimeout(() => dispatch('ended'), OPENING_WATCHDOG_MS);
    return () => clearTimeout(timer);
  }, [openingActive, ready]);

  useEffect(() => {
    if (!artworkVisible) {
      videoOpacity.setValue(1);
      logoOpacity.setValue(0);
      logoScale.setValue(0.92);
      return;
    }
    const animation = Animated.parallel([
      Animated.timing(videoOpacity, {
        toValue: 0,
        duration: 520,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(logoScale, {
        toValue: 1,
        duration: 480,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    animation.start();
    return () => animation.stop();
  }, [artworkVisible, logoOpacity, logoScale, videoOpacity]);

  useEffect(() => {
    const animation = Animated.timing(rootOpacity, {
      toValue: shouldShowRoot ? 1 : 0,
      duration: shouldShowRoot ? 180 : 380,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => {
      if (finished && !shouldShowRoot) onHidden();
    });
    return () => animation.stop();
  }, [onHidden, rootOpacity, shouldShowRoot]);

  useEffect(() => {
    const anim = Animated.timing(animProgress, {
      toValue: displayedProgress,
      duration: 400,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    });
    anim.start();
    return () => anim.stop();
  }, [animProgress, displayedProgress]);

  // Sheen quét sáng thanh tiến trình
  useEffect(() => {
    if (failure || !shouldShowRoot || !active || reduceMotion) {
      sheen.stopAnimation();
      return;
    }
    sheen.setValue(0);
    const anim = Animated.loop(
      Animated.timing(sheen, {
        toValue: 1,
        duration: 1600,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    anim.start();
    return () => anim.stop();
  }, [active, failure, reduceMotion, sheen, shouldShowRoot]);

  // Hiệu ứng Ken Burns thở nhẹ nhàng cho background game
  useEffect(() => {
    if (!artworkVisible || !active || reduceMotion) return;
    ambientZoom.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientZoom, {
          toValue: 1,
          duration: 10_000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ambientZoom, {
          toValue: 0,
          duration: 10_000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    );
    anim.start();
    return () => anim.stop();
  }, [active, ambientZoom, artworkVisible, reduceMotion]);

  const heroUri = launch?.heroUrl || DEFAULT_PC_BACKDROP;
  const title = launch?.title ? launch.title.toUpperCase() : 'PC STREAMING';

  const progressPercentWidth = useMemo(
    () =>
      animProgress.interpolate({
        inputRange: [0, 100],
        outputRange: ['0%', '100%'],
        extrapolate: 'clamp',
      }),
    [animProgress],
  );

  const backdropScale = useMemo(
    () =>
      ambientZoom.interpolate({
        inputRange: [0, 1],
        outputRange: [1.0, 1.05],
      }),
    [ambientZoom],
  );

  const sheenTranslateX = useMemo(
    () =>
      sheen.interpolate({
        inputRange: [0, 1],
        outputRange: [-s(120), width],
      }),
    [s, sheen, width],
  );

  return (
    <Animated.View
      style={[styles.root, { opacity: rootOpacity }]}
      pointerEvents={shouldShowRoot ? 'auto' : 'none'}
      accessibilityViewIsModal
      accessibilityLabel={status || 'Đang tải trò chơi'}
    >
      {/* 1. LỚP ĐỆM ĐEN TUYỆT ĐỐI KHÔNG LỘ MÀN HÌNH MÁY TÍNH */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COL_BG }]} />

      {/* 2. LỚP BACKGROUND GAME KEN BURNS (LỘ RA KHI QUA CỬA TÀU) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: backdropScale }] },
        ]}
        pointerEvents="none"
      >
        {heroUri ? (
          <Img
            source={{ uri: heroUri }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            priority="high"
          />
        ) : null}
        <LinearGradient
          colors={[
            alpha(colors.bgDeep, 0.5),
            alpha(colors.bgDeep, 0.2),
            alpha(colors.bgDeep, 0.35),
            alpha(colors.bgDeep, 0.85),
          ]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]} pointerEvents="none">
        {stage !== 'finished' ? (
          <TrainVideo key={openingActive ? 'opening' : 'loop'} opening={openingActive}
            playing={active && !failure && (openingActive || !reduceMotion)}
            volume={sounds.enabled ? sounds.volume : 0} onDissolve={dissolve} onEnded={ended} />
        ) : null}
      </Animated.View>

      {/* Không khí và hạt của theme mùa trên video chờ; tan cùng video khi vào game. */}
      {stage !== 'finished' && !failure ? (
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: videoOpacity }]} pointerEvents="none">
          <ThemeDecor />
        </Animated.View>
      ) : null}

      {/* Artwork and title appear only when the doors open. */}
      <Animated.View
        style={[
          styles.centerContainer,
          {
            opacity: logoOpacity,
            transform: [{ scale: logoScale }],
          },
        ]}
        pointerEvents="none"
      >
        {launch?.logoUrl ? (
          <Img
            source={{ uri: launch.logoUrl }}
            style={{ width: Math.min(s(320), width * 0.6), height: s(76) }}
            contentFit="contain"
            transition={0}
          />
        ) : (
          <T
            size={Platform.OS === 'web' ? 40 : s(28)}
            weight="bold"
            color={COL_TEXT}
            tracking={0.06}
            numberOfLines={2}
            style={styles.centerTitle}
          >
            {title}
          </T>
        )}
      </Animated.View>

      {/* 5. NÚT THOÁT PHIÊN Ở GÓC TRÊN BÊN PHẢI */}
      <View style={styles.topBar}>
        <Press
          onPress={onExit}
          accessibilityLabel="Thoát phiên"
          sound="back"
          style={styles.exitPill}
        >
          <X size={s(14)} color="rgba(255,255,255,0.75)" />
          <T size={11} weight="medium" color="rgba(255,255,255,0.85)">Thoát</T>
        </Press>
      </View>

      {/* 6. THÔNG BÁO LỖI KHI MẤT KẾT NỐI */}
      {failure ? (
        <View pointerEvents="none" style={styles.centerContainer}>
          <FailureMessage detail={detail} width={width} scale={s} />
        </View>
      ) : null}

      {/* 7. NÚT THAO TÁC KHI CÓ LỖI HOẶC CẦN MỞ DESKTOP */}
      {(failure || canReveal) ? (
        <View style={[styles.bottomActions, { bottom: insets.bottom + s(32) }]}>
          {failure ? (
            <Press onPress={onRetry} style={styles.actionBtn}>
              <RefreshCw size={s(15)} color="#09090B" />
              <T size={12} weight="bold" color="#09090B">Kết nối lại</T>
            </Press>
          ) : null}
          {canReveal ? (
            <Press onPress={onReveal} style={styles.actionBtn}>
              <Monitor size={s(15)} color="#09090B" />
              <T size={12} weight="bold" color="#09090B">Xem màn hình máy tính</T>
            </Press>
          ) : null}
        </View>
      ) : null}

      {!failure && !ready ? (
        <View pointerEvents="none" style={{ position: 'absolute', left: insets.left + s(12), bottom: insets.bottom + s(28) }}>
          <SeasonGreeting />
        </View>
      ) : null}

      <View pointerEvents="none" style={[
        styles.loadingStatus,
        {
          bottom: insets.bottom + s(8),
          left: insets.left + s(12),
          right: insets.right + s(12),
        },
      ]}>
        <T size={11} leading={1.2} color="rgba(255,255,255,0.85)" numberOfLines={1} style={styles.statusText}>
          {failure ? 'Kết nối bị gián đoạn' : ready ? 'Sẵn sàng' : status || (direct ? 'Đang nối lại phiên chơi' : 'Đang tải trò chơi')}
        </T>
        <T size={11} leading={1.2} tabular color="rgba(255,255,255,0.85)">{Math.round(displayedProgress)}%</T>
      </View>

      {/* Progress follows loading, independently of the six-second video loop. */}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Tiến trình kết nối"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(displayedProgress) }}
        style={styles.progressTrack}
      >
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressPercentWidth,
              backgroundColor: failure ? 'rgba(248,113,113,0.95)' : season ? colors.accent : 'rgba(255,255,255,0.92)',
            },
          ]}
        />
        {!failure && shouldShowRoot ? (
          <Animated.View
            style={[
              styles.progressSheen,
              {
                transform: [{
                  translateX: sheenTranslateX,
                }],
              },
            ]}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

function FailureMessage({
  detail,
  width,
  scale,
}: {
  detail?: string | null;
  width: number;
  scale: (value: number) => number;
}) {
  const styles = useStyles();
  return (
    <View style={{ marginTop: scale(14), alignItems: 'center' }}>
      <T
        size={Platform.OS === 'web' ? 20 : scale(16)}
        weight="bold"
        color="#F87171"
        tracking={-0.01}
        style={styles.centerTitle}
      >
        MẤT KẾT NỐI
      </T>
      {detail ? (
        <T
          size={11.5}
          color="rgba(254,202,202,0.85)"
          style={{ marginTop: scale(6), textAlign: 'center', maxWidth: width * 0.6 }}
        >
          {detail}
        </T>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles(({ glass }) => ({
  root: {
    ...StyleSheet.absoluteFill,
    zIndex: 40,
    elevation: 40,
    overflow: 'hidden',
    backgroundColor: COL_BG,
  },
  topBar: {
    position: 'absolute',
    top: 24,
    right: 24,
    zIndex: 50,
  },
  exitPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: glass.surfaceRaised,
    borderWidth: 1,
    borderColor: glass.borderSpecular,
    ...glassShadowSubtle,
  },
  centerContainer: {
    position: 'absolute',
    inset: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: '8%',
  },
  centerTitle: {
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.85)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 28,
  },
  bottomActions: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 12,
    zIndex: 50,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 40,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    gap: 8,
    ...glassShadowSubtle,
  },
  loadingStatus: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  statusText: {
    flex: 1,
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  progressTrack: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.14)',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
  },
  progressSheen: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 90,
    backgroundColor: 'rgba(255,255,255,0.45)',
  },
}));
