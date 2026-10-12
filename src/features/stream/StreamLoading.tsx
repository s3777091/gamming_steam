// Màn loading của stream. Bấm Play từ kệ game thì đây là màn "đang vào game":
// ảnh hero + logo chính thức + những gì PC đã tối ưu, và nó che khung hình cho
// tới khi cửa sổ game lên foreground. Mở desktop thường thì xoay ảnh theo chủ đề.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, RefreshCw } from 'lucide-react-native';

import type { PendingGameLaunch } from '@/lib/game-launch';
import { getLoadingTheme, loadingPhotoUrl, type LoadingThemeId } from '@/lib/loading-themes';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

type LoadingPhase = 'connecting' | 'waiting' | 'live' | 'error';

function Heading({ launch }: { launch: PendingGameLaunch }) {
  const { s, width } = useUi();
  const [logoFailed, setLogoFailed] = useState(false);
  const logoUrl = launch.logoUrl && !logoFailed ? launch.logoUrl : null;
  return (
    <View style={{ gap: s(8) }}>
      <T size={9} weight="semibold" color="rgba(255,255,255,0.52)" tracking={0.24}>ĐANG VÀO GAME</T>
      {logoUrl ? (
        <Img
          source={{ uri: logoUrl }}
          accessibilityLabel={launch.title}
          style={{ width: Math.min(s(350), width * 0.45), height: s(76) }}
          contentFit="contain"
          contentPosition="left"
          transition={0}
          onError={() => setLogoFailed(true)}
        />
      ) : (
        <T size={31} weight="bold" tracking={-0.025} numberOfLines={2} style={{ maxWidth: width * 0.58 }}>{launch.title}</T>
      )}
    </View>
  );
}

