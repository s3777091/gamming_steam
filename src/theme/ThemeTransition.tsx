// Hiệu ứng đổi theme kiểu hoạt hình: giọt màu đặc trưng của theme mới rơi xuống điểm chạm
// (co giãn khi rơi, bẹp khi chạm), bắn tung toé, rồi ba vòng màu lan ra phủ kín màn hình.
// Theme chỉ được đổi khi màn đã phủ kín; sau đó lớp phủ tan dần để lộ giao diện mới.
// Mọi chuyển động chạy bằng native driver nên không giật khi cả app vẽ lại theme mới.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';

import { mix } from './color';
import type { Theme } from './types';

export type ThemeTransitionOrigin = { x: number; y: number };

const DROP = 48;
const FALL_MS = 420;
const SQUASH_MS = 140;
const SPLASH_MS = 620;
const WAVE_MS = 640;
const WAVE_STAGGER_MS = 80;
const REVEAL_MS = 380;
const SPLASH_COUNT = 9;

type Props = {
  theme: Theme;
  /** Điểm giọt màu chạm xuống, theo toạ độ cửa sổ. null = giữa màn hình. */
  origin: ThemeTransitionOrigin | null;
  /** Theme mới đã được áp dụng bên dưới lớp phủ: bắt đầu tan lớp phủ. */
  committed: boolean;
  onImpact?: () => void;
  onCovered: () => void;
  onDone: () => void;
};

