// Performance HUD: dải mỏng kính mờ ở góc, đọc số liệu thật từ WebRTC (RTT,
// jitter, mất gói, đường ICE, bitrate, khung rớt, fps). Chỉ chạy khi HUD bật.

import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

import type { NativeMoonlightClient } from '@/lib/moonlight-native';
import { colors, glass, glassShadowSubtle } from '@/theme';
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

type Row = Record<string, unknown> & { type?: string };

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readStats(rows: Row[], previous: { bytes: number; at: number } | null): { stats: Stats; sample: { bytes: number; at: number } | null } {
  const stats: Stats = { ...EMPTY };
  let sample: { bytes: number; at: number } | null = previous;
  const byId = new Map<string, Row>();
  rows.forEach((row) => { if (typeof row.id === 'string') byId.set(row.id, row); });
  for (const row of rows) {
    if (row.type === 'inbound-rtp' && (row.kind === 'video' || row.mediaType === 'video')) {
      stats.fps = number(row.framesPerSecond);
      stats.dropped = number(row.framesDropped);
      stats.width = number(row.frameWidth);
      stats.height = number(row.frameHeight);
      const jitter = number(row.jitter);
      stats.jitterMs = jitter === null ? null : jitter * 1000;
      const lost = number(row.packetsLost) ?? 0;
      const received = number(row.packetsReceived) ?? 0;
      stats.lossPercent = received + lost > 0 ? (lost / (received + lost)) * 100 : 0;
      const bytes = number(row.bytesReceived);
      const at = number(row.timestamp) ?? Date.now();
      if (bytes !== null) {
        if (previous && at > previous.at) stats.bitrateMbps = ((bytes - previous.bytes) * 8) / ((at - previous.at) / 1000) / 1e6;
        sample = { bytes, at };
      }
    } else if (row.type === 'candidate-pair' && (row.selected === true || row.nominated === true) && row.state === 'succeeded') {
      const rtt = number(row.currentRoundTripTime);
      if (rtt !== null) stats.rttMs = rtt * 1000;
      const local = typeof row.localCandidateId === 'string' ? byId.get(row.localCandidateId) : undefined;
      const type = local && typeof local.candidateType === 'string' ? local.candidateType : null;
      stats.route = type === 'relay' ? 'Relay' : type === 'host' ? 'Direct (LAN)' : type ? 'Direct' : null;
    }
  }
  return { stats, sample };
}

function Cell({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  const { s } = useUi();
  return (
    <View style={{ alignItems: 'center', minWidth: s(46) }}>
      <T size={8.4} weight="semibold" color={colors.text4} tracking={0.08}>{label}</T>
      <T size={11.4} weight="semibold" color={warn ? '#fcd34d' : colors.text} tabular style={{ marginTop: s(1) }}>{value}</T>
    </View>
  );
}

export function StreamHud({ client, enabled, top, left }: { client: NativeMoonlightClient | null; enabled: boolean; top: number; left: number }) {
  const { s } = useUi();
  const [stats, setStats] = useState<Stats>(EMPTY);
  const previous = useRef<{ bytes: number; at: number } | null>(null);

  useEffect(() => {
    if (!enabled || !client) return;
    let disposed = false;
    // Chẩn đoán cục bộ (không liên quan trạng thái phiên): đọc thống kê mỗi giây khi HUD đang hiện.
    const tick = async () => {
      const rows = await client.getStats() as Row[];
      if (disposed || !rows.length) return;
      const next = readStats(rows, previous.current);
      previous.current = next.sample;
      setStats(next.stats);
    };
    void tick();
    const timer = setInterval(() => void tick(), 1000);
    return () => { disposed = true; clearInterval(timer); previous.current = null; };
  }, [client, enabled]);

  if (!enabled) return null;
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
      {stats.width && stats.height ? <Cell label="ẢNH" value={`${stats.width}×${stats.height}`} /> : null}
    </View>
  );
}
