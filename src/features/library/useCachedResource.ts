import { useEffect, useState, type MutableRefObject } from 'react';

type Result<T> = { key: number; data: T | null; error: string | null };

/**
 * Loads `load(key)` whenever `key` changes, reusing `cache` across keys.
 * A null key means "nothing selected"; results for a stale key are never
 * returned, so switching games never flashes the previous game's data.
 */
export function useCachedResource<T>(
  key: number | null,
  cache: MutableRefObject<Map<number, T>>,
  load: (key: number, signal: AbortSignal) => Promise<T>,
  fallbackError: string,
) {
  const [result, setResult] = useState<Result<T> | null>(null);

  useEffect(() => {
    if (key === null) return;
    const cached = cache.current.get(key);
    if (cached) {
      setResult({ key, data: cached, error: null });
      return;
    }

    const controller = new AbortController();
    void load(key, controller.signal)
      .then((data) => {
        cache.current.set(key, data);
        setResult({ key, data, error: null });
      })
      .catch((loadError: unknown) => {
        if (controller.signal.aborted) return;
        setResult({ key, data: null, error: loadError instanceof Error ? loadError.message : fallbackError });
      });

    return () => controller.abort();
  }, [cache, fallbackError, key, load]);

  const current = key !== null && result?.key === key ? result : null;
  return {
    data: current?.data ?? null,
    error: current?.error ?? null,
    loading: key !== null && !current,
  };
}

export { pcFetchJson as fetchJson } from '@/lib/pc-api';
