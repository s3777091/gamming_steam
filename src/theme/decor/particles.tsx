// Hạt trôi trong nền theo từng theme. Nguyên tắc: ít, nhỏ, mờ, nhiều lớp chiều sâu
// (lớp xa nhỏ và chậm, lớp gần to nhưng nhoè và rất nhạt), chuyển động chậm.
// Mọi chuyển động chạy native từ một vòng lặp chung cho mỗi nhóm hạt.

import { useMemo, type ReactNode } from 'react';
import { Animated, View } from 'react-native';

import { useUi } from '@/ui/scale';

import { useTheme } from '../ThemeProvider';
import type { ParticleKind } from '../types';
import { Glow } from './glow';
import { particleProgress, rand, useLoop } from './motion';

type Range = [number, number];

/** Một lớp chiều sâu: số hạt, cỡ, độ đậm, tốc độ (vòng / chu kỳ chung) và độ lắc. */
type Tier = { count: number; size: Range; opacity: Range; speed: Range; sway: Range };

/** Biến đổi thêm cho từng hạt (xoay, lật). */
type Transform = { rotate: Animated.AnimatedInterpolation<string> } | { scaleX: Animated.AnimatedInterpolation<number> };

type Particle = { x: number; size: number; opacity: number; speed: number; phase: number; sway: number; i: number };

const pick = ([a, b]: Range, r: number) => a + (b - a) * r;

function useParticles(tiers: Tier[], salt: number): Particle[] {
  const { s, width } = useUi();
  return useMemo(() => {
    const out: Particle[] = [];
    let i = 0;
    for (const tier of tiers) {
      for (let k = 0; k < tier.count; k++, i++) {
        out.push({
          i,
          x: rand(i, salt) * width,
          size: s(pick(tier.size, rand(i, salt + 1))),
          opacity: pick(tier.opacity, rand(i, salt + 2)),
          speed: Math.round(pick(tier.speed, rand(i, salt + 3))),
          phase: rand(i, salt + 4),
          sway: s(pick(tier.sway, rand(i, salt + 5))),
        });
      }
    }
    return out;
  }, [s, salt, tiers, width]);
}

/** Hạt trôi dọc màn hình (rơi xuống hoặc bay lên), lắc nhẹ hai bên. */
function Drift({
  p,
  loop,
  rise = false,
  travel = 1,
  fade,
  extra = [],
  children,
}: {
  p: Particle;
  loop: Animated.Value;
  rise?: boolean;
  /** Phần chiều cao màn hình hạt đi hết (1 = cả màn). */
  travel?: number;
  /** Đường cong độ đậm theo tiến trình; mặc định giữ nguyên. */
  fade?: { input: number[]; output: number[] };
  extra?: Transform[];
  children: ReactNode;
}) {
  const { height } = useUi();
  const progress = particleProgress(loop, p.speed, p.phase);
  const top = -p.size * 2;
  const bottom = height + p.size * 2;
  const from = rise ? bottom : top;
  const to = rise ? bottom - (bottom - top) * travel : bottom;
  return (
    <Animated.View
      renderToHardwareTextureAndroid
      style={{
        position: 'absolute',
        left: p.x,
        top: 0,
        width: p.size,
        height: p.size,
        opacity: fade ? progress.interpolate({ inputRange: fade.input, outputRange: fade.output.map((o) => o * p.opacity) }) : p.opacity,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [from, to] }) },
          { translateX: progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [0, p.sway, 0, -p.sway, 0] }) },
          ...extra,
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

const SNOW: Tier[] = [
  { count: 14, size: [1.6, 2.6], opacity: [0.35, 0.55], speed: [6, 8], sway: [6, 12] },
  { count: 6, size: [3, 4.2], opacity: [0.5, 0.7], speed: [9, 11], sway: [10, 18] },
  // Lớp sát ống kính: to, nhoè, rất nhạt.
  { count: 2, size: [12, 16], opacity: [0.12, 0.18], speed: [15, 16], sway: [16, 24] },
];

