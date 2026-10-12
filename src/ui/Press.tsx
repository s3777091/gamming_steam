import { useEffect, useRef, type ReactNode } from 'react';
import {
  Animated, Pressable, StyleSheet, View, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle,
} from 'react-native';

import { useFocusable } from '@/features/gamepad/focus';
import { FocusRing } from './FocusRing';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Mức thu nhỏ khi nhấn; 1 để tắt. */
  pressScale?: number;
  /** false: bỏ qua khi điều hướng bằng tay cầm (nút trang trí, vùng bắt chạm phụ). */
  focusable?: boolean;
  /** Ô được chọn đầu tiên khi tay cầm bắt đầu điều hướng trong màn/lớp này. */
  autoFocus?: boolean;
  /** Bo góc của viền tiêu điểm khi bo góc nằm ở phần tử con chứ không ở `style`. */
  focusRadius?: number;
  /** Gọi khi tay cầm chuyển tiêu điểm vào ô này (xem trước game, chọn tab...). */
  onFocused?: () => void;
  /** Slider: nhận D-pad trái/phải khi đang được chọn; trả true nếu đã xử lý. */
  onAdjust?: (step: -1 | 1) => boolean;
  children?: ReactNode;
};

const FOCUS_SCALE = 1.045;
const PRESS_FLASH_MS = 110;

/**
 * Pressable có nhịp nhún nhẹ khi chạm, thay cho `active:scale-[0.97]` của web.
 * Là CHÍNH phần tử Pressable được animate, nên flex/width/margin truyền vào
 * `style` tác động đúng vào bố cục của phần tử cha.
 *
 * Đồng thời là một ô điều hướng bằng tay cầm: D-pad chuyển tiêu điểm sang ô này,
 * viền trắng + phóng nhẹ cho biết ô đang chọn, A kích hoạt `onPress`.
 */
export function Press({
  style, pressScale = 0.96, onPressIn, onPressOut, onPress, focusable = true, autoFocus = false, focusRadius, onAdjust, onFocused, children, ...rest
}: Props) {
  const hostRef = useRef<View>(null);
  const scale = useRef(new Animated.Value(1)).current;
  const focusScale = useRef(new Animated.Value(1)).current;
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const animate = (to: number) => Animated.spring(scale, {
    toValue: to, stiffness: 420, damping: 28, mass: 0.6, useNativeDriver: true,
  }).start();

  const focused = useFocusable({
    ref: hostRef,
    enabled: focusable && Boolean(onPress),
    disabled: Boolean(rest.disabled),
    autoFocus,
    adjust: onAdjust,
    onPress: () => {
      if (pressScale !== 1) {
        animate(pressScale);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => animate(1), PRESS_FLASH_MS);
      }
      onPress?.({ nativeEvent: {} } as GestureResponderEvent);
    },
  });

  const onFocusedRef = useRef(onFocused);
  onFocusedRef.current = onFocused;
  useEffect(() => {
    Animated.spring(focusScale, {
      toValue: focused ? FOCUS_SCALE : 1, stiffness: 320, damping: 26, mass: 0.7, useNativeDriver: true,
    }).start();
    if (focused) onFocusedRef.current?.();
  }, [focusScale, focused]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const radius = focusRadius ?? Number(StyleSheet.flatten(style)?.borderRadius ?? 12);
  return (
    <AnimatedPressable
      {...rest}
      ref={hostRef}
      onPress={onPress}
      style={[style, { transform: [{ scale }, { scale: focusScale }] }]}
      onPressIn={(event) => { if (pressScale !== 1) animate(pressScale); onPressIn?.(event); }}
      onPressOut={(event) => { if (pressScale !== 1) animate(1); onPressOut?.(event); }}
    >
      {children}
      {focused ? <FocusRing radius={radius} /> : null}
    </AnimatedPressable>
  );
}
