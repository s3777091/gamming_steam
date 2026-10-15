import { useEffect, useState } from 'react';
import { Animated, type DimensionValue, type StyleProp, type ViewStyle } from 'react-native';
import { useSceneActive } from '@/features/gamepad/focus';
import { useMotion } from './motion';

/** Khối xám nhấp nháy khi dữ liệu đang tải. */
export function Skeleton({ width, height, radius = 8, style, tone = 0.09 }: {
  width?: DimensionValue;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
  tone?: number;
}) {
  const [pulse] = useState(() => new Animated.Value(0));
  const { active, reduceMotion } = useMotion();
  const sceneActive = useSceneActive();
  useEffect(() => {
    if (!active || reduceMotion || !sceneActive) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true, isInteraction: false }),
      Animated.timing(pulse, { toValue: 0, duration: 800, useNativeDriver: true, isInteraction: false }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, pulse, reduceMotion, sceneActive]);
  return (
    <Animated.View
      style={[
        {
          width, height, borderRadius: radius,
          backgroundColor: `rgba(255,255,255,${tone})`,
          opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }),
        },
        style,
      ]}
    />
  );
}
