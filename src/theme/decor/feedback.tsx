import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useSceneActive } from '@/features/gamepad/focus';
import { useMotion } from '@/ui/motion';
import { useUi } from '@/ui/scale';

import { alpha } from '../color';
import { useDecorEnabled, useTheme } from '../ThemeProvider';

/** Phản hồi một lần, không chờ animation trước khi thực hiện thao tác của người dùng. */
export function useSeasonFeedback(enabled = true) {
  const { material } = useTheme();
  const decorEnabled = useDecorEnabled();
  const { active, reduceMotion } = useMotion();
  const sceneActive = useSceneActive();
  const [progress] = useState(() => new Animated.Value(0));
  const animation = useRef<Animated.CompositeAnimation | null>(null);
  const allowed = enabled && decorEnabled && active && sceneActive && !reduceMotion && material.kind !== 'glass';
  const duration = material.kind === 'haunted' ? 480 : 420;

  useEffect(() => {
    if (!allowed) progress.setValue(0);
    return () => {
      const current = animation.current;
      animation.current = null;
      current?.stop();
      progress.setValue(0);
    };
  }, [allowed, material.kind, progress]);

  const play = useCallback(() => {
    if (!allowed || animation.current) return;
    progress.setValue(0);
    const current = Animated.timing(progress, {
      toValue: 1, duration, easing: Easing.out(Easing.cubic),
      useNativeDriver: true, isInteraction: false,
    });
    animation.current = current;
    current.start(() => { if (animation.current === current) animation.current = null; });
  }, [allowed, duration, progress]);
  return { progress, play, allowed };
}

/** Băng lóe ở mép, sương tím nổi nhẹ, ánh sơn mài và vệt vàng nghiêng. */
export function SeasonSweep({ progress, compact = false }: { progress: Animated.Value; compact?: boolean }) {
  const { material, colors } = useTheme();
  const { s } = useUi();
  const mist = material.kind === 'haunted';
  const travel = s(compact ? 54 : 320);
  const color = mist ? colors.primary : material.textureColor;
  return (
    <Animated.View pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[
        StyleSheet.absoluteFill,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.16, 0.62, 1], outputRange: [0, 0.6, 0.5, 0] }),
          transform: mist
            ? [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [s(12), -s(12)] }) }, { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.04] }) }]
            : [{ translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [-travel, travel] }) }, { rotate: material.kind === 'gilded' ? '22deg' : material.kind === 'lacquer' ? '-12deg' : '0deg' }],
        },
      ]}>
      <LinearGradient colors={[alpha(color, 0), alpha(color, mist ? 0.22 : 0.26), alpha(color, 0)]}
        start={{ x: 0, y: mist ? 0 : 0.5 }} end={{ x: mist ? 0 : 1, y: 1 }}
        style={[StyleSheet.absoluteFill, !mist && { left: '30%', right: '30%' }]} />
    </Animated.View>
  );
}

export function SelectionFeedback() {
  const { progress, play, allowed } = useSeasonFeedback();
  // Chụp thao tác chọn lúc mount; không phát lại khi app trở về từ nền hoặc bật lại trang trí.
  const playOnSelection = useRef(play);
  useEffect(() => {
    playOnSelection.current();
  }, []);
  return allowed ? <SeasonSweep progress={progress} /> : null;
}
