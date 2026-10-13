import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated, Pressable, StyleSheet, View, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle,
} from 'react-native';

import { useFocusable } from '@/features/gamepad/focus';
import { playUiSound, type UiSound } from '@/features/sound/UiSoundProvider';
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
  /** Dùng mép kính mảnh cho thẻ ảnh thay vì vòng focus trắng đục mặc định. */
  focusVariant?: 'auto' | 'card' | 'glassCard' | 'row';
  /** Gọi khi tay cầm chuyển tiêu điểm vào ô này (xem trước game, chọn tab...). */
  onFocused?: () => void;
  /** Slider: nhận D-pad trái/phải khi đang được chọn; trả true nếu đã xử lý. */
  onAdjust?: (step: -1 | 1) => boolean;
  /** Màu quầng sáng của viền tiêu điểm khi tay cầm chọn ('accent' hoặc 'danger'). */
  focusTint?: 'accent' | 'danger';
  /** Semantic cue for activation. `false` keeps intentionally silent hit targets silent. */
  sound?: UiSound | false;
  children?: ReactNode;
};

/** Phần tử lớn lên chừng này dp khi được chọn: thẻ nhỏ phóng nhiều, hàng dài gần như đứng yên. */
const FOCUS_GROW_DP = 14;
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
  style, pressScale = 0.96, onPressIn, onPressOut, onPress, onLayout, focusable = true, autoFocus = false, focusRadius, focusVariant = 'auto', focusTint = 'accent', onAdjust, onFocused, sound = 'select', children, ...rest
}: Props) {
  const hostRef = useRef<View>(null);
  const [box, setBox] = useState({ w: 120, h: 60 });
  const [ringShown, setRingShown] = useState(false);
  const hideRing = useCallback(() => setRingShown(false), []);
  const [scale] = useState(() => new Animated.Value(1));
  const [focusScale] = useState(() => new Animated.Value(1));
  const combinedScale = useMemo(() => Animated.multiply(scale, focusScale), [focusScale, scale]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasFocused = useRef(false);
  const animate = (to: number) => Animated.spring(scale, {
    toValue: to, stiffness: 420, damping: 28, mass: 0.6, useNativeDriver: true,
  }).start();
  const activate = useCallback((event: GestureResponderEvent) => {
    if (sound) playUiSound(sound);
    onPress?.(event);
  }, [onPress, sound]);

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
      activate({ nativeEvent: {} } as GestureResponderEvent);
    },
  });

  const row = box.w / Math.max(1, box.h) >= 3 && box.h <= 76;
  const focusGrow = row ? 1 : Math.min(1.07, Math.max(1.012, 1 + FOCUS_GROW_DP / Math.max(1, box.w)));
  useEffect(() => {
    Animated.spring(focusScale, {
      toValue: focused ? focusGrow : 1, stiffness: 320, damping: 26, mass: 0.7, useNativeDriver: true,
    }).start();
  }, [focusGrow, focusScale, focused]);
  useEffect(() => {
    const entered = focused && !wasFocused.current;
    wasFocused.current = focused;
    if (entered) {
      setRingShown(true);
      playUiSound('navigate');
      onFocused?.();
    }
  }, [focused, onFocused]);
  useEffect(() => () => clearTimeout(flashTimer.current), []);

  const radius = focusRadius ?? Number(StyleSheet.flatten(style)?.borderRadius ?? 12);
  const ringVariant = focusVariant === 'auto' ? (row ? 'row' : 'card') : focusVariant;
  return (
    <AnimatedPressable
      {...rest}
      ref={hostRef}
      onPress={activate}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        setBox((current) => (Math.abs(current.w - width) < 1 && Math.abs(current.h - height) < 1 ? current : { w: width, h: height }));
        onLayout?.(event);
      }}
      style={[style, { transform: [{ scale: combinedScale }] }]}
      onPressIn={(event) => { if (pressScale !== 1) animate(pressScale); onPressIn?.(event); }}
      onPressOut={(event) => { if (pressScale !== 1) animate(1); onPressOut?.(event); }}
    >
      {children}
      {focused || ringShown ? <FocusRing radius={radius} variant={ringVariant} tint={focusTint} visible={focused} onHidden={hideRing} /> : null}
    </AnimatedPressable>
  );
}
