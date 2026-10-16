import { useContext, useEffect, useMemo } from 'react';
import { Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { alpha, useTheme } from '@/theme';
import { UiContext } from './scale';
import { useMotion } from './motion';

/**
 * Viền tiêu điểm chuẩn Console Liquid Glass (đồng bộ theo phong cách ảnh 2):
 *
 * Gồm hệ thống viền đa tầng tạo cảm giác kính nổi 3D đa chiều:
 * 1. Viền specular trong (Inner Specular Edge): Nét trắng ánh kim mảnh sát mép phần tử,
 *    độ mờ vừa phải (~0.58), giúp định hình sắc nét đối tượng đang chọn mà không bị thô cứng.
 * 2. Viền quầng sáng nổi ngoài (Outer Floating Halo): Nét thanh mảnh nổi tự do cách mép
 *    phần tử một khoảng gap tỉ lệ, ánh xanh cyan/white dịu mắt, thở nhẹ theo chu kỳ sin êm ái.
 * 3. Dải tán sắc mờ ngoài cùng (Ambient Bloom): Tỏa sáng nhẹ giúp tạo chiều sâu quang học.
 *
 * - `card` & `glassCard`: Dành cho thẻ game, nút, icon tròn, pill... Tự động co giãn khoảng gap
 *   theo kích thước phần tử để nút nhỏ không bị quầng sáng quá xa.
 * - `row`: Cho hàng cài đặt, danh sách. Dùng viên nang kính nổi lùi vào trong (inset floating glass)
 *   để không bao giờ bị bo góc cha (overflow: hidden) cắt phạm và đồng bộ tuyệt đối với phong cách ảnh 2.
 */
export function FocusRing({
  radius,
  variant = 'card',
  tint = 'accent',
  isSmall: isSmallProp,
  visible = true,
  onHidden,
}: {
  radius: number;
  variant?: 'card' | 'glassCard' | 'row';
  tint?: 'accent' | 'danger';
  isSmall?: boolean;
  visible?: boolean;
  onHidden?: () => void;
}) {
  const { colors, glass, material } = useTheme();
  const ui = useContext(UiContext);
  const { active, reduceMotion } = useMotion();
  const s = ui ? ui.s : (n: number) => n;

  const appear = useMemo(() => new Animated.Value(0), []);
  const breathe = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const animation = Animated.timing(appear, {
      toValue: visible ? 1 : 0,
      duration: reduceMotion ? 0 : visible ? 180 : 130,
      easing: visible ? Easing.bezier(0.16, 1, 0.3, 1) : Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start(({ finished }) => {
      if (finished && !visible) onHidden?.();
    });
    return () => animation.stop();
  }, [appear, onHidden, reduceMotion, visible]);

  useEffect(() => {
    if (!visible || !active || reduceMotion) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(breathe, {
          toValue: 1,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
        Animated.timing(breathe, {
          toValue: 0,
          duration: 1250,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
          isInteraction: false,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [active, breathe, reduceMotion, visible]);

  const isDanger = tint === 'danger';

  // Biến thể HÀNG (Settings Row / Danh sách)
  if (variant === 'row') {
    const isInsetRow = radius <= 0;
    const hInset = isInsetRow ? s(5) : 0;
    const vInset = isInsetRow ? s(2.5) : 0;
    const pillRadius = isInsetRow ? s(10) : radius;

    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: appear,
          transform: [
            {
              scale: appear.interpolate({
                inputRange: [0, 1],
                outputRange: [0.985, 1],
              }),
            },
          ],
        }}
      >
        {/* Lớp tán sắc mờ ngoài cùng (Ambient Bloom) */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: vInset - s(4),
            bottom: vInset - s(4),
            left: hInset - s(4),
            right: hInset - s(4),
            borderRadius: pillRadius + s(4),
            borderWidth: 1.5,
            borderColor: isDanger ? 'rgba(239, 68, 68, 0.16)' : alpha(colors.accent, 0.16),
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.75, 0.35] }),
          }}
        />

        {/* Viền quầng sáng nổi ngoài (Outer Floating Halo) đồng bộ ảnh 2 */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: vInset - s(2),
            bottom: vInset - s(2),
            left: hInset - s(2),
            right: hInset - s(2),
            borderRadius: pillRadius + s(2),
            borderWidth: 1.25,
            borderColor: isDanger ? 'rgba(248, 113, 113, 0.40)' : alpha(colors.accentSoft, 0.38),
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.58] }),
          }}
        />

        {/* Lớp nền kính Liquid Glass mờ nhẹ, êm dịu ("nhẹ tí") */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: vInset,
            bottom: vInset,
            left: hInset,
            right: hInset,
            borderRadius: pillRadius,
            backgroundColor: isDanger ? 'rgba(239, 68, 68, 0.08)' : glass.surfaceUltraThin,
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.8] }),
            overflow: 'hidden',
          }}
        >
          {/* Ánh phản quang mép trên (Top rim specular sheen) */}
          <LinearGradient
            colors={material.rim}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 1.2,
            }}
          />
        </Animated.View>

        {/* Viền specular trong (Inner Specular Edge) thanh lịch, sắc sảo */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: vInset,
            bottom: vInset,
            left: hInset,
            right: hInset,
            borderRadius: pillRadius,
            borderWidth: 1.1,
            borderColor: isDanger ? 'rgba(255, 140, 130, 0.80)' : material.focusInner,
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 0.75] }),
          }}
        />
      </Animated.View>
    );
  }

  // Biến thể CARD / GLASSCARD (Thẻ game, Nút, Icon, Tab, Pill... Chuẩn phong cách ảnh 2)
  const isSmall = isSmallProp ?? (radius <= 18);
  const gap = isSmall ? s(2.5) : s(4.5);
  const bloomOffset = isSmall ? s(1.5) : s(2.5);
  const innerRingWidth = isSmall ? 1.1 : 1.25;
  const outerRingWidth = isSmall ? 1.2 : 1.4;
  const bloomWidth = isSmall ? 1.5 : 2;

  const band = (inset: number, width: number, color: string, alpha: number, extra: number) => ({
    position: 'absolute' as const,
    top: -inset,
    left: -inset,
    right: -inset,
    bottom: -inset,
    borderRadius: Math.max(0, radius + inset),
    borderWidth: width,
    borderColor: color,
    opacity: breathe.interpolate({
      inputRange: [0, 1],
      outputRange: [alpha, alpha * (1 - extra)],
    }),
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        opacity: appear,
        transform: [
          {
            scale: appear.interpolate({
              inputRange: [0, 1],
              outputRange: [0.975, 1],
            }),
          },
        ],
      }}
    >
      {/* 1. Dải tán sắc mờ ngoài cùng (Ambient Bloom) */}
      <Animated.View
        pointerEvents="none"
        style={band(
          gap + bloomOffset,
          bloomWidth,
          isDanger ? 'rgba(239, 68, 68, 0.18)' : alpha(colors.accent, 0.16),
          0.8,
          0.45,
        )}
      />

      {/* 2. Viền quầng sáng nổi ngoài (Outer Floating Halo) — đúng như ảnh 2 */}
      <Animated.View
        pointerEvents="none"
        style={band(
          gap,
          outerRingWidth,
          isDanger ? 'rgba(248, 113, 113, 0.45)' : alpha(colors.accentSoft, 0.38),
          1,
          0.42,
        )}
      />

      {/* 3. Viền specular trong (Inner Specular Edge) ôm khít mép đối tượng */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -0.5,
          left: -0.5,
          right: -0.5,
          bottom: -0.5,
          borderRadius: Math.max(0, radius + 0.5),
          borderWidth: innerRingWidth,
          borderColor: isDanger ? 'rgba(255, 140, 130, 0.85)' : material.focusInner,
          opacity: breathe.interpolate({
            inputRange: [0, 1],
            outputRange: [1, 0.72],
          }),
        }}
      />
    </Animated.View>
  );
}