function Snow({ running }: { running: boolean }) {
  const loop = useLoop(120_000, running);
  const flakes = useParticles(SNOW, 31);
  return (
    <>
      {flakes.map((p) => (
        <Drift key={p.i} p={p} loop={loop}>
          <Glow width={p.size} color="#ffffff" core={p.size > 10 ? 0.1 : 0.45} />
        </Drift>
      ))}
    </>
  );
}

const EMBERS: Tier[] = [
  { count: 8, size: [2, 3.4], opacity: [0.45, 0.75], speed: [7, 10], sway: [8, 16] },
  { count: 2, size: [10, 14], opacity: [0.12, 0.18], speed: [11, 12], sway: [14, 22] },
];

function Embers({ running }: { running: boolean }) {
  const { colors } = useTheme();
  const loop = useLoop(110_000, running);
  const embers = useParticles(EMBERS, 47);
  return (
    <>
      {embers.map((p) => (
        <Drift
          key={p.i}
          p={p}
          loop={loop}
          rise
          travel={0.55}
          // Bùng sáng khi vừa bay lên, tàn dần trước khi biến mất.
          fade={{ input: [0, 0.12, 0.6, 1], output: [0, 1, 0.7, 0] }}
        >
          <Glow width={p.size} color={colors.accent} core={p.size > 8 ? 0.1 : 0.4} />
        </Drift>
      ))}
    </>
  );
}

const PETALS: Tier[] = [
  { count: 7, size: [7, 10], opacity: [0.55, 0.8], speed: [6, 9], sway: [18, 34] },
  { count: 1, size: [16, 18], opacity: [0.25, 0.3], speed: [12, 12], sway: [28, 36] },
];

function Petals({ running }: { running: boolean }) {
  const loop = useLoop(130_000, running);
  const petals = useParticles(PETALS, 59);
  return (
    <>
      {petals.map((p) => {
        const progress = particleProgress(loop, p.speed, p.phase);
        const dir = p.i % 2 ? 1 : -1;
        return (
          <Drift
            key={p.i}
            p={p}
            loop={loop}
            extra={[
              { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${dir * 300}deg`] }) },
              // Lật nhẹ như cánh hoa thật khi rơi.
              { scaleX: progress.interpolate({ inputRange: [0, 0.25, 0.5, 0.75, 1], outputRange: [1, 0.35, 1, 0.35, 1] }) },
            ]}
          >
            <View
              style={{
                width: p.size,
                height: p.size * 0.62,
                backgroundColor: p.i % 3 === 0 ? '#ffd36b' : '#ffc4d3',
                borderTopLeftRadius: p.size,
                borderBottomRightRadius: p.size,
                borderTopRightRadius: p.size * 0.18,
                borderBottomLeftRadius: p.size * 0.18,
              }}
            />
          </Drift>
        );
      })}
    </>
  );
}

const MOTES: Tier[] = [
  { count: 12, size: [1.6, 2.8], opacity: [0.3, 0.6], speed: [4, 6], sway: [6, 14] },
  { count: 2, size: [12, 16], opacity: [0.1, 0.16], speed: [7, 8], sway: [12, 20] },
];

function Motes({ running }: { running: boolean }) {
  const { colors } = useTheme();
  const loop = useLoop(120_000, running);
  const motes = useParticles(MOTES, 71);
  return (
    <>
      {motes.map((p) => (
        <Drift key={p.i} p={p} loop={loop} rise fade={{ input: [0, 0.15, 0.85, 1], output: [0, 1, 1, 0] }}>
          <Glow width={p.size} color={colors.accentGlow} core={p.size > 8 ? 0.1 : 0.45} />
        </Drift>
      ))}
    </>
  );
}

export function ThemeParticles({ kind, running }: { kind: ParticleKind; running: boolean }) {
  switch (kind) {
    case 'snow':
      return <Snow running={running} />;
    case 'embers':
      return <Embers running={running} />;
    case 'petals':
      return <Petals running={running} />;
    case 'motes':
      return <Motes running={running} />;
  }
}
