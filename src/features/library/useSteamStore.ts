import { useCallback, useEffect, useRef, useState } from 'react';

import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';

import type { SteamStoreGameDetail } from './detail-types';
import type { StoreDetailResponse, StoreResponse, StoreSearchResponse, SteamStoreItem } from './types';
import { useCachedResource } from './useCachedResource';

const SEARCH_DEBOUNCE_MS = 260;

/** Trang chủ Steam Store, tải lần đầu khi mở tab Store. */
export function useSteamStore(active: boolean) {
  const [data, setData] = useState<StoreResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await pcFetchJson<StoreResponse>(
        PC_ROUTES.store,
        'Không tải được Steam Store.',
        (body) => Boolean(body.featured),
      ));
    } catch (storeLoadError) {
      setError(storeLoadError instanceof Error ? storeLoadError.message : 'Không tải được Steam Store.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active && !data && !loading && !error) void load();
  }, [active, data, error, load, loading]);

  return { data, loading, error, reload: load };
}

/** Tìm kiếm Steam có debounce khi bảng tìm kiếm đang mở; cần ít nhất 2 ký tự. */
export function useStoreSearch(query: string, open: boolean) {
  const [results, setResults] = useState<SteamStoreItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setError(null);
      setLoading(false);
      return;
    }
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setTotal(0);
      setError(null);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void pcFetchJson<StoreSearchResponse>(
        PC_ROUTES.storeSearch(trimmed),
        'Không tìm kiếm được trên Steam.',
        (body) => Array.isArray(body.items),
        controller.signal,
      )
        .then((data) => {
          setResults(data.items!);
          setTotal(data.total || data.items!.length);
        })
        .catch((searchError: unknown) => {
          if (controller.signal.aborted) return;
          setResults([]);
          setTotal(0);
          setError(searchError instanceof Error ? searchError.message : 'Không tìm kiếm được trên Steam.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [open, query]);

  return { results, total, loading, error };
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
  const cache = useRef(new Map<number, SteamStoreGameDetail>());
  return useCachedResource(item?.appId ?? null, cache, fetchStoreDetail, 'Không tải được thông tin trò chơi.');
}
