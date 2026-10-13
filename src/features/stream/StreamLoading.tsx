// Màn hình loading của stream lấy cảm hứng từ MetroHero (locked scroll-scrub video hero).
// Hiệu ứng đoàn tàu (subway train) chạy mượt mà ở nền, kết hợp zoom điện ảnh vào Game hoặc PC máy tính.
// Tại vị trí trung tâm hiển thị trạng thái kết nối ngắn gọn, sắc nét (không có description rườm rà).

import React, { Component, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
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
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type LoadingPhase = 'connecting' | 'waiting' | 'live' | 'error';

const METRO_TRAIN_VIDEO =
  'https://cdn.21st.dev/assets/mirror/21/21a77eac28eacbb7e142016eefeaa0b4a766619e51113629a3bc6df6af066c0f.mp4';

const DEFAULT_PC_BACKDROP =
  'https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1920&q=80';

const COL_BG = '#05070D';
const COL_TEXT = '#F2F4F8';

/**
 * Rút gọn các dòng trạng thái dài dòng (như giải phóng RAM, khởi chạy quy trình...)
 * thành các trạng thái ngắn gọn, sắc nét chuẩn giao diện điện ảnh.
 */
export function formatLoadingStatus(rawStatus: string, phase: LoadingPhase): string {
  if (phase === 'error') return 'MẤT KẾT NỐI';
  if (!rawStatus) return 'ĐANG KẾT NỐI';

  const lower = rawStatus.toLowerCase();

  // Nhóm tối ưu RAM / Game Booster / Hệ thống
  if (
    lower.includes('giải phóng ram') ||
    lower.includes('tối ưu') ||
    lower.includes('optimize') ||
    lower.includes('ram') ||
    lower.includes('booster') ||
    lower.includes('dọn dẹp')
  ) {
    return 'ĐANG TỐI ƯU';
  }

  // Nhóm mở game / khởi động game
  if (
    lower.includes('đang mở') ||
    lower.includes('vào game') ||
    lower.includes('khởi động') ||
    lower.includes('starting') ||
    lower.includes('launching')
  ) {
    return 'ĐANG VÀO GAME';
  }

  // Nhóm chờ người dùng / phòng stream
  if (
    lower.includes('chờ người dùng') ||
    lower.includes('chờ') ||
    lower.includes('waiting') ||
    lower.includes('yêu cầu')
  ) {
    return 'ĐANG CHỜ PHẢN HỒI';
  }

  // Nhóm hoàn tất / khung hình đầu tiên
  if (
    lower.includes('khung hình') ||
    lower.includes('sẵn sàng') ||
    lower.includes('truyền trực tiếp')
  ) {
    return 'SẴN SÀNG';
  }

  // Nhóm kết nối mạng / WebRTC / xác thực
  if (
    lower.includes('xác nhận') ||
    lower.includes('quyền sử dụng') ||
    lower.includes('tìm host') ||
    lower.includes('kết nối') ||
    lower.includes('webrtc') ||
    lower.includes('đường truyền')
  ) {
    return 'ĐANG KẾT NỐI';
  }

  // Nếu chữ ngắn gọn (< 24 ký tự)
  if (rawStatus.length <= 24) {
    return rawStatus.replace(/[.…]+$/, '').trim().toUpperCase();
  }

  return 'ĐANG THIẾT LẬP';
}

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
 * Phát video đoàn tàu ngầm mượt mà bằng expo-video.
 */
function NativeMetroVideo({ videoUrl }: { videoUrl: string }) {
  let VideoViewComponent: any = null;
  let useVideoPlayerHook: any = null;

  try {
    const ExpoVideo = require('expo-video');
    VideoViewComponent = ExpoVideo.VideoView;
    useVideoPlayerHook = ExpoVideo.useVideoPlayer;
  } catch {
    // Sẽ được VideoErrorBoundary xử lý
  }

  if (!VideoViewComponent || !useVideoPlayerHook) {
    throw new Error('expo-video module not available');
  }

  return <NativeMetroVideoInner VideoView={VideoViewComponent} useVideoPlayer={useVideoPlayerHook} videoUrl={videoUrl} />;
}

function NativeMetroVideoInner({
  VideoView,
  useVideoPlayer,
  videoUrl,
}: {
  VideoView: any;
  useVideoPlayer: any;
  videoUrl: string;
}) {
  const player = useVideoPlayer(videoUrl, (p: any) => {
    try {
      p.loop = true;
      p.muted = true;
      p.play();
    } catch {
      // Ignore initial setup warning
    }
  });

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
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;

  // Zoom chậm mượt mà theo phong cách Ken Burns cho đoàn tàu
  const trainZoom = useRef(new Animated.Value(0)).current;
  // Zoom cho Game hoặc PC
  const targetZoom = useRef(new Animated.Value(0)).current;
  // Sheen quét sáng qua thanh tiến trình
  const sheen = useRef(new Animated.Value(0)).current;
  // Hiệu ứng mờ/rõ trạng thái
  const textScale = useRef(new Animated.Value(0.95)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const anim = Animated.timing(opacity, {
      toValue: visible ? 1 : 0,
      duration: 550,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start(({ finished }) => {
      if (finished && !visible) setMounted(false);
    });
    return () => anim.stop();
  }, [opacity, visible]);

  // Hiệu ứng chuyển động đoàn tàu chạy mượt mà
  useEffect(() => {
    if (!visible) return;
    trainZoom.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(trainZoom, {
          toValue: 1,
          duration: 14_000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(trainZoom, {
          toValue: 0,
          duration: 14_000,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, [trainZoom, visible]);

  // Hiệu ứng Zoom vào Game hoặc PC khi tiến trình tăng dần
  useEffect(() => {
    if (!visible) return;
    const normalized = Math.min(Math.max(progress / 100, 0), 1);
    Animated.timing(targetZoom, {
      toValue: normalized,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [progress, targetZoom, visible]);

  // Hiệu ứng nhịp thở nhẹ cho chữ trạng thái
  useEffect(() => {
    if (!visible) return;
    Animated.spring(textScale, {
      toValue: 1,
      friction: 6,
      tension: 40,
      useNativeDriver: true,
    }).start();
  }, [status, textScale, visible]);

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

  const displayStatus = useMemo(() => formatLoadingStatus(status, phase), [status, phase]);

  const targetBackdrop = launch?.heroUrl || DEFAULT_PC_BACKDROP;

  if (!mounted) return null;

  const trainScaleInterpolation = trainZoom.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.07],
  });

  const targetScaleInterpolation = targetZoom.interpolate({
    inputRange: [0, 1],
    outputRange: [1.0, 1.12],
  });

  // Độ mờ của Game/PC hiện dần khi tiến trình tăng cao
  const targetOpacityInterpolation = targetZoom.interpolate({
    inputRange: [0, 0.4, 0.85, 1],
    outputRange: [0.12, 0.28, 0.65, 0.9],
  });

  const progressPercent = Math.min(Math.max(progress, 4), 100);

  return (
    <Animated.View
      style={[styles.root, { opacity }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityViewIsModal
    >
      {/* 1. LỚP ĐOÀN TÀU (Đoàn tàu phía sau chính là loading) */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          { transform: [{ scale: trainScaleInterpolation }] },
        ]}
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
          <NativeMetroVideo videoUrl={METRO_TRAIN_VIDEO} />
        </VideoErrorBoundary>
      </Animated.View>

      {/* 2. ZOOM VÀO GAME HOẶC PC MÁY TÍNH */}
      {/* Lớp nền của Game/PC sẽ zoom dần vào tâm khi kết nối tiến triển */}
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            opacity: targetOpacityInterpolation,
            transform: [{ scale: targetScaleInterpolation }],
          },
        ]}
        pointerEvents="none"
      >
        <Img
          source={{ uri: targetBackdrop }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
          priority="high"
        />
      </Animated.View>

      {/* 3. LỚP PHỦ MÀU ĐẬM VIGNETTE CINEMATIC */}
      <LinearGradient
        colors={[
          'rgba(5,7,13,0.5)',
          'rgba(5,7,13,0.15)',
          'rgba(5,7,13,0.3)',
          'rgba(5,7,13,0.85)',
        ]}
        locations={[0, 0.3, 0.7, 1]}
        style={StyleSheet.absoluteFill}
        pointerEvents="none"
      />

      {/* NÚT THOÁT PHIÊN Ở GÓC TRÊN BÊN PHẢI */}
      <View style={styles.topBar}>
        <Press
          onPress={onExit}
          accessibilityLabel="Thoát phiên"
          sound="back"
          style={styles.exitPill}
        >
          <X size={s(14)} color="rgba(255,255,255,0.7)" />
          <T size={11} weight="medium" color="rgba(255,255,255,0.75)">
            Thoát
          </T>
        </Press>
      </View>

      {/* 4. CHỮ TRẠNG THÁI KẾT NỐI Ở CHÍNH GIỮA (CHỖ KHOANH VÀNG ẢNH 2) */}
      {/* Không có Description dài dòng, chữ lớn phong cách THE CITY OPENS */}
      <View style={styles.centerContainer} pointerEvents="none">
        {/* Tiêu đề phụ: Tên Game hoặc PC */}
        {launch ? (
          <View style={{ alignItems: 'center', marginBottom: s(10) }}>
            {launch.logoUrl ? (
              <Img
                source={{ uri: launch.logoUrl }}
                style={{ width: Math.min(s(220), width * 0.45), height: s(46) }}
                contentFit="contain"
                transition={0}
              />
            ) : (
              <T
                size={11.5}
                weight="bold"
                color="rgba(242,244,248,0.75)"
                tracking={0.2}
                numberOfLines={1}
              >
                {launch.title.toUpperCase()}
              </T>
            )}
          </View>
        ) : (
          <T
            size={11}
            weight="bold"
            color="rgba(242,244,248,0.65)"
            tracking={0.25}
            style={{ marginBottom: s(8) }}
          >
            PC STREAMING
          </T>
        )}

        {/* Trạng thái kết nối nổi bật */}
        <Animated.View style={{ transform: [{ scale: textScale }] }}>
          <T
            size={Platform.OS === 'web' ? 46 : s(32)}
            weight="bold"
            color={failure ? '#F87171' : COL_TEXT}
            tracking={-0.015}
            style={styles.centerTitle}
          >
            {displayStatus}
          </T>
        </Animated.View>

        {/* Chỉ hiện chi tiết khi bị lỗi kết nối để người dùng biết khắc phục */}
        {failure && detail ? (
          <T
            size={11.5}
            color="rgba(254,202,202,0.8)"
            style={{ marginTop: s(8), textAlign: 'center', maxWidth: width * 0.6 }}
          >
            {detail}
          </T>
        ) : null}
      </View>

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

      {/* 5. THANH TIẾN TRÌNH THANH MẢNH Ở ĐÁY MÀN HÌNH (CHUẨN METROHERO) */}
      <View
        accessibilityRole="progressbar"
        accessibilityLabel="Tiến trình kết nối"
        accessibilityValue={{ min: 0, max: 100, now: Math.round(progressPercent) }}
        style={styles.progressTrack}
      >
        <View
          style={[
            styles.progressBar,
            {
              width: `${progressPercent}%`,
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
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
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
    textShadowColor: 'rgba(0,0,0,0.75)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 24,
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
    height: 38,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.95)',
    gap: 8,
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