export function ThemeTransition({ theme, origin, committed, onImpact, onCovered, onDone }: Props) {
  const { width, height } = useWindowDimensions();
  const { colors } = theme;
  const at = origin ?? { x: width / 2, y: height / 2 };

  const [fall] = useState(() => new Animated.Value(0));
  const [squash] = useState(() => new Animated.Value(0));
  const [splash] = useState(() => new Animated.Value(0));
  const [waves] = useState(() => [0, 1, 2].map(() => new Animated.Value(0)));
  const [reveal] = useState(() => new Animated.Value(1));

  const callbacks = useRef({ onImpact, onCovered, onDone });
  useEffect(() => {
    callbacks.current = { onImpact, onCovered, onDone };
  });

  // Vòng phủ phải chạm tới góc xa nhất của màn hình.
  const diameter = 2 * Math.hypot(Math.max(at.x, width - at.x), Math.max(at.y, height - at.y)) + 16;
  const fallDistance = at.y + DROP * 2;

  useEffect(() => {
    const fallAnim = Animated.timing(fall, {
      toValue: 1,
      duration: FALL_MS,
      easing: Easing.in(Easing.quad),
      useNativeDriver: true,
    });
    let impactAnim: Animated.CompositeAnimation | null = null;
    fallAnim.start(({ finished }) => {
      if (!finished) return;
      callbacks.current.onImpact?.();
      impactAnim = Animated.parallel([
        Animated.timing(squash, { toValue: 1, duration: SQUASH_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.timing(splash, { toValue: 1, duration: SPLASH_MS, easing: Easing.linear, useNativeDriver: true }),
        Animated.stagger(
          WAVE_STAGGER_MS,
          waves.map((wave) =>
            Animated.timing(wave, {
              toValue: 1,
              duration: WAVE_MS,
              easing: Easing.bezier(0.22, 1, 0.36, 1),
              useNativeDriver: true,
            }),
          ),
        ),
      ]);
      impactAnim.start((result) => {
        if (result.finished) callbacks.current.onCovered();
      });
    });
    return () => {
      fallAnim.stop();
      impactAnim?.stop();
    };
  }, [fall, squash, splash, waves]);

  useEffect(() => {
    if (!committed) return;
    // Đợi một khung hình để cây giao diện vẽ xong theme mới rồi mới tan lớp phủ.
    let anim: Animated.CompositeAnimation | null = null;
    const frame = requestAnimationFrame(() => {
      anim = Animated.timing(reveal, {
        toValue: 0,
        duration: REVEAL_MS,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      });
      anim.start(({ finished }) => {
        if (finished) callbacks.current.onDone();
      });
    });
    return () => {
      cancelAnimationFrame(frame);
      anim?.stop();
    };
  }, [committed, reveal]);

  // Giọt bắn: bay lên và toả ra hai bên rồi rơi theo trọng lực.
  const droplets = useMemo(
    () =>
      Array.from({ length: SPLASH_COUNT }, (_, i) => {
        const angle = -Math.PI * (0.1 + (0.8 * i) / (SPLASH_COUNT - 1)) + (i % 2 ? 0.12 : -0.12);
        const distance = DROP * (1.6 + (i % 3) * 0.55);
        const size = DROP * (0.16 + ((i * 7) % 5) * 0.035);
        const steps = [0, 0.25, 0.5, 0.75, 1];
        return {
          size,
          x: steps.map((t) => Math.cos(angle) * distance * t),
          y: steps.map((t) => Math.sin(angle) * distance * t + DROP * 2.2 * t * t),
        };
      }),
    [],
  );

  const outline = mix(colors.accent, '#000000', 0.4);
  const waveColors = [colors.accent, colors.primary, colors.bg];
  const steps = [0, 0.25, 0.5, 0.75, 1];

  return (
    <Animated.View
      pointerEvents="auto"
      style={[StyleSheet.absoluteFill, { zIndex: 9999, elevation: 9999, opacity: reveal }]}
    >
      {waves.map((wave, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: at.x - diameter / 2,
            top: at.y - diameter / 2,
            width: diameter,
            height: diameter,
            borderRadius: diameter / 2,
            backgroundColor: waveColors[i],
            // Viền sáng như nét mực của phim hoạt hình ở mép mỗi vòng màu.
            borderWidth: i < 2 ? 4 : 0,
            borderColor: mix(waveColors[i], '#ffffff', 0.35),
            transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [0.001, 1] }) }],
          }}
        />
      ))}

      {/* Bóng dưới đất: đậm dần khi giọt sắp chạm */}
      <Animated.View
        style={{
          position: 'absolute',
          left: at.x - DROP * 0.45,
          top: at.y - DROP * 0.11,
          width: DROP * 0.9,
          height: DROP * 0.22,
          borderRadius: DROP,
          backgroundColor: '#000000',
          opacity: Animated.multiply(
            fall.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] }),
            squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0] }),
          ),
          transform: [{ scaleX: fall.interpolate({ inputRange: [0, 1], outputRange: [0.2, 1] }) }],
        }}
      />

      {droplets.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: at.x - d.size / 2,
            top: at.y - d.size / 2,
            width: d.size,
            height: d.size,
            borderRadius: d.size / 2,
            backgroundColor: colors.accentGlow,
            borderWidth: 1.5,
            borderColor: outline,
            opacity: splash.interpolate({ inputRange: [0, 0.02, 0.65, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateX: splash.interpolate({ inputRange: steps, outputRange: d.x }) },
              { translateY: splash.interpolate({ inputRange: steps, outputRange: d.y }) },
              { scale: splash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.35] }) },
            ],
          }}
        />
      ))}

      {/* Giọt màu: kéo dài khi rơi, bẹp ra khi chạm rồi tan vào vòng màu */}
      <Animated.View
        style={{
          position: 'absolute',
          left: at.x - DROP / 2,
          top: at.y - DROP,
          width: DROP,
          height: DROP,
          transform: [
            { translateY: fall.interpolate({ inputRange: [0, 1], outputRange: [-fallDistance, 0] }) },
            { scaleX: fall.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 0.86, 0.8] }) },
            { scaleY: fall.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1.22, 1.3] }) },
          ],
        }}
      >
        <Animated.View
          style={{
            flex: 1,
            opacity: squash.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: squash.interpolate({ inputRange: [0, 1], outputRange: [0, DROP * 0.36] }) },
              { scaleX: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 2.1] }) },
              { scaleY: squash.interpolate({ inputRange: [0, 1], outputRange: [1, 0.28] }) },
            ],
          }}
        >
          <Teardrop size={DROP} color={colors.accent} outline={outline} />
        </Animated.View>
      </Animated.View>
    </Animated.View>
  );
}

/** Giọt nước kiểu hoạt hình: hình vuông bo ba góc xoay 45° để góc nhọn chĩa lên, có viền và vệt sáng. */
function Teardrop({ size, color, outline }: { size: number; color: string; outline: string }) {
  const side = size * 0.7;
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: size * 0.06 }}>
      <View
        style={{
          width: side,
          height: side,
          backgroundColor: color,
          borderWidth: 2.5,
          borderColor: outline,
          borderTopLeftRadius: 0,
          borderTopRightRadius: side / 2,
          borderBottomLeftRadius: side / 2,
          borderBottomRightRadius: side / 2,
          transform: [{ rotate: '45deg' }],
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            position: 'absolute',
            left: side * 0.2,
            top: side * 0.5,
            width: side * 0.2,
            height: side * 0.32,
            borderRadius: side,
            backgroundColor: 'rgba(255, 255, 255, 0.75)',
            transform: [{ rotate: '-45deg' }],
          }}
        />
        <View
          style={{
            position: 'absolute',
            left: side * 0.46,
            top: side * 0.74,
            width: side * 0.09,
            height: side * 0.09,
            borderRadius: side,
            backgroundColor: 'rgba(255, 255, 255, 0.6)',
          }}
        />
      </View>
    </View>
  );
}
