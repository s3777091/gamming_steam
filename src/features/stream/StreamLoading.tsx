// Màn hình loading của stream lấy cảm hứng từ MetroHero (locked scroll-scrub video hero).
// Đồng bộ tiến độ đoàn tàu (subway train) mở cửa và đi vào chính xác theo progress loading.
// Cắt bỏ cánh cửa thứ 2 và cảnh thành phố, chuyển tiếp mượt mà vào Background + Logo Title Game ở giữa.
// Không có chữ "Đang kết nối" hay status text rườm rà. Nền đậm hoàn toàn đặc không bị lộ desktop phía sau.

import React, { Component, useEffect, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  Platform,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, RefreshCw, X } from 'lucide-react-native';

import type { PendingGameLaunch } from '@/lib/game-launch';
import type { LoadingThemeId } from '@/lib/loading-themes';
import { glass, glassShadowSubtle } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type LoadingPhase = 'connecting' | 'waiting' | 'live' | 'error';

const METRO_TRAIN_VIDEO =
  'https://cdn.21st.dev/assets/mirror/21/21a77eac28eacbb7e142016eefeaa0b4a766619e51113629a3bc6df6af066c0f.mp4';

// Thời điểm tối đa của đoàn tàu: 3.4 giây (cửa mở và đi vào toa tàu, cắt hẳn cánh cửa thứ hai và cảnh thành phố ở 3.8s+)
const TRAIN_MAX_TIME = 3.4;

const DEFAULT_PC_BACKDROP =
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1920&q=80';

const COL_BG = '#05070D';
const COL_TEXT = '#F2F4F8';

// Bọc an toàn trong trường hợp native module chưa được biên dịch trong binary dev-client
class VideoErrorBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('[StreamLoading] expo-video native module not ready, using animated backdrop:', error);
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * Phát video đoàn tàu ngầm đồng bộ với tiến trình loading:
 * Khi progress từ 0% đến 50%, tàu chạy từ 0s đến 3.4s (cửa mở ra và đi vào toa tàu).
 * Tuyệt đối cắt bỏ cửa thứ 2 và cảnh thành phố phía sau.
 */
function NativeMetroVideo({ videoUrl, progress }: { videoUrl: string; progress: number }) {
  let VideoViewComponent: any = null;
  let useVideoPlayerHook: any = null;

  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ExpoVideo = require('expo-video');
    VideoViewComponent = ExpoVideo.VideoView;
    useVideoPlayerHook = ExpoVideo.useVideoPlayer;
  } catch {
    // Sẽ được VideoErrorBoundary xử lý
  }

  if (!VideoViewComponent || !useVideoPlayerHook) {
    throw new Error('expo-video module not available');
  }

  return (
    <NativeMetroVideoInner
      VideoView={VideoViewComponent}
      useVideoPlayer={useVideoPlayerHook}
      videoUrl={videoUrl}
      progress={progress}
    />
  );
}

function safeSetPlayerTime(playerInstance: any, time: number) {
  try {
    playerInstance.currentTime = time;
  } catch {
    // Ignore
  }
}

function NativeMetroVideoInner({
  VideoView,
  useVideoPlayer,
  videoUrl,
  progress,
}: {
  VideoView: any;
  useVideoPlayer: any;
  videoUrl: string;
  progress: number;
}) {
  const player = useVideoPlayer(videoUrl, (p: any) => {
    try {
      p.loop = false;
      p.muted = true;
      p.play();
    } catch {
      // Ignore initial setup warning
    }
  });

  // Đồng bộ tiến độ đoàn tàu trực tiếp theo progress (0% - 50% tiến trình loading)
  useEffect(() => {
    if (!player) return;
    try {
      // 0% -> 50% loading tương đương 0s -> 3.4s video
      const ratio = Math.min(Math.max(progress / 50, 0), 1);
      const targetTime = ratio * TRAIN_MAX_TIME;
      const current = player.currentTime || 0;

      // Cắt bỏ hoàn toàn cảnh cửa thứ 2 và cảnh thành phố
      if (current >= TRAIN_MAX_TIME) {
        player.pause();
        safeSetPlayerTime(player, TRAIN_MAX_TIME);
        return;
      }

      // Điều chỉnh nếu chênh lệch đáng kể
      if (Math.abs(targetTime - current) > 0.5) {
        safeSetPlayerTime(player, Math.min(targetTime, TRAIN_MAX_TIME));
      }

      if (current < targetTime && !player.playing) {
        player.play();
      } else if (current >= targetTime && player.playing) {
        player.pause();
      }
    } catch {
      // Ignore
    }
  }, [player, progress]);

  // Bộ chặn cứng: tuyệt đối không bao giờ để video chạy quá 3.4s để lộ cảnh thành phố
  useEffect(() => {
    if (!player) return;
    const interval = setInterval(() => {
      try {
        if ((player.currentTime || 0) >= TRAIN_MAX_TIME) {
          player.pause();
          safeSetPlayerTime(player, TRAIN_MAX_TIME);
        }
      } catch {
        // Ignore
      }
    }, 60);
    return () => clearInterval(interval);
  }, [player]);

  return (
    <VideoView
      player={player}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      nativeControls={false}
      allowsFullscreen={false}
    />
  );
}

