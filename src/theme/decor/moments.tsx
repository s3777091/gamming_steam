// Khoảnh khắc đặc trưng của từng theme: hiếm, mềm, nằm trong nền — như một chi tiết
// người dùng bắt gặp chứ không phải hiệu ứng chạy liên tục.

import { useMemo } from 'react';
import { Animated, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';

import { useUi } from '@/ui/scale';

import { alpha } from '../color';
import { useTheme } from '../ThemeProvider';
import { Glow } from './glow';
import { particleProgress, useLoop, useSwing } from './motion';

/** Noel: dải cực quang xanh lục – lam mờ, thở chậm và trôi nhẹ ở mép trên. */
export function Aurora({ running }: { running: boolean }) {
  const { s, width } = useUi();
  const breath = useSwing(12_000, running);
  const drift = useSwing(22_000, running);
  const w = width * 0.75;
  const h = s(120);
  return (
    <>
      {[
        { color: '#5df2b0', x: width * 0.02, dir: 1, opacity: 0.08 },
        { color: '#4fc3f7', x: width * 0.3, dir: -1, opacity: 0.07 },
      ].map((band, i) => (
        <Animated.View
          key={i}
          renderToHardwareTextureAndroid
          style={{
            position: 'absolute',
            left: band.x,
            top: -h * 0.45,
            opacity: breath.interpolate({ inputRange: [0, 1], outputRange: i ? [1, 0.45] : [0.45, 1] }),
            transform: [{ translateX: drift.interpolate({ inputRange: [0, 1], outputRange: [0, band.dir * s(50)] }) }],
          }}
        >
          <Glow width={w} height={h} color={band.color} opacity={band.opacity} core={0.15} />
        </Animated.View>
      ))}
    </>
  );
}

const BAT_PATH =
  'M32 12 C29 7.5 27 8 26 11 C22 5 14 3.5 3 9.5 C9 11 11 14.5 10 18.5 C14 15.5 18 16.5 20 20 C22.5 16.5 26.5 17.5 28.5 20.5 C29.5 19 31 18.2 32 18.2 C33 18.2 34.5 19 35.5 20.5 C37.5 17.5 41.5 16.5 44 20 C46 16.5 50 15.5 54 18.5 C53 14.5 55 11 61 9.5 C50 3.5 42 5 38 11 C37 8 35 7.5 32 12 Z';

/** Halloween: thỉnh thoảng một con dơi nhỏ bay ngang qua ánh trăng. */
export function MoonBat({ running }: { running: boolean }) {
  const { s, width } = useUi();
  const loop = useLoop(26_000, running);
  const flap = useSwing(260, running);
  const size = s(24);
  // Bay trong ~1/3 chu kỳ, phần còn lại ẩn ngoài màn hình.
  const fly = loop.interpolate({ inputRange: [0, 0.32, 1], outputRange: [0, 1, 1] });
  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={{
        position: 'absolute',
        left: 0,
        top: s(30),
        opacity: loop.interpolate({ inputRange: [0, 0.02, 0.3, 0.32, 1], outputRange: [0, 0.75, 0.75, 0, 0] }),
        transform: [
          { translateX: fly.interpolate({ inputRange: [0, 1], outputRange: [width * 0.58, width + size] }) },
          { translateY: fly.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [s(26), s(8), s(18), s(2), s(12)] }) },
          { scaleY: flap.interpolate({ inputRange: [0, 1], outputRange: [1, 0.4] }) },
        ],
      }}
    >
      <Svg width={size} height={size / 2} viewBox="0 0 64 32">
        <Path d={BAT_PATH} fill="#1a0f24" />
      </Svg>
    </Animated.View>
  );
}

