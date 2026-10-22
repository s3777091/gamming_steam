import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  Animated, Pressable, StyleSheet, View, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle,
} from 'react-native';

import { useFocusable } from '@/features/gamepad/focus';
import { playUiSound, type UiSound } from '@/features/sound/UiSoundProvider';
import { FocusRing } from './FocusRing';
import { useMotion } from './motion';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  /** Mức thu nhỏ khi nhấn; 1 để tắt. */
  pressScale?: number;
  /** false: bỏ qua khi điều hướng bằng tay cầm (nút trang trí, vùng bắt chạm phụ). */
  focusable?: boolean;
  /** Ô được chọn đầu tiên khi tay cầm bắt đầu điều hướng trong màn/lớp này. */
  autoFocus?: boolean;
  /** Yêu cầu chiếm tiêu điểm ngay khi giá trị chuyển sang true (dùng khi đổi tab bằng LB/RB). */
  requestFocus?: boolean;
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

/** Phần tử lớn lên chừng này dp khi được chọn: thẻ nhỏ phóng vừa phải, hàng dài gần như đứng yên. */
const FOCUS_GROW_DP = 8;
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
  style, pressScale = 0.96, onPressIn, onPressOut, onPress, onLayout, focusable = true, autoFocus = false, requestFocus = false, focusRadius, focusVariant = 'auto', focusTint = 'accent', onAdjust, onFocused, sound = 'select', children, ...rest
}: Props) {
  const hostRef = useRef<View>(null);
  const { reduceMotion } = useMotion();
  const [box, setBox] = useState({ w: 120, h: 60 });
  const [ringShown, setRingShown] = useState(false);
  const hideRing = useCallback(() => setRingShown(false), []);
  const [scale] = useState(() => new Animated.Value(1));
  const [focusScale] = useState(() => new Animated.Value(1));
  const combinedScale = useMemo(() => Animated.multiply(scale, focusScale), [focusScale, scale]);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const wasFocused = useRef(false);
  const animate = useCallback((to: number) => {
    if (reduceMotion) { scale.setValue(1); return; }
    Animated.spring(scale, {
      toValue: to, stiffness: 420, damping: 28, mass: 0.6, useNativeDriver: true, isInteraction: false,
    }).start();
  }, [reduceMotion, scale]);
  const activate = useCallback((event: GestureResponderEvent) => {
    if (sound) playUiSound(sound);
    onPress?.(event);
  }, [onPress, sound]);

  const focused = useFocusable({
    ref: hostRef,
    enabled: focusable && Boolean(onPress),
    disabled: Boolean(rest.disabled),
    autoFocus,
    requestFocus,
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

  const flatStyle = StyleSheet.flatten(style);
  const padH = Number(flatStyle?.paddingHorizontal ?? flatStyle?.paddingLeft ?? flatStyle?.padding ?? 0);
  const isWideStrip = box.w >= 160 && box.w / Math.max(1, box.h) >= 2.6 && box.h <= 88;
  const isAutoRow =
    isWideStrip &&
    box.h <= 76 &&
    flatStyle?.borderRadius === undefined &&
    focusRadius === undefined &&
    padH >= 10;
  const isRow = focusVariant === 'row' || (focusVariant === 'auto' && isAutoRow);
  const focusGrow = isRow
    ? 1
    : isWideStrip
      ? 1.008
      : Math.min(1.045, Math.max(1.01, 1 + FOCUS_GROW_DP / Math.max(1, box.w)));
  useEffect(() => {
    if (reduceMotion) {
      focusScale.setValue(1);
      return;
    }
    // Most buttons never receive gamepad focus; avoid starting an idle spring
    // for every button on mount and for every initial layout measurement.
    if (!focused && !wasFocused.current) return;
    const animation = Animated.spring(focusScale, {
      toValue: focused ? focusGrow : 1,
      stiffness: 240,
      damping: 24,
      mass: 0.8,
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [focusGrow, focusScale, focused, reduceMotion]);
  useEffect(() => {
    const entered = focused && !wasFocused.current;
    wasFocused.current = focused;
    if (entered) {
      setRingShown(true);
      playUiSound('navigate');
      onFocused?.();
    }
  }, [focused, onFocused]);
  useEffect(() => () => {
    clearTimeout(flashTimer.current);
    scale.stopAnimation();
    focusScale.stopAnimation();
  }, [focusScale, scale]);

  const ringVariant = focusVariant === 'auto' ? (isRow ? 'row' : 'card') : focusVariant;
  const radius =
    focusRadius ??
    (flatStyle?.borderRadius !== undefined
      ? Number(flatStyle.borderRadius)
      : isRow
        ? 0
        : 12);
  const isCompact = (box.h > 0 && box.h <= 88) || (box.w > 0 && box.w <= 88) || radius <= 18;
  const ring = focused || ringShown ? (
    <FocusRing
      radius={radius}
      variant={ringVariant}
      tint={focusTint}
      isSmall={isCompact}
      visible={focused}
      onHidden={hideRing}
    />
  ) : null;
  // Viền hàng là tấm kính nằm trong khung hàng: vẽ dưới nội dung để chữ và công tắc
  // không bị phủ mờ như đang bị vô hiệu hoá. Viền thẻ nằm ngoài mép nên vẽ đè lên.
  const ringBehind = ringVariant === 'row';
  return (
    <AnimatedPressable
      {...rest}
      ref={hostRef}
      accessibilityRole={rest.accessibilityRole ?? (onPress ? 'button' : undefined)}
      accessibilityState={{ ...rest.accessibilityState, disabled: Boolean(rest.disabled) }}
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
      {ringBehind ? ring : null}
      {children}
      {ringBehind ? null : ring}
    </AnimatedPressable>
  );
}
