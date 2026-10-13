import { useEffect, useMemo } from 'react';
import { Animated, Easing, View } from 'react-native';

const RING = 2;
const GAP = 3;

/**
 * Viền tiêu điểm của tay cầm, kiểu PS5: một nét trắng mảnh bao ngoài phần tử, bên
 * ngoài là quầng sáng mờ dần thở nhẹ. Không dùng shadow/elevation của Android vì
 * nó vẽ một khối đen đục ngay dưới phần tử bán trong suốt.
 *
 * - `card`: ảnh, thẻ, nút tròn — chỉ có viền và quầng sáng, không phủ màu lên nội dung.
 * - `row`: hàng cài đặt, nút dài — thêm một lớp sáng nhẹ để thấy rõ cả hàng đang chọn.
 *
 * Đặt làm con CUỐI của phần tử được chọn; nó tràn ra ngoài nên không đổi bố cục.
 * `visible` về false thì mờ đi rồi gọi `onHidden` để cha gỡ nó khỏi cây.
 */
export function FocusRing({ radius, variant = 'card', tint = 'accent', visible = true, onHidden }: {
  radius: number;
  variant?: 'card' | 'glassCard' | 'row';
  tint?: 'accent' | 'danger';
  visible?: boolean;
  onHidden?: () => void;
}) {
  const appear = useMemo(() => new Animated.Value(0), []);
  const breathe = useMemo(() => new Animated.Value(0), []);

  useEffect(() => {
    const animation = Animated.timing(appear, {
      toValue: visible ? 1 : 0,
      duration: visible ? 170 : 120,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start(({ finished }) => { if (finished && !visible) onHidden?.(); });
    return () => animation.stop();
  }, [appear, onHidden, visible]);

  useEffect(() => {
    if (!visible) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1100, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathe, visible]);

  const isDanger = tint === 'danger';
  const band = (inset: number, width: number, color: string, alpha: number, extra: number) => ({
    position: 'absolute' as const,
    top: -inset, left: -inset, right: -inset, bottom: -inset,
    borderRadius: radius + inset,
    borderWidth: width,
    borderColor: color,
    opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [alpha, alpha * (1 - extra)] }),
  });

  if (variant === 'row') {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          opacity: appear,
        }}
      >
        {/* Lớp phủ sáng Liquid Glass mờ cho cả hàng đang chọn */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: radius,
            backgroundColor: isDanger ? 'rgba(239, 68, 68, 0.14)' : 'rgba(102, 168, 255, 0.12)',
          }}
        />
        {/* Viền quầng sáng thở nhẹ */}
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -1, left: -1, right: -1, bottom: -1,
            borderRadius: radius + 1,
            borderWidth: 1.5,
            borderColor: isDanger ? 'rgba(248, 113, 113, 0.55)' : 'rgba(102, 168, 255, 0.45)',
            opacity: breathe.interpolate({ inputRange: [0, 1], outputRange: [0.85, 0.4] }),
          }}
        />
        {/* Viền tiêu điểm trắng specular sắc nét */}
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            borderRadius: radius,
            borderWidth: RING,
            borderColor: 'rgba(255,255,255,0.95)',
          }}
        />
      </Animated.View>
    );
  }

  if (variant === 'glassCard') {
    return (
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
          opacity: appear,
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={band(
            GAP + 4,
            2,
            isDanger ? 'rgba(248, 113, 113, 0.28)' : 'rgba(138, 192, 255, 0.28)',
            0.8,
            0.45,
          )}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -1, left: -1, right: -1, bottom: -1,
            borderRadius: radius + 1,
            borderWidth: 1.25,
            borderColor: 'rgba(255, 255, 255, 0.54)',
          }}
        />
      </Animated.View>
    );
  }

  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        opacity: appear,
      }}
    >
      {/* Quầng sáng quang học Liquid Glass */}
      <Animated.View
        pointerEvents="none"
        style={band(
          GAP + RING + 8,
          4,
          isDanger ? 'rgba(239, 68, 68, 0.22)' : 'rgba(102, 168, 255, 0.22)',
          1,
          0.5,
        )}
      />
      <Animated.View
        pointerEvents="none"
        style={band(
          GAP + RING + 3,
          3,
          isDanger ? 'rgba(248, 113, 113, 0.45)' : 'rgba(138, 192, 255, 0.42)',
          1,
          0.3,
        )}
      />
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: -GAP - RING, left: -GAP - RING, right: -GAP - RING, bottom: -GAP - RING,
          borderRadius: radius + GAP + RING,
          borderWidth: RING,
          borderColor: 'rgba(255, 255, 255, 0.98)',
        }}
      />
    </Animated.View>
  );
}