/** Tết: pháo hoa nở xa, lác đác ở nửa trên màn hình. */
export function Fireworks({ running }: { running: boolean }) {
  const { s, width, height } = useUi();
  const loop = useLoop(18_000, running);
  const bursts = useMemo(
    () => [
      { x: 0.22, y: 0.2, phase: 0, color: '#ffc45c' },
      { x: 0.72, y: 0.14, phase: 0.36, color: '#ff6b5a' },
      { x: 0.5, y: 0.3, phase: 0.68, color: '#ffd98a' },
    ],
    [],
  );
  const reach = s(48);
  const spark = s(5);
  const core = s(80);
  return (
    <>
      {bursts.map((b, i) => {
        const p = particleProgress(loop, 1, b.phase);
        const cx = b.x * width;
        const cy = b.y * height;
        return (
          <View key={i} pointerEvents="none" style={{ position: 'absolute', left: cx, top: cy }}>
            <Animated.View
              renderToHardwareTextureAndroid
              style={{
                position: 'absolute',
                left: -core / 2,
                top: -core / 2,
                opacity: p.interpolate({ inputRange: [0, 0.015, 0.16, 1], outputRange: [0, 0.6, 0, 0] }),
                transform: [{ scale: p.interpolate({ inputRange: [0, 0.06, 1], outputRange: [0.2, 1.1, 1.1] }) }],
              }}
            >
              <Glow width={core} color={b.color} opacity={0.35} />
            </Animated.View>
            {Array.from({ length: 12 }, (_, k) => {
              const a = (Math.PI * 2 * k) / 12;
              const dx = Math.cos(a) * reach;
              const dy = Math.sin(a) * reach;
              return (
                <Animated.View
                  key={k}
                  renderToHardwareTextureAndroid
                  style={{
                    position: 'absolute',
                    left: -spark / 2,
                    top: -spark / 2,
                    opacity: p.interpolate({ inputRange: [0, 0.01, 0.12, 0.22, 1], outputRange: [0, 0.9, 0.7, 0, 0] }),
                    transform: [
                      { translateX: p.interpolate({ inputRange: [0, 0.1, 0.22, 1], outputRange: [0, dx, dx * 1.08, dx * 1.08] }) },
                      // Tia bung ra rồi rơi nhẹ theo trọng lực.
                      { translateY: p.interpolate({ inputRange: [0, 0.1, 0.22, 1], outputRange: [0, dy, dy + s(14), dy + s(14)] }) },
                    ],
                  }}
                >
                  <Glow width={spark} color={k % 2 ? '#fff1c7' : b.color} core={0.4} />
                </Animated.View>
              );
            })}
          </View>
        );
      })}
    </>
  );
}

/** Legend: thỉnh thoảng một ngôi sao băng vàng vụt qua phía trên. */
export function ShootingStar({ running }: { running: boolean }) {
  const { colors } = useTheme();
  const { s, width } = useUi();
  const loop = useLoop(17_000, running);
  const from = { x: width * 0.12, y: s(24) };
  const to = { x: width * 0.62, y: s(130) };
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  const tail = s(120);
  const run = loop.interpolate({ inputRange: [0, 0.09, 1], outputRange: [0, 1, 1] });
  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: tail,
        height: s(10),
        opacity: loop.interpolate({ inputRange: [0, 0.015, 0.07, 0.09, 1], outputRange: [0, 1, 1, 0, 0] }),
        transform: [
          { translateX: run.interpolate({ inputRange: [0, 1], outputRange: [from.x - tail, to.x - tail] }) },
          { translateY: run.interpolate({ inputRange: [0, 1], outputRange: [from.y, to.y] }) },
          { rotate: `${angle}rad` },
        ],
        transformOrigin: '100% 50%',
      }}
    >
      <LinearGradient
        colors={['transparent', alpha(colors.accentGlow, 0.75)]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', left: 0, right: s(4), top: s(4), height: s(2), borderRadius: s(1) }}
      />
      <View style={{ position: 'absolute', right: -s(4), top: -s(2) }}>
        <Glow width={s(14)} color={colors.accentGlow} core={0.35} />
      </View>
    </Animated.View>
  );
}
