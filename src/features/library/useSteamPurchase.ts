// Mua game qua Steam client trên PC: mở Steam đúng trang, người dùng thanh toán
// trên giao diện chính chủ của Steam (qua stream), app chờ game vào thư viện.
// Luồng và trạng thái thuần nằm ở lib/steam-purchase.ts.

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';

import { PC_ROUTES, pcFetchJson, pcPostJson } from '@/lib/pc-api';
import {
  type PurchaseAction,
  type PurchaseOffer,
  type PurchaseState,
  type PurchaseTarget,
  ownershipPollDelay,
  purchaseReducer,
  startPurchase,
} from '@/lib/steam-purchase';

type OwnershipResponse = { ok?: boolean; owned?: boolean; installed?: boolean; error?: string };

export type Ownership = { owned: boolean; installed: boolean };

function fetchOwnership(appId: number, signal?: AbortSignal): Promise<Ownership> {
  return pcFetchJson<OwnershipResponse>(
    PC_ROUTES.storeOwnership(appId),
    'Chưa kiểm tra được thư viện Steam.',
    (data) => typeof data.owned === 'boolean',
    signal,
  ).then((data) => ({ owned: data.owned === true, installed: data.installed === true }));
}

/** Game trong trang Store đã có trong thư viện Steam chưa; null khi chưa biết (lỗi, đang hỏi). */
export function useStoreOwnership(appId: number | null): Ownership | null {
  const [result, setResult] = useState<{ appId: number; value: Ownership } | null>(null);
  useEffect(() => {
    if (!appId) return;
    const controller = new AbortController();
    fetchOwnership(appId, controller.signal)
      .then((value) => setResult({ appId, value }))
      .catch(() => {});
    return () => controller.abort();
  }, [appId]);
  return result && result.appId === appId ? result.value : null;
}

type Action = PurchaseAction | { type: 'start'; state: PurchaseState } | { type: 'close' };

function reducer(state: PurchaseState | null, action: Action): PurchaseState | null {
  if (action.type === 'start') return action.state;
  if (action.type === 'close') return null;
  return state ? purchaseReducer(state, action) : state;
}

export type SteamPurchase = {
  state: PurchaseState | null;
  /** Bảng mua đang hiện. Đóng lúc đang chờ thanh toán chỉ ẩn bảng, app vẫn theo dõi. */
  visible: boolean;
  reopen: () => void;
  /** Mở bảng mua cho một game (đã sở hữu thì vào thẳng bước "Đã mua"). */
  begin: (offer: PurchaseOffer, ownership?: Ownership | null) => void;
  /** Nhờ PC mở Steam; true khi Steam đã mở và app nên chuyển sang stream. */
  checkout: (target: PurchaseTarget) => Promise<boolean>;
  recheck: () => void;
  back: () => void;
  close: () => void;
};

export function useSteamPurchase(onOwned?: (appId: number) => void): SteamPurchase {
  const [state, dispatch] = useReducer(reducer, null);
  const [hidden, setHidden] = useState(false);
  const onOwnedRef = useRef(onOwned);
  useEffect(() => { onOwnedRef.current = onOwned; }, [onOwned]);

  const appId = state?.offer.appId ?? null;
  const phase = state?.phase ?? null;
  const openedAt = state?.openedAt ?? null;

  // Đang chờ thanh toán: hỏi quyền sở hữu theo lịch thưa dần, kể cả khi người
  // dùng đang ở màn stream (màn này vẫn sống bên dưới).
  useEffect(() => {
    if (phase !== 'checkout' || !appId || openedAt === null) return;
    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const controller = new AbortController();
    const schedule = () => {
      const delay = ownershipPollDelay(Date.now() - openedAt);
      if (delay === null) { dispatch({ type: 'stall' }); return; }
      timer = setTimeout(() => void poll(), delay);
    };
    const poll = async () => {
      try {
        const ownership = await fetchOwnership(appId, controller.signal);
        if (disposed) return;
        if (ownership.owned) {
          dispatch({ type: 'ownership', ...ownership });
          setHidden(false);
          onOwnedRef.current?.(appId);
          return;
        }
      } catch {
        if (disposed) return;
        // Mạng chập chờn hay PC đang bận: lần sau hỏi lại.
      }
      schedule();
    };
    schedule();
    return () => {
      disposed = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [appId, openedAt, phase]);

  const begin = useCallback((offer: PurchaseOffer, ownership?: Ownership | null) => {
    setHidden(false);
    dispatch({ type: 'start', state: startPurchase(offer, ownership?.owned, ownership?.installed) });
  }, []);

  const busy = useRef(false);
  const checkout = useCallback(async (target: PurchaseTarget) => {
    if (!appId || busy.current) return false;
    busy.current = true;
    dispatch({ type: 'open', target });
    try {
      await pcPostJson(PC_ROUTES.storePurchase, { appId, target }, 'Không mở được Steam trên máy tính.');
      dispatch({ type: 'opened', at: Date.now() });
      return true;
    } catch (error) {
      dispatch({ type: 'failed', error: error instanceof Error ? error.message : 'Không mở được Steam trên máy tính.' });
      return false;
    } finally {
      busy.current = false;
    }
  }, [appId]);

  const waiting = phase === 'opening' || phase === 'checkout';
  return {
    state,
    visible: Boolean(state && !hidden),
    reopen: useCallback(() => setHidden(false), []),
    begin,
    checkout,
    recheck: useCallback(() => dispatch({ type: 'recheck', at: Date.now() }), []),
    back: useCallback(() => dispatch({ type: 'back' }), []),
    close: useCallback(() => {
      if (waiting) setHidden(true);
      else dispatch({ type: 'close' });
    }, [waiting]),
  };
}
