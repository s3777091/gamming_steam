// Performance HUD: dải mỏng kính mờ ở góc, đọc số liệu thật từ WebRTC (RTT,
// jitter, mất gói, đường ICE, bitrate, khung rớt, fps) từ bộ đo dùng chung.

import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import { streamQuality } from '@/lib/stream-stats';
import { useStreamStats } from './useStreamTelemetry';
import { glassShadowSubtle, useTheme } from '@/theme';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

type Stats = {
  rttMs: number | null;
  jitterMs: number | null;
  lossPercent: number | null;
  fps: number | null;
  bitrateMbps: number | null;
  dropped: number | null;
  route: string | null;
  width: number | null;
  height: number | null;
};

const EMPTY: Stats = { rttMs: null, jitterMs: null, lossPercent: null, fps: null, bitrateMbps: null, dropped: null, route: null, width: null, height: null };

function Cell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { colors } = useTheme();
  const { s } = useUi();
  return (
    <View style={{ alignItems: 'center', minWidth: s(46) }}>
      <T size={8.4} weight="semibold" color={colors.text4} tracking={0.08}>{label}</T>
      <T size={11.4} weight="semibold" color={warn ? '#fcd34d' : colors.text} tabular style={{ marginTop: s(1) }}>{value}</T>
    </View>
  );
}

export function StreamHud({ enabled, ...position }: { enabled: boolean; top: number; left: number }) {
  return enabled ? <HudContent {...position} /> : null;
}

const HudContent = memo(function HudContent({ top, left }: { top: number; left: number }) {
  const { glass } = useTheme();
  const { s } = useUi();
  const { stats: measured } = useStreamStats();
  const stats = measured ?? EMPTY;
  const quality = streamQuality(measured);
  const fmt = (value: number | null, digits = 0, unit = '') => (value === null ? '—' : `${value.toFixed(digits)}${unit}`);
  return (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute', top, left, flexDirection: 'row', alignItems: 'center', gap: s(10), paddingHorizontal: s(14), paddingVertical: s(7),
        borderRadius: s(14), borderWidth: 1, borderColor: glass.borderSpecular, backgroundColor: glass.surfaceRaised, overflow: 'hidden', ...glassShadowSubtle,
      }}
    >
      <BlurView intensity={45} tint="dark" style={StyleSheet.absoluteFill} />
      <LinearGradient
        colors={['rgba(255,255,255,0.3)', 'rgba(255,255,255,0.06)', 'transparent']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 2 }}
      />
      <Cell label="RTT" value={fmt(stats.rttMs, 0, ' ms')} warn={(stats.rttMs ?? 0) > 80} />
      <Cell label="JITTER" value={fmt(stats.jitterMs, 1, ' ms')} warn={(stats.jitterMs ?? 0) > 20} />
      <Cell label="MẤT GÓI" value={fmt(stats.lossPercent, 1, '%')} warn={(stats.lossPercent ?? 0) > 1} />
      <Cell label="FPS" value={fmt(stats.fps, 0)} />
      <Cell label="BITRATE" value={fmt(stats.bitrateMbps, 1, ' Mbps')} />
      <Cell label="RỚT" value={fmt(stats.dropped, 0)} warn={(stats.dropped ?? 0) > 30} />
      <Cell label="ĐƯỜNG" value={stats.route ?? '—'} />
      <Cell label="CHẤT LƯỢNG" value={quality === 'good' ? 'Tốt' : quality === 'fair' ? 'Trung bình' : quality === 'poor' ? 'Yếu' : 'Chưa đo'} warn={quality === 'poor'} />
      {stats.width && stats.height ? <Cell label="ẢNH" value={`${stats.width}×${stats.height}`} /> : null}
    </View>
  );
});
