import type { SupabaseClient } from '@supabase/supabase-js';
import type { NetworkMeasurement } from './stream-settings';

// A bandwidth sample describes one network at one moment, not a permanent
// capability of the tablet. Keeping it for days made an old weak-Wi-Fi test
// silently force every later Auto session to 720p. Thirty minutes is long
// enough to open a stream after running the test, but short enough not to
// survive a normal network/location change.
export const NETWORK_MEASUREMENT_MAX_AGE_MS = 30 * 60 * 1000;
export const NETWORK_MEASUREMENT_FUTURE_SKEW_MS = 5 * 60 * 1000;

/** Postgres can return numeric columns as strings. */
function numericOrNull(value: number | string | null | undefined): number | null {
  if (value == null) return null;
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

/**
 * Latest real network test from this exact browser/device.
 *
 * Results are not account-wide capabilities: a slow test from another laptop,
 * network or country must never lower this device's Auto stream resolution.
 */
export async function fetchDeviceNetworkMeasurement(
  supabase: SupabaseClient,
  userId: string,
  clientDeviceId: string | null,
  nowMs = Date.now(),
): Promise<NetworkMeasurement | null> {
  if (!clientDeviceId) return null;
  const oldestAccepted = new Date(nowMs - NETWORK_MEASUREMENT_MAX_AGE_MS);
  const newestAccepted = new Date(nowMs + NETWORK_MEASUREMENT_FUTURE_SKEW_MS);
  const { data } = await supabase
    .from('network_test_results')
    .select('estimated_bandwidth_mbps, ping_ms, packet_loss_percent, created_at')
    .eq('user_id', userId)
    .eq('client_device_id', clientDeviceId)
    .gte('created_at', oldestAccepted.toISOString())
    .lte('created_at', newestAccepted.toISOString())
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  const row = data as {
    estimated_bandwidth_mbps?: number | string;
    ping_ms?: number | string;
    packet_loss_percent?: number | string;
    created_at?: string;
  } | null;
  if (!row) return null;
  const createdAt = Date.parse(row.created_at ?? '');
  if (
    !Number.isFinite(createdAt) ||
    createdAt < oldestAccepted.getTime() ||
    createdAt > newestAccepted.getTime()
  ) return null;
  return {
    bandwidthMbps: numericOrNull(row.estimated_bandwidth_mbps),
    rttMs: numericOrNull(row.ping_ms),
    lossPercent: numericOrNull(row.packet_loss_percent),
  };
}