export function StreamLoading({
  visible, phase, status, progress, themeId, launch, highlights, detail, onRetry, onExit, onReveal,
}: {
  visible: boolean;
  phase: LoadingPhase;
  status: string;
  progress: number;
  themeId: LoadingThemeId;
  launch: PendingGameLaunch | null;
  highlights: string[];
  detail?: string | null;
  onRetry: () => void;
  onExit: () => void;
  /** Có khi stream đã sống mà loading che quá lâu: cho người chơi tự xem màn hình máy tính. */
  onReveal?: () => void;
}) {
  const { s, width, insets } = useUi();
  const canReveal = Boolean(visible && onReveal);
  const theme = getLoadingTheme(themeId);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [mounted, setMounted] = useState(visible);
  const opacity = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const kenBurns = useRef(new Animated.Value(0)).current;
  const sheen = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) setMounted(true);
    const animation = Animated.timing(opacity, {
      toValue: visible ? 1 : 0, duration: 680, easing: Easing.out(Easing.cubic), useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && !visible) setMounted(false); });
    return () => animation.stop();
  }, [opacity, visible]);

  useEffect(() => {
    if (!visible) return;
    kenBurns.setValue(0);
    const animation = Animated.timing(kenBurns, { toValue: 1, duration: 18_000, easing: Easing.out(Easing.cubic), useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [kenBurns, photoIndex, visible]);

  // Xoay ảnh nền chủ đề (chỉ khi không phải màn vào game).
  useEffect(() => {
    if (!visible || launch) return;
    const timer = setInterval(() => setPhotoIndex((value) => (value + 1) % theme.photos.length), 7_000);
    return () => clearInterval(timer);
  }, [launch, theme.photos.length, visible]);

  useEffect(() => {
    if (!visible || phase !== 'connecting') { sheen.stopAnimation(); return; }
    sheen.setValue(0);
    const animation = Animated.loop(Animated.timing(sheen, { toValue: 1, duration: 1800, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }));
    animation.start();
    return () => animation.stop();
  }, [phase, sheen, visible]);

  if (!mounted) return null;
  const failure = phase === 'error';
  const photo = theme.photos[photoIndex % theme.photos.length];
  const backdrop = launch?.heroUrl || loadingPhotoUrl(photo);
  const description = phase === 'waiting'
    ? 'Yêu cầu sẽ tự cập nhật ngay khi chủ phiên phản hồi'
    : launch ? (canReveal
      ? 'Game có launcher riêng thường đợi bạn bấm "Enter Game" — mở màn hình máy tính để bấm'
      : 'Máy tính đang được tối ưu cho trò chơi — bạn sẽ vào thẳng màn hình loading của game')
      : 'Jetsona đang mở đường truyền WebRTC trực tiếp';
  const optimizationSummary = launch && highlights.length
    ? `Đã tối ưu: ${highlights.join(' · ')}`
    : null;
  const actionWidth = Math.min(s(330), width * 0.38);

  return (
    <Animated.View style={[styles.root, { opacity }]} pointerEvents={visible ? 'auto' : 'none'} accessibilityViewIsModal>
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ scale: kenBurns.interpolate({ inputRange: [0, 1], outputRange: [1.04, 1.14] }) }] }]}>
        <Img key={backdrop} source={{ uri: backdrop }} style={StyleSheet.absoluteFill} contentFit="cover" transition={900} priority="high" />
      </Animated.View>
      <LinearGradient
        colors={launch ? ['rgba(5,8,14,0.15)', 'rgba(5,8,14,0.55)', 'rgba(5,8,14,0.96)'] : ['rgba(27,21,51,0.5)', 'rgba(7,6,15,0.95)']}
        locations={launch ? [0, 0.55, 1] : [0, 0.74]}
        style={StyleSheet.absoluteFill}
      />

      {!launch ? (
        <View style={[styles.attribution, { top: s(18) + insets.top, right: s(22) + insets.right, paddingHorizontal: s(10), paddingVertical: s(6) }]}>
          <T size={9} weight="semibold" color="rgba(255,255,255,0.38)">Ảnh: {photo.photographer} · Unsplash</T>
        </View>
      ) : null}

      <View style={[styles.content, { left: s(38) + insets.left, right: s(38) + insets.right, bottom: s(24) + insets.bottom }]}>
        <View style={[styles.copyColumn, { gap: s(13), maxWidth: width * 0.58 }]}>
          {launch ? <Heading launch={launch} /> : null}

          <View style={{ gap: s(6) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
              {failure ? <Monitor size={s(17)} color="#fca5a5" /> : <ActivityIndicator size="small" color="rgba(255,255,255,0.86)" />}
              <T size={14} weight="semibold" color={failure ? '#fecaca' : 'rgba(255,255,255,0.88)'} numberOfLines={1} style={{ flex: 1 }}>{status}</T>
            </View>
            {failure && detail ? <T size={10.5} color="rgba(255,255,255,0.35)" numberOfLines={2}>{detail}</T> : null}
            {!failure ? (
              <T size={11} weight="medium" color="rgba(255,255,255,0.55)" leading={1.48}>
                {description}
                {optimizationSummary ? `\n${optimizationSummary}` : ''}
              </T>
            ) : null}
          </View>
        </View>

        <View style={[styles.actionColumn, { width: actionWidth, gap: s(13) }]}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: s(9) }}>
            {failure ? (
              <Press onPress={onRetry} style={[styles.retry, { height: s(39), paddingHorizontal: s(17), borderRadius: s(20), gap: s(8) }]}>
                <RefreshCw size={s(16)} color="#09090b" />
                <T size={12} weight="bold" color="#09090b">Kết nối lại</T>
              </Press>
            ) : null}
            {canReveal ? (
              <Press onPress={onReveal} style={[styles.retry, { height: s(39), paddingHorizontal: s(17), borderRadius: s(20), gap: s(8) }]}>
                <Monitor size={s(16)} color="#09090b" />
                <T size={12} weight="bold" color="#09090b">Xem màn hình máy tính</T>
              </Press>
            ) : null}
            <Press onPress={onExit} style={[styles.exit, { height: s(39), paddingHorizontal: s(15), borderRadius: s(20) }]}>
              <T size={11} weight="semibold" color={colors.text3}>Thoát phiên</T>
            </Press>
          </View>

          <View
            accessibilityRole="progressbar"
            accessibilityLabel="Tiến trình mở trò chơi"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(progress) }}
            style={{ height: s(3), overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.16)' }}
          >
            <View
              style={{
                height: '100%', width: `${Math.max(failure ? progress - 22 : progress, 6)}%`,
                backgroundColor: failure ? 'rgba(248,113,113,0.82)' : 'rgba(255,255,255,0.9)',
              }}
            />
            {phase === 'connecting' ? (
              <Animated.View
                style={{
                  position: 'absolute', top: 0, bottom: 0, width: s(90), backgroundColor: 'rgba(255,255,255,0.3)',
                  transform: [{ translateX: sheen.interpolate({ inputRange: [0, 1], outputRange: [-s(100), actionWidth] }) }],
                }}
              />
            ) : null}
          </View>
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 30, elevation: 30, overflow: 'hidden', backgroundColor: '#07060f' },
  content: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  copyColumn: { flex: 1 },
  actionColumn: { alignItems: 'stretch' },
  attribution: {
    position: 'absolute',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  retry: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  exit: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(0,0,0,0.15)',
  },
});
