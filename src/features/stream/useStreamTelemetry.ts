import { useEffect, useSyncExternalStore } from 'react';

import { startAsyncPoll } from '@/lib/async-poll';
import type { NativeMoonlightClient } from '@/lib/moonlight-native';
import { readStreamStats, StreamStatsStore, type StreamSample } from '@/lib/stream-stats';
import { useMotion } from '@/ui/motion';

const telemetry = new StreamStatsStore();

export function useStreamStats() {
  return useSyncExternalStore(telemetry.subscribe, telemetry.getSnapshot, telemetry.getSnapshot);
}

/** One non-overlapping sampler for HUD and network analysis, paused in the background. */
export function StreamTelemetry({ client, enabled }: { client: NativeMoonlightClient | null; enabled: boolean }) {
  const { active } = useMotion();
  useEffect(() => {
    if (!client || !enabled || !active) return;
    let previous: StreamSample | null = null;
    telemetry.publish(null, true);
    const stop = startAsyncPoll(async (signal) => {
      const rows = await client.getStats();
      if (signal.aborted) return;
      const next = readStreamStats(rows, previous);
      previous = next.sample;
      telemetry.publish(next.stats, true);
    }, () => 1000);
    return () => {
      stop();
      telemetry.publish(telemetry.getSnapshot().stats, false);
    };
  }, [active, client, enabled]);
  return null;
}
