import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Mức thu nhỏ khi nhấn; 1 để tắt. */
  pressScale?: number;
  children?: ReactNode;
};

/**
 * Pressable có nhịp nhún nhẹ khi chạm, thay cho `active:scale-[0.97]` của web.
 * Là CHÍNH phần tử Pressable được animate, nên flex/width/margin truyền vào
 * `style` tác động đúng vào bố cục của phần tử cha.
 */
export function Press({ style, pressScale = 0.96, onPressIn, onPressOut, children, ...rest }: Props) {
  const scale = useRef(new Animated.Value(1)).current;
  const animate = (to: number) => Animated.spring(scale, {
    toValue: to, stiffness: 420, damping: 28, mass: 0.6, useNativeDriver: true,
  }).start();
  return (
    <AnimatedPressable
      {...rest}
      style={[style, { transform: [{ scale }] }]}
      onPressIn={(event) => { if (pressScale !== 1) animate(pressScale); onPressIn?.(event); }}
      onPressOut={(event) => { if (pressScale !== 1) animate(1); onPressOut?.(event); }}
    >
      {children}
    </AnimatedPressable>
  );
}
