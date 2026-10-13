// Mua game Steam từ app mà không tự làm thanh toán:
//
//   1. Người dùng bấm Mua → app hiện bảng tóm tắt (giá, giảm giá, các bước).
//   2. PC mở Steam client ở trang game (steam://store/<appid>) hoặc giỏ hàng
//      (deploy/pc/agent.ps1, POST /store/open), rồi app chuyển sang stream để
//      người dùng bấm thanh toán trên giao diện chính chủ của Steam.
//   3. App hỏi định kỳ /store/<appid>/ownership; game vào thư viện là chuyển sang
//      "Đã mua", mời Tải về bằng đúng luồng cài đặt hiện có.
//
// App không bao giờ thấy thông tin thẻ hay bấm "Mua" thay người dùng. File này
// thuần (không React Native) để test bằng node --test.

export type PurchaseTarget = 'store' | 'cart';

export type PurchasePhase =
  /** Bảng tóm tắt, chưa đụng tới PC. */
  | 'review'
  /** Đang nhờ PC mở Steam. */
  | 'opening'
  /** Steam đã mở trên PC, đang chờ game vào thư viện. */
  | 'checkout'
  /** Chờ quá lâu mà chưa thấy giao dịch: dừng hỏi, cho kiểm tra lại bằng tay. */
  | 'stalled'
  | 'owned'
  | 'failed';

/** Giá như Steam trả về (đơn vị nhỏ nhất, /100), gom từ thẻ Store và trang chi tiết. */
export type PurchaseOffer = {
  appId: number;
  name: string;
  imageUrl: string | null;
  free: boolean;
  comingSoon: boolean;
  currency: string | null;
  original: number | null;
  final: number | null;
  discountPercent: number;
};

export type PurchaseState = {
  offer: PurchaseOffer;
  phase: PurchasePhase;
  target: PurchaseTarget;
  error: string | null;
  /** Lúc PC mở Steam xong; mốc cho lịch hỏi quyền sở hữu. */
  openedAt: number | null;
  installed: boolean;
};

export type PurchaseAction =
  | { type: 'open'; target: PurchaseTarget }
  | { type: 'opened'; at: number }
  | { type: 'failed'; error: string }
  | { type: 'ownership'; owned: boolean; installed: boolean }
  | { type: 'stall' }
  | { type: 'recheck'; at: number }
  | { type: 'back' };

export function startPurchase(offer: PurchaseOffer, owned = false, installed = false): PurchaseState {
  return { offer, phase: owned ? 'owned' : 'review', target: 'store', error: null, openedAt: null, installed };
}

export function purchaseReducer(state: PurchaseState, action: PurchaseAction): PurchaseState {
  switch (action.type) {
    case 'open':
      if (state.phase === 'opening' || state.phase === 'owned') return state;
      return { ...state, phase: 'opening', target: action.target, error: null };
    case 'opened':
      return state.phase === 'opening' ? { ...state, phase: 'checkout', openedAt: action.at } : state;
    case 'failed':
      return state.phase === 'opening' ? { ...state, phase: 'failed', error: action.error } : state;
    case 'ownership':
      if (!action.owned) return state;
      return { ...state, phase: 'owned', installed: action.installed, error: null };
    case 'stall':
      return state.phase === 'checkout' ? { ...state, phase: 'stalled' } : state;
    case 'recheck':
      return state.phase === 'stalled' ? { ...state, phase: 'checkout', openedAt: action.at } : state;
    case 'back':
      return state.phase === 'failed' || state.phase === 'stalled'
        ? { ...state, phase: 'review', error: null, openedAt: null }
        : state;
  }
}

export type PurchaseKind = 'buy' | 'free' | 'unavailable';

export function purchaseKind(offer: PurchaseOffer): PurchaseKind {
  if (offer.comingSoon) return 'unavailable';
  if (offer.free || offer.final === 0) return 'free';
  return 'buy';
}

/** Số tiền tiết kiệm (cùng đơn vị với giá), chỉ khi Steam đang giảm giá thật. */
export function purchaseSavings(offer: PurchaseOffer): number | null {
  if (offer.discountPercent <= 0 || offer.original === null || offer.final === null) return null;
  const saved = offer.original - offer.final;
  return saved > 0 ? saved : null;
}

/** Thanh toán thường xong trong vài phút đầu: hỏi dày lúc đó, thưa dần, rồi thôi. */
export const PURCHASE_WATCH_MS = 20 * 60_000;

export function ownershipPollDelay(elapsedMs: number): number | null {
  if (elapsedMs < 0) return 3_000;
  if (elapsedMs < 2 * 60_000) return 3_000;
  if (elapsedMs < 8 * 60_000) return 6_000;
  if (elapsedMs < PURCHASE_WATCH_MS) return 12_000;
  return null;
}

/** Liên kết Steam tương đương cho trình duyệt (khi PC không mở được Steam). */
export function steamWebUrl(appId: number, target: PurchaseTarget): string {
  return target === 'cart' ? 'https://store.steampowered.com/cart/' : `https://store.steampowered.com/app/${appId}/`;
}
