import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { TimedCache } from '@/lib/timed-cache';
import { RefreshingResource } from '@/lib/refreshing-resource';

import type { SteamStoreGameDetail } from './detail-types';
import type { StoreDetailResponse, StoreResponse, StoreSearchResponse, SteamStoreItem } from './types';
import { useCachedResource } from './useCachedResource';

const SEARCH_DEBOUNCE_MS = 260;

const storeCache = new RefreshingResource<StoreResponse>(5 * 60_000);
const STORE_RETRY_MS = 30_000;

export function fetchStoreOnce(force = false): Promise<StoreResponse> {
  return storeCache.load(() => pcFetchJson<StoreResponse>(
      PC_ROUTES.store,
      'Không tải được Steam Store.',
      (body) => Boolean(body.featured),
    ), force);
}

/** Trang chủ Steam Store, tải lần đầu khi mở tab Store hoặc preload. */
export function useSteamStore(active: boolean) {
  const [data, setData] = useState<StoreResponse | null>(() => storeCache.peek());
  const [loading, setLoading] = useState(() => !storeCache.peek() && active);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchStoreOnce(true);
      setData(res);
    } catch (storeLoadError) {
      setError(storeLoadError instanceof Error ? storeLoadError.message : 'Không tải được Steam Store.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let foreground = AppState.currentState !== 'background' && AppState.currentState !== 'inactive';
    let refreshing = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      if (cancelled || !foreground || refreshing) return;
      refreshing = true;
      try {
        const res = await fetchStoreOnce();
        if (!cancelled) { setData(res); setError(null); }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Không tải được Steam Store.');
      } finally {
        refreshing = false;
        if (!cancelled) {
          setLoading(false);
          if (foreground) timer = setTimeout(() => void refresh(), storeCache.remainingMs() || STORE_RETRY_MS);
        }
      }
    };
    void refresh();
    const subscription = AppState.addEventListener('change', (next) => {
      foreground = next === 'active';
      clearTimeout(timer);
      if (foreground) void refresh();
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [active]);

  return useMemo(() => ({ data, loading, error, reload: load }), [data, loading, error, load]);
}

/** Tìm kiếm Steam có debounce khi bảng tìm kiếm đang mở; cần ít nhất 2 ký tự. */
type SearchResult = { query: string; results: SteamStoreItem[]; total: number; error: string | null };
const EMPTY_RESULTS: SteamStoreItem[] = [];

export function useStoreSearch(query: string, open: boolean) {
  const trimmed = query.trim();
  const [cache] = useState(() => new TimedCache<string, SearchResult>(30, 120_000));
  const [response, setResponse] = useState<SearchResult | null>(null);
  const cached = useMemo(() => {
    // Re-read the cache after this query's response is committed as well as
    // when the user revisits a query; unrelated UI updates do no cache work.
    if (response?.query === trimmed && !response.error) return cache.get(response.query);
    return cache.get(trimmed);
  }, [cache, trimmed, response]);
  const current = cached ?? (response?.query === trimmed && response.error ? response : null);
  const enabled = open && trimmed.length >= 2;

  useEffect(() => {
    if (!open || trimmed.length < 2 || cache.get(trimmed)) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void pcFetchJson<StoreSearchResponse>(
        PC_ROUTES.storeSearch(trimmed),
        'Không tìm kiếm được trên Steam.',
        (body) => Array.isArray(body.items),
        controller.signal,
      ).then((data) => {
        if (controller.signal.aborted) return;
        const next: SearchResult = {
          query: trimmed, results: data.items!, total: data.total ?? data.items!.length, error: null,
        };
        cache.set(trimmed, next);
        setResponse(next);
      }).catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setResponse({ query: trimmed, results: EMPTY_RESULTS, total: 0,
          error: error instanceof Error ? error.message : 'Không tìm kiếm được trên Steam.' });
      });
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [cache, open, trimmed]);

  return useMemo(() => ({
    results: enabled ? current?.results ?? EMPTY_RESULTS : EMPTY_RESULTS,
    total: enabled ? current?.total ?? 0 : 0,
    loading: enabled && !current,
    error: enabled ? current?.error ?? null : null,
  }), [current, enabled]);
}

async function fetchStoreDetail(appId: number, signal: AbortSignal): Promise<SteamStoreGameDetail> {
  const data = await pcFetchJson<StoreDetailResponse>(
    PC_ROUTES.storeDetail(appId),
    'Không tải được thông tin trò chơi.',
    (body) => Boolean(body.game),
    signal,
  );
  return data.game!;
}

/** Dữ liệu đầy đủ của game đang mở từ tab Store. */
export function useStoreGameDetail(item: SteamStoreItem | null) {
  const [detailsCache] = useState(() => new TimedCache<number, SteamStoreGameDetail>(24, 5 * 60_000));
  const cache = useRef(detailsCache);
  return useCachedResource(item?.appId ?? null, cache, fetchStoreDetail, 'Không tải được thông tin trò chơi.');
}
