// Chạy: node --experimental-strip-types --test src/lib/__tests__/steam-purchase.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type PurchaseOffer,
  PURCHASE_WATCH_MS,
  ownershipPollDelay,
  purchaseKind,
  purchaseReducer,
  purchaseSavings,
  startPurchase,
  steamWebUrl,
} from '../steam-purchase.ts';

function offer(overrides: Partial<PurchaseOffer> = {}): PurchaseOffer {
  return {
    appId: 1091500,
    name: 'Cyberpunk 2077',
    imageUrl: null,
    free: false,
    comingSoon: false,
    currency: 'VND',
    original: 99_000_000,
    final: 49_500_000,
    discountPercent: 50,
    ...overrides,
  };
}

test('mở bảng mua: đã sở hữu thì vào thẳng bước đã mua', () => {
  assert.equal(startPurchase(offer()).phase, 'review');
  const owned = startPurchase(offer(), true, true);
  assert.equal(owned.phase, 'owned');
  assert.equal(owned.installed, true);
});

test('luồng thanh toán: mở Steam → chờ → thấy game trong thư viện', () => {
  let state = startPurchase(offer());
  state = purchaseReducer(state, { type: 'open', target: 'cart' });
  assert.equal(state.phase, 'opening');
  assert.equal(state.target, 'cart');
  // Bấm lần nữa trong lúc đang mở không làm gì.
  assert.equal(purchaseReducer(state, { type: 'open', target: 'store' }), state);

  state = purchaseReducer(state, { type: 'opened', at: 1_000 });
  assert.equal(state.phase, 'checkout');
  assert.equal(state.openedAt, 1_000);

  // Chưa sở hữu: giữ nguyên trạng thái.
  assert.equal(purchaseReducer(state, { type: 'ownership', owned: false, installed: false }), state);
  state = purchaseReducer(state, { type: 'ownership', owned: true, installed: false });
  assert.equal(state.phase, 'owned');
  assert.equal(state.installed, false);
});

test('PC không mở được Steam: báo lỗi rồi quay lại bảng tóm tắt', () => {
  let state = purchaseReducer(startPurchase(offer()), { type: 'open', target: 'store' });
  state = purchaseReducer(state, { type: 'failed', error: 'Không tìm thấy Steam trên máy tính.' });
  assert.equal(state.phase, 'failed');
  assert.equal(state.error, 'Không tìm thấy Steam trên máy tính.');
  // Kết quả mở cũ tới muộn không kéo trạng thái lỗi sang checkout.
  assert.equal(purchaseReducer(state, { type: 'opened', at: 5 }).phase, 'failed');
  state = purchaseReducer(state, { type: 'back' });
  assert.equal(state.phase, 'review');
  assert.equal(state.error, null);
});

test('chờ quá lâu: dừng hỏi, kiểm tra lại thì bắt đầu lại lịch hỏi', () => {
  let state = purchaseReducer(startPurchase(offer()), { type: 'open', target: 'store' });
  state = purchaseReducer(state, { type: 'opened', at: 0 });
  state = purchaseReducer(state, { type: 'stall' });
  assert.equal(state.phase, 'stalled');
  state = purchaseReducer(state, { type: 'recheck', at: 42 });
  assert.equal(state.phase, 'checkout');
  assert.equal(state.openedAt, 42);
  // Dù đang dừng, thấy game trong thư viện vẫn chuyển sang đã mua.
  const stalled = purchaseReducer(state, { type: 'stall' });
  assert.equal(purchaseReducer(stalled, { type: 'ownership', owned: true, installed: true }).phase, 'owned');
});

test('loại nút mua theo giá', () => {
  assert.equal(purchaseKind(offer()), 'buy');
  assert.equal(purchaseKind(offer({ free: true, final: null })), 'free');
  assert.equal(purchaseKind(offer({ final: 0, original: 0, discountPercent: 0 })), 'free');
  assert.equal(purchaseKind(offer({ comingSoon: true })), 'unavailable');
});

test('tiền tiết kiệm chỉ khi đang giảm giá', () => {
  assert.equal(purchaseSavings(offer()), 49_500_000);
  assert.equal(purchaseSavings(offer({ discountPercent: 0, original: 99_000_000, final: 99_000_000 })), null);
  assert.equal(purchaseSavings(offer({ original: null })), null);
});

test('lịch hỏi quyền sở hữu thưa dần rồi dừng', () => {
  assert.equal(ownershipPollDelay(0), 3_000);
  assert.equal(ownershipPollDelay(3 * 60_000), 6_000);
  assert.equal(ownershipPollDelay(10 * 60_000), 12_000);
  assert.equal(ownershipPollDelay(PURCHASE_WATCH_MS), null);
});

test('liên kết web tương đương', () => {
  assert.equal(steamWebUrl(10, 'store'), 'https://store.steampowered.com/app/10/');
  assert.equal(steamWebUrl(10, 'cart'), 'https://store.steampowered.com/cart/');
});
