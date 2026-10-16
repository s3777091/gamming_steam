// Hoạt cảnh thoát game: khung stream tối dần sang artwork của game, hiện "Đang
// đóng …" trong lúc PC đóng game, rồi cả khung thu nhỏ và tan đi như một app iOS
// đóng về màn hình chính. Chỉ tan khi PC đã đóng xong (`done`), nên người dùng
// không bao giờ về kệ game trong khi game vẫn còn chạy.

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';

import type { ExitingGame } from './GuideMenu';
import { alpha, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useMotion } from '@/ui/motion';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export function ExitGameOverlay({
  game,
  done,
  onFinished,
}: {
  game: ExitingGame;
  /** PC đã đóng xong game: chạy đoạn thu nhỏ rồi gọi `onFinished`. */
  done: boolean;
  onFinished: () => void;
}) {
  const { colors } = useTheme();
  const { s, width } = useUi();
  const { reduceMotion } = useMotion();
  const [enter] = useState(() => new Animated.Value(0));
  const [leave] = useState(() => new Animated.Value(0));
  const onFinishedRef = useRef(onFinished);
  useEffect(() => { onFinishedRef.current = onFinished; });

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? 0 : 420,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  useEffect(() => {
    if (!done) return;
    const animation = Animated.timing(leave, {
      toValue: 1,
      duration: reduceMotion ? 0 : 460,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished) onFinishedRef.current(); });
    return () => animation.stop();
  }, [done, leave, reduceMotion]);

  const cardScale = Animated.multiply(
    enter.interpolate({ inputRange: [0, 1], outputRange: [1.06, 1] }),
    leave.interpolate({ inputRange: [0, 1], outputRange: [1, 0.78] }),
  );
  const cardOpacity = leave.interpolate({ inputRange: [0, 0.7, 1], outputRange: [1, 0.4, 0] });
  const textOpacity = Animated.multiply(
    enter.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
    leave.interpolate({ inputRange: [0, 0.4], outputRange: [1, 0], extrapolate: 'clamp' }),
  );

  return (
    <View style={styles.root} accessibilityViewIsModal accessibilityLabel={`Đang đóng ${game.title}`}>
      <Animated.View style={[StyleSheet.absoluteFill, styles.black, { opacity: enter }]} />
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          styles.card,
          { opacity: Animated.multiply(enter, cardOpacity), transform: [{ scale: cardScale }], borderRadius: s(28) },
        ]}
      >
        {game.heroUrl ? <Img source={{ uri: game.heroUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={[alpha(colors.bgDeep, 0.55), alpha(colors.bgDeep, 0.35), alpha(colors.bgDeep, 0.9)]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>

      <Animated.View style={[styles.center, { opacity: textOpacity }]} pointerEvents="none">
        {game.logoUrl ? (
          <Img source={{ uri: game.logoUrl }} style={{ width: Math.min(s(300), width * 0.55), height: s(70) }} contentFit="contain" />
        ) : (
          <T size={22} weight="bold" color="#ffffff" numberOfLines={2} style={styles.title}>{game.title}</T>
        )}
        <View style={[styles.status, { marginTop: s(18), gap: s(10), paddingHorizontal: s(16), paddingVertical: s(9), borderRadius: s(20) }]}>
          <ActivityIndicator size="small" color="#ffffff" />
          <T size={11.5} weight="medium" color="rgba(255,255,255,0.88)">Đang đóng game và kết thúc phiên…</T>
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFill, zIndex: 200, elevation: 200 },
  black: { backgroundColor: '#000' },
  card: { overflow: 'hidden', backgroundColor: '#0b0d14' },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: '10%' },
  title: {
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 20,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.2)',
  },
});
