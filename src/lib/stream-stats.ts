export type StatsRow = Record<string, unknown> & { type?: string };

export type StreamStats = {
  sampledAt: number;
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

export type StreamSample = {
  id: unknown;
  at: number;
  bytes: number | null;
  lost: number | null;
  received: number | null;
};

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Measure the selected WebRTC route, never infer separate Wi-Fi/cellular RTTs. */
export function readStreamStats(rows: StatsRow[], previous: StreamSample | null, now = Date.now()) {
  const stats: StreamStats = {
    sampledAt: now, rttMs: null, jitterMs: null, lossPercent: null, fps: null,
    bitrateMbps: null, dropped: null, route: null, width: null, height: null,
  };
  const byId = new Map(rows.map((row) => [row.id, row]));
  const video = rows.find((row) => row.type === 'inbound-rtp'
    && (row.kind === 'video' || row.mediaType === 'video'));
  let sample: StreamSample | null = null;
  if (video) {
    stats.fps = number(video.framesPerSecond);
    stats.dropped = number(video.framesDropped);
    stats.width = number(video.frameWidth);
    stats.height = number(video.frameHeight);
    const jitter = number(video.jitter);
    stats.jitterMs = jitter === null ? null : jitter * 1000;
    sample = {
      id: video.id ?? video.ssrc, at: number(video.timestamp) ?? now,
      bytes: number(video.bytesReceived), lost: number(video.packetsLost),
      received: number(video.packetsReceived),
    };
    if (previous && sample.id === previous.id && sample.at > previous.at) {
      if (sample.bytes !== null && previous.bytes !== null && sample.bytes >= previous.bytes) {
        stats.bitrateMbps = (sample.bytes - previous.bytes) * 8 / (sample.at - previous.at) / 1000;
      }
      if (sample.received !== null && previous.received !== null && sample.received >= previous.received
        && sample.lost !== null && previous.lost !== null) {
        const received = sample.received - previous.received;
        const lost = Math.max(0, sample.lost - previous.lost);
        if (received + lost > 0) stats.lossPercent = lost / (received + lost) * 100;
      }
    }
  }
  const transport = rows.find((row) => row.type === 'transport' && row.selectedCandidatePairId
    && (!video?.transportId || video.transportId === row.id));
  const selected = transport ? byId.get(transport.selectedCandidatePairId) : undefined;
  const candidates = rows.filter((row) => row.type === 'candidate-pair' && row.state === 'succeeded');
  const explicit = candidates.filter((row) => row.selected === true);
  const nominated = candidates.filter((row) => row.nominated === true);
  const pair = selected ?? (explicit.length === 1 ? explicit[0] : nominated.length === 1 ? nominated[0] : undefined);
  if (pair) {
    const rtt = number(pair.currentRoundTripTime);
    stats.rttMs = rtt === null ? null : Math.max(0, rtt * 1000);
    const local = byId.get(pair.localCandidateId);
    const remote = byId.get(pair.remoteCandidateId);
    stats.route = local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? 'Relay'
      : local?.candidateType === 'host' && remote?.candidateType === 'host' ? 'Direct (LAN)' : 'Direct';
  }
  return { stats, sample };
}

/** Recommendations require measured packet deltas, including a measured zero loss. */
export function streamQuality(stats: StreamStats | null): 'good' | 'fair' | 'poor' | null {
  if (stats?.rttMs == null || stats.lossPercent == null) return null;
  if (stats.rttMs > 90 || stats.lossPercent > 3 || (stats.jitterMs ?? 0) > 30) return 'poor';
  if (stats.rttMs > 50 || stats.lossPercent > 1 || (stats.jitterMs ?? 0) > 15) return 'fair';
  return 'good';
}

export class StreamStatsStore {
  private snapshot: { stats: StreamStats | null; live: boolean } = { stats: null, live: false };
  private readonly listeners = new Set<() => void>();
  getSnapshot = () => this.snapshot;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };
  publish(stats: StreamStats | null, live: boolean) {
    if (this.snapshot.stats === stats && this.snapshot.live === live) return;
    this.snapshot = { stats, live };
    this.listeners.forEach((listener) => listener());
  }
}
