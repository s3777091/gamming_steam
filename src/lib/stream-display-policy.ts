// Pure display policy, shared by the native reader and stream resolver.
const REFRESH_TIERS = [60, 75, 90, 100, 120, 144, 165, 240] as const;
const FRAME_RATE_TIERS = [60, 90, 120, 144] as const;
export type AutoFrameRate = (typeof FRAME_RATE_TIERS)[number];

export function snapRefreshHz(hz: number | null): number | null {
  if (hz == null || !Number.isFinite(hz)) return null;
  let best: number | null = null;
  for (const tier of REFRESH_TIERS) {
    if (Math.abs(hz - tier) / tier > 0.06) continue;
    if (best == null || Math.abs(hz - tier) < Math.abs(hz - best)) best = tier;
  }
  return best;
}

export function autoFrameRate(refreshHz: number | null): AutoFrameRate {
  const hz = snapRefreshHz(refreshHz) ?? refreshHz;
  if (hz == null || !Number.isFinite(hz) || hz <= 0) return 60;
  let chosen: AutoFrameRate = 60;
  for (const tier of FRAME_RATE_TIERS) {
    if (tier <= hz) chosen = tier;
  }
  return chosen;
}

/** Supported rates must belong to the current pixel mode, not a lower resolution. */
export function preferredRefreshHz(current: number | null, supported: readonly number[] = []): number | null {
  const rates = [current, ...supported].filter(
    (rate): rate is number => typeof rate === 'number' && Number.isFinite(rate) && rate > 0,
  );
  if (!rates.length) return null;
  const fastest = Math.max(...rates);
  return snapRefreshHz(fastest) ?? fastest;
}

/** Round UP the budget; geometry still stops at the panel's real pixel width. */
export function panelResolution(width: number): '720p' | '900p' | '1080p' | '1440p' | '1800p' | '4k' {
  if (!(width > 1280)) return '720p';
  if (width <= 1600) return '900p';
  if (width <= 1920) return '1080p';
  if (width <= 2560) return '1440p';
  if (width <= 3200) return '1800p';
  return '4k';
}

/** Cloud defaults may be pinned for a desktop. Native starts with this panel. */
export const DEVICE_STREAM_DEFAULTS = {
  profile: 'auto', resolution: 'auto', frame_rate: null,
  bitrate_mode: 'adaptive', bitrate_mbps: null, dynamic_resolution: true,
} as const;
