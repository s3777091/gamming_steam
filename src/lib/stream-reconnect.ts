// Tự nối lại khi mạng rớt giữa lúc đang stream. Giới hạn số lần trong một cửa sổ
// thời gian để một đường mạng hỏng hẳn không quay vòng nối lại mãi: quá giới hạn
// thì người dùng thấy màn lỗi và tự chọn Thử lại / Thoát.

export const AUTO_RECONNECT_LIMIT = 3;
export const AUTO_RECONNECT_WINDOW_MS = 60_000;

export class AutoReconnectBudget {
  private history: number[] = [];
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit = AUTO_RECONNECT_LIMIT, windowMs = AUTO_RECONNECT_WINDOW_MS) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  /** Ghi nhận một lần rớt; true nếu còn được tự nối lại. */
  take(now = Date.now()): boolean {
    this.history = this.history.filter((at) => now - at < this.windowMs);
    if (this.history.length >= this.limit) return false;
    this.history.push(now);
    return true;
  }
}

/** Chờ mạng có lại tối đa chừng này rồi vẫn nối lại để màn lỗi nói rõ lý do. */
export const NETWORK_WAIT_MS = 30_000;

export type OnlineState = { isConnected?: boolean; isInternetReachable?: boolean };

export function isOnline(state: OnlineState): boolean {
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Ngay lúc Wi-Fi vừa tắt, Android vẫn báo mạng cũ "connected" thêm một nhịp:
 * đọc trạng thái lúc đó sẽ nối lại ngay vào màn lỗi DNS.
 */
export const NETWORK_SETTLE_MS = 2_000;

/** Lỗi do mạng của máy (DNS, fetch, quá giờ) — nối lại được khi mạng có lại. */
export function isNetworkFailure(message: string): boolean {
  return /network request failed|failed to fetch|fetch failed|unable to resolve host|unknownhost|timed? ?out|quá thời gian|không kết nối được tới máy chủ/i
    .test(message);
}

/**
 * Nối lại lúc Wi-Fi còn tắt chỉ đổi màn chờ thành màn lỗi DNS. Đợi trạng thái
 * mạng lắng (settleMs) rồi chờ mạng báo có lại (sự kiện, không lặp hỏi). Kết
 * quả: true khi mạng đã có, false khi quá hạn hoặc bị huỷ.
 */
export function waitForOnline(
  read: () => Promise<OnlineState>,
  subscribe: (listener: (state: OnlineState) => void) => () => void,
  timeoutMs = NETWORK_WAIT_MS,
  settleMs = NETWORK_SETTLE_MS,
): { promise: Promise<boolean>; cancel: () => void } {
  let settled = false;
  let unsubscribe: (() => void) | null = null;
  let resolve: (online: boolean) => void = () => {};
  const promise = new Promise<boolean>((done) => { resolve = done; });
  const finish = (online: boolean) => {
    if (settled) return;
    settled = true;
    clearTimeout(timer);
    clearTimeout(settle);
    unsubscribe?.();
    resolve(online);
  };
  const timer = setTimeout(() => finish(false), settleMs + timeoutMs);
  const settle = setTimeout(() => {
    unsubscribe = subscribe((state) => { if (isOnline(state)) finish(true); });
    if (settled) unsubscribe();
    void read().then((state) => { if (isOnline(state)) finish(true); }, () => {});
  }, settleMs);
  return { promise, cancel: () => finish(false) };
}
