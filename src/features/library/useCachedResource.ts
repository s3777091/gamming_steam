import { useCallback, useMemo, useState, type MutableRefObject } from 'react';
import { useFocusEffect } from 'expo-router';

import type { TimedCache } from '@/lib/timed-cache';
import { useMotion } from '@/ui/motion';

type Result<T> = { key: number; data: T | null; error: string | null };

/**
 * Loads `load(key)` whenever `key` changes, reusing `cache` across keys.
 * A null key means "nothing selected"; results for a stale key are never
 * returned, so switching games never flashes the previous game's data.
 */
export function useCachedResource<T>(
  key: number | null,
  cache: MutableRefObject<TimedCache<number, T>>,
  load: (key: number, signal: AbortSignal) => Promise<T>,
  fallbackError: string,
) {
  const [result, setResult] = useState<Result<T> | null>(null);
  const { active } = useMotion();

  useFocusEffect(useCallback(() => {
    if (key === null || !active) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (controller.signal.aborted) return;
      try {
        const cached = cache.current.get(key);
        const data = cached ?? await load(key, controller.signal);
        if (controller.signal.aborted) return;
        if (cached === undefined) cache.current.set(key, data);
        setResult({ key, data, error: null });
        timer = setTimeout(() => void refresh(), cache.current.remainingMs(key));
      } catch (loadError: unknown) {
        if (controller.signal.aborted) return;
        setResult({ key, data: null, error: loadError instanceof Error ? loadError.message : fallbackError });
        timer = setTimeout(() => void refresh(), 30_000);
      }
    };
    // Keep cache hits asynchronous as well, avoiding a synchronous effect update.
    void Promise.resolve().then(refresh);

    return () => { controller.abort(); clearTimeout(timer); };
  }, [active, cache, fallbackError, key, load]));

  const cached = key === null ? undefined : cache.current.get(key);
  const current = key !== null && result?.key === key ? result : null;
  const data = cached ?? null;
  const error = cached !== undefined ? null : current?.error ?? null;
  const loading = key !== null && cached === undefined && !error;
  return useMemo(() => ({ data, error, loading }), [data, error, loading]);
}

export { pcFetchJson as fetchJson } from '@/lib/pc-api';