export function StreamLoading({
  visible,
  phase,
  status,
  progress,
  themeId,
  launch,
  highlights = [],
  detail,
  onRetry,
  onExit,
  onReveal,
}: {
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
}) {
  const { s, width } = useUi();
  const canReveal = Boolean(visible && onReveal);
  const failure = phase === 'error';

  const [mounted, setMounted] = useState(visible);
  if (visible && !mounted) {
    setMounted(true);
  }
  const [rootOpacity] = useState(() => new Animated.Value(visible ? 1 : 0));

  // Tiến trình dạng Animated.Value mượt mà không bị giật bước
  const [animProgress] = useState(() => new Animated.Value(progress));

  // Chuyển động thở nhẹ điện ảnh (Ken Burns) cho game backdrop
  const [ambientZoom] = useState(() => new Animated.Value(0));

  // Sheen quét sáng qua thanh tiến trình
  const [sheen] = useState(() => new Animated.Value(0));

  // Mở / tắt màn loading với hiệu ứng tan biến điện ảnh
  useEffect(() => {
    const anim = Animated.timing(rootOpacity, {
      toValue: visible ? 1 : 0,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anim.stop();
  }, [rootOpacity, visible]);

  // Làm mịn tiến trình loading
  useEffect(() => {
    if (!visible) return;
    Animated.timing(animProgress, {
      toValue: Math.min(Math.max(progress, 2), 100),
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [animProgress, progress, visible]);

  // Hiệu ứng Ken Burns thở nhẹ nhàng cho background game
  useEffect(() => {
    if (!visible) return;
    ambientZoom.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientZoom, {
          toValue: 1,
          duration: 12_000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(ambientZoom, {
          toValue: 0,
          duration: 12_000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [ambientZoom, visible]);

  // Shimmer hiệu ứng trên thanh tiến trình
  useEffect(() => {
    if (!visible || phase !== 'connecting') {
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
      })
    );
    anim.start();
    return () => anim.stop();
  }, [phase, sheen, visible]);

  const targetBackdrop = launch?.heroUrl || DEFAULT_PC_BACKDROP;

  if (!mounted) return null;

  // 1. TÀU ĐI VÀO: 0% -> 50% tàu zoom tiến lên
  const trainScale = animProgress.interpolate({
    inputRange: [0, 50, 100],
    outputRange: [1.0, 1.08, 1.12],
    extrapolate: 'clamp',
  });

  // Tàu mờ dần từ 35% -> 55% để nhường chỗ cho Background Game
  const trainOpacity = animProgress.interpolate({
    inputRange: [0, 35, 55, 60],
    outputRange: [1, 1, 0, 0],
    extrapolate: 'clamp',
  });

  // 2. BACKGROUND GAME: Hiện dần từ 35% -> 55%, và từ 55% trở đi là 100% ĐẶC HOÀN TOÀN (opacity = 1.0)
  // Tuyệt đối không bị mờ mờ làm lộ ảnh màn hình desktop laptop phía sau
  const backdropOpacity = animProgress.interpolate({
    inputRange: [0, 35, 55, 100],
    outputRange: [0, 0, 1, 1],
    extrapolate: 'clamp',
  });

  const backdropBaseScale = animProgress.interpolate({
    inputRange: [35, 60, 100],
    outputRange: [1.08, 1.03, 1.0],
    extrapolate: 'clamp',
  });

  // 3. LOGO TITLE GAME: Xuất hiện ở giữa sau khi cửa tàu mở và đi vào
  const logoOpacity = animProgress.interpolate({
    inputRange: [0, 30, 50, 100],
    outputRange: [0, 0.2, 1, 1],
    extrapolate: 'clamp',
  });

  const logoScale = animProgress.interpolate({
    inputRange: [0, 30, 50, 100],
    outputRange: [0.88, 0.94, 1, 1],
    extrapolate: 'clamp',
  });

  const progressPercentWidth = animProgress.interpolate({
    inputRange: [0, 100],
    outputRange: ['0%', '100%'],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      style={[styles.root, { opacity: rootOpacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal
    >
      {/* 0. NỀN ĐEN ĐẶC TUYỆT ĐỐI KHÔNG BAO GIỜ LỘ LAPTOP PHÍA SAU */}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: COL_BG }]} />

      {/* 1. LỚP ĐOÀN TÀU (Đoàn tàu tiến độ từ 0% đến 50%, mở cửa và đi vào) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: trainOpacity,
            transform: [{ scale: trainScale }],
          },
        ]}
        pointerEvents="none"
      >
        <VideoErrorBoundary
          fallback={
            <Img
              source={{ uri: targetBackdrop }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
              priority="high"
            />
          }
        >
          <NativeMetroVideo videoUrl={METRO_TRAIN_VIDEO} progress={progress} />
        </VideoErrorBoundary>
      </Animated.View>

      {/* 2. LỚP BACKGROUND GAME (HIỆN RA KHI VÀO TOA TÀU, ĐẶC 100% KHÔNG MỜ MỜ LỘ DESKTOP) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: backdropOpacity,
            transform: [{ scale: backdropBaseScale }],
          },
        ]}
        pointerEvents="none"
      >
        {/* Nền đệm đen đặc */}
        <View style={[StyleSheet.absoluteFill, { backgroundColor: COL_BG }]} />

        {/* Ảnh nền game sắc nét */}
        <Img
          source={{ uri: targetBackdrop }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          priority="high"
        />

        {/* Lớp phủ điện ảnh làm nổi bật Logo game ở giữa */}
        <LinearGradient
          colors={[
            'rgba(5,7,13,0.45)',
            'rgba(5,7,13,0.15)',
            'rgba(5,7,13,0.3)',
            'rgba(5,7,13,0.85)',
          ]}
          locations={[0, 0.35, 0.7, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      {/* NÚT THOÁT PHIÊN Ở GÓC TRÊN BÊN PHẢI */}
      <View style={styles.topBar}>
        <Press
          onPress={onExit}
          accessibilityLabel="Thoát phiên"
          sound="back"
          style={styles.exitPill}
        >
          <X size={s(14)} color="rgba(255,255,255,0.75)" />
          <T size={11} weight="medium" color="rgba(255,255,255,0.85)">
            Thoát
          </T>
        </Press>
      </View>

      {/* 3. LOGO TITLE GAME CHÍNH GIỮA (KHÔNG CÓ CHỮ TRẮNG "ĐANG KẾT NỐI", CHỈ LOGO TITLE) */}
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
        {launch ? (
          <View style={{ alignItems: 'center' }}>
            {launch.logoUrl ? (
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
                {launch.title.toUpperCase()}
              </T>
            )}

            {/* Chỉ hiện thông báo đỏ khi bị lỗi mất kết nối */}
            {failure ? (
              <View style={{ marginTop: s(14), alignItems: 'center' }}>
                <T
                  size={Platform.OS === 'web' ? 20 : s(16)}
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
                    style={{ marginTop: s(6), textAlign: 'center', maxWidth: width * 0.6 }}
                  >
                    {detail}
                  </T>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : (
          <View style={{ alignItems: 'center' }}>
            <T
              size={Platform.OS === 'web' ? 36 : s(26)}
              weight="bold"
              color={COL_TEXT}
              tracking={0.08}
              style={styles.centerTitle}
            >
              PC STREAMING
            </T>

            {failure ? (
              <View style={{ marginTop: s(14), alignItems: 'center' }}>
                <T
                  size={Platform.OS === 'web' ? 20 : s(16)}
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
                    style={{ marginTop: s(6), textAlign: 'center', maxWidth: width * 0.6 }}
                  >
                    {detail}
                  </T>
                ) : null}
              </View>
            ) : null}
          </View>
        )}
      </Animated.View>

      {/* NÚT THAO TÁC KHI CÓ LỖI HOẶC CẦN MỞ DESKTOP */}
      {(failure || canReveal) ? (
        <View style={styles.bottomActions}>
          {failure ? (
            <Press onPress={onRetry} style={styles.actionBtn}>
              <RefreshCw size={s(15)} color="#09090B" />
              <T size={12} weight="bold" color="#09090B">
                Kết nối lại
              </T>
            </Press>
          ) : null}
          {canReveal ? (
            <Press onPress={onReveal} style={styles.actionBtn}>
              <Monitor size={s(15)} color="#09090B" />
              <T size={12} weight="bold" color="#09090B">
                Xem màn hình máy tính
              </T>
            </Press>
          ) : null}
        </View>
      ) : null}

      {/* 4. THANH TIẾN TRÌNH THANH MẢNH Ở ĐÁY MÀN HÌNH (CHUẨN METROHERO) */}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Tiến trình kết nối"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
        style={styles.progressTrack}
      >
        <Animated.View
          style={[
            styles.progressBar,
            {
              width: progressPercentWidth,
              backgroundColor: failure
                ? 'rgba(248,113,113,0.95)'
                : 'rgba(255,255,255,0.92)',
            },
          ]}
        />
        {phase === 'connecting' ? (
          <Animated.View
            style={[
              styles.progressSheen,
              {
                transform: [
                  {
                    translateX: sheen.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-s(120), width],
                    }),
                  },
                ],
              },
            ]}
          />
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
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
    bottom: 24,
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
});
