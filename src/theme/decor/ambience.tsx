// Ánh sáng và không khí của nền theo từng theme: bokeh xa, sương, ánh trăng, vệt sáng.
// Chỉ là quầng sáng mềm và rất nhạt — gợi không khí, không vẽ đồ vật đè lên giao diện.

import { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useUi } from '@/ui/scale';

import { alpha } from '../color';
import { useTheme } from '../ThemeProvider';
import type { AmbienceKind } from '../types';
import { Glow } from './glow';
import { Aurora, Fireworks, MoonBat, ShootingStar } from './moments';
import { particleProgress, useLoop, useSwing } from './motion';

/** Quầng bokeh: vị trí theo tỉ lệ màn hình, thở chậm (mờ – rõ) lệch nhịp nhau. */
type Bokeh = { x: number; y: number; size: number; color: string; opacity: number };

function BokehField({ lights, running, drift = 0 }: { lights: Bokeh[]; running: boolean; drift?: number }) {
  const { s, width, height } = useUi();
  const loop = useLoop(9000, running);
  return (
    <>
      {lights.map((b, i) => {
        const size = s(b.size);
        const breath = particleProgress(loop, 1, (i * 0.29) % 1);
        return (
          <Animated.View
            key={i}
            renderToHardwareTextureAndroid
            style={{
              position: 'absolute',
              left: b.x * width - size / 2,
              top: b.y * height - size / 2,
              opacity: breath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.55, 1, 0.55] }),
              transform: [{ translateY: breath.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -s(drift), 0] }) }],
            }}
          >
            <Glow width={size} color={b.color} opacity={b.opacity} />
          </Animated.View>
        );
      })}
    </>
  );
}

/** Noel: sương giá phủ nhẹ mép trên, cực quang mờ, đèn Giáng sinh nhoè ở xa. */
function Frost({ running }: { running: boolean }) {
  const { s, width } = useUi();
  const lights = useMemo<Bokeh[]>(
    () => [
      { x: 0.08, y: 0.08, size: 90, color: '#ff5a5a', opacity: 0.1 },
      { x: 0.34, y: 0.02, size: 70, color: '#ffd36b', opacity: 0.09 },
      { x: 0.6, y: 0.06, size: 84, color: '#4fd18b', opacity: 0.08 },
      { x: 0.86, y: 0.03, size: 100, color: '#7cc4ff', opacity: 0.09 },
      { x: 0.95, y: 0.9, size: 120, color: '#ff5a5a', opacity: 0.07 },
    ],
    [],
  );
  const bloomW = s(240);
  const bloomH = s(150);
  return (
    <>
      <LinearGradient colors={['rgba(214, 232, 255, 0.10)', 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: s(80) }} />
      <View style={{ position: 'absolute', left: -bloomW * 0.35, top: -bloomH * 0.45 }}>
        <Glow width={bloomW} height={bloomH} color="#e3efff" opacity={0.12} />
      </View>
      <View style={{ position: 'absolute', left: width - bloomW * 0.65, top: -bloomH * 0.45 }}>
        <Glow width={bloomW} height={bloomH} color="#e3efff" opacity={0.12} />
      </View>
      <Aurora running={running} />
      <BokehField lights={lights} running={running} />
    </>
  );
}

/** Halloween: ánh trăng góc trên (thỉnh thoảng dơi bay qua), hai dải sương tím trôi sát mép dưới. */
function Fog({ running }: { running: boolean }) {
  const { s, width, height } = useUi();
  const a = useSwing(26_000, running);
  const b = useSwing(34_000, running);
  const moon = s(280);
  const mistW = width * 0.9;
  const mistH = s(150);
  return (
    <>
      <View style={{ position: 'absolute', left: width - moon * 0.6, top: -moon * 0.45 }}>
        <Glow width={moon} color="#ffd9a0" opacity={0.1} />
      </View>
      <MoonBat running={running} />
      {[
        { v: a, x: -width * 0.1, dir: 1, opacity: 0.16 },
        { v: b, x: width * 0.25, dir: -1, opacity: 0.12 },
      ].map((m, i) => (
        <Animated.View
          key={i}
          renderToHardwareTextureAndroid
          style={{
            position: 'absolute',
            left: m.x,
            top: height - mistH * 0.6,
            transform: [{ translateX: m.v.interpolate({ inputRange: [0, 1], outputRange: [0, m.dir * s(70)] }) }],
          }}
        >
          <Glow width={mistW} height={mistH} color="#b9a3ff" opacity={m.opacity} core={0.2} />
        </Animated.View>
      ))}
    </>
  );
}

/** Tết: bokeh đỏ – vàng ấm như đèn lồng ở xa, lác đác pháo hoa nở. */
function LanternGlow({ running }: { running: boolean }) {
  const lights = useMemo<Bokeh[]>(
    () => [
      { x: 0.06, y: 0.1, size: 110, color: '#ff4b3a', opacity: 0.13 },
      { x: 0.28, y: 0.0, size: 80, color: '#ffc45c', opacity: 0.1 },
      { x: 0.55, y: 0.05, size: 96, color: '#ff4b3a', opacity: 0.1 },
      { x: 0.8, y: 0.0, size: 76, color: '#ffc45c', opacity: 0.11 },
      { x: 0.96, y: 0.14, size: 120, color: '#ff4b3a', opacity: 0.12 },
      { x: 0.04, y: 0.92, size: 130, color: '#ffc45c', opacity: 0.08 },
    ],
    [],
  );
  return (
    <>
      <BokehField lights={lights} running={running} drift={6} />
      <Fireworks running={running} />
    </>
  );
}

/** Legend: viền sáng vàng rất nhạt, quầng tím hoàng gia, vệt sáng lướt chéo và sao băng thỉnh thoảng. */
function GoldSheen({ running }: { running: boolean }) {
  const { colors } = useTheme();
  const { s, width, height } = useUi();
  const sweep = useLoop(11_000, running);
  const band = s(200);
  const edge = alpha(colors.accent, 0.07);
  const royal = s(320);
  return (
    <>
      <LinearGradient colors={[edge, 'transparent']} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: s(60) }} />
      <LinearGradient colors={['transparent', edge]} style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: s(60) }} />
      <View style={{ position: 'absolute', left: -royal * 0.4, top: height - royal * 0.6 }}>
        <Glow width={royal} color={colors.primary} opacity={0.14} />
      </View>
      <Animated.View
        renderToHardwareTextureAndroid
        style={{
          position: 'absolute',
          top: -height * 0.25,
          width: band,
          height: height * 1.5,
          transform: [
            // Lướt qua trong ~1/4 chu kỳ rồi nghỉ, để không thành nhấp nháy liên tục.
            { translateX: sweep.interpolate({ inputRange: [0, 0.25, 1], outputRange: [-band * 1.5, width + band, width + band] }) },
            { rotate: '18deg' },
          ],
        }}
      >
        <LinearGradient
          colors={['transparent', alpha(colors.accentGlow, 0.08), 'transparent']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
      <ShootingStar running={running} />
    </>
  );
}

export function ThemeAmbience({ kind, running }: { kind: AmbienceKind; running: boolean }) {
  switch (kind) {
    case 'frost':
      return <Frost running={running} />;
    case 'fog':
      return <Fog running={running} />;
    case 'lanternGlow':
      return <LanternGlow running={running} />;
    case 'goldSheen':
      return <GoldSheen running={running} />;
  }
}
