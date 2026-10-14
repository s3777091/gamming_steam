import assert from 'node:assert/strict';
import test from 'node:test';

import { computeAiDecision, type MultipathStatusLike } from '../multipath-algorithm.ts';

const mockSingleStatus: MultipathStatusLike = {
  isMultipathActive: false,
  mode: 'single_wifi',
};

const mockHbsStatus: MultipathStatusLike = {
  isMultipathActive: true,
  mode: 'hbs_dual_wifi',
};

const mockCellularStatus: MultipathStatusLike = {
  isMultipathActive: true,
  mode: 'wifi_cellular',
};

test('Single-Path: 100% traffic đi qua đường chính và tự điều tiết bitrate', () => {
  // Mạng 1 Wi-Fi ổn định
  const good = computeAiDecision(mockSingleStatus, 15, 0, 0, 0, 4.5, false);
  assert.equal(good.primaryRatio, 100);
  assert.equal(good.secondaryRatio, 0);
  assert.equal(good.recommendedBitrateMbps, 35);
  assert.equal(good.redundancyActive, false);

  // Mạng 1 Wi-Fi bị nghẽn (RTT cao, mất gói) -> AI Pensieve hạ bitrate để tránh stall
  const degraded = computeAiDecision(mockSingleStatus, 95, 4.0, 0, 0, 2.0, false);
  assert.equal(degraded.primaryRatio, 100);
  assert.equal(degraded.recommendedBitrateMbps, 10);
  assert.ok(degraded.targetBufferSec >= 6.0, 'Phải tăng buffer khi mạng chập chờn');
});

test('HBS Dual 5GHz trên Galaxy Tab S9: Chia đều tải và đẩy bitrate tối đa', () => {
  // Cả 2 sóng 5GHz đều mượt
  const decision = computeAiDecision(mockHbsStatus, 12, 0, 14, 0, 4.5, false);
  assert.ok(decision.primaryRatio >= 45 && decision.primaryRatio <= 65);
  assert.ok(decision.secondaryRatio >= 35 && decision.secondaryRatio <= 55);
  assert.equal(decision.primaryRatio + decision.secondaryRatio, 100);
  assert.ok(decision.recommendedBitrateMbps >= 40, 'Băng thông HBS Dual 5G phải cao');
  assert.equal(decision.redundancyActive, false);
});

test('Wi-Fi + 5G Cellular: Ưu tiên Wi-Fi, 5G chỉ gánh phụ để tiết kiệm cước', () => {
  // Wi-Fi đang tốt -> 5G chỉ giữ 10-15%
  const normal = computeAiDecision(mockCellularStatus, 15, 0, 25, 0, 4.2, true);
  assert.ok(normal.primaryRatio >= 80, 'Wi-Fi chính phải gánh trên 80% khi còn tốt');
  assert.ok(normal.secondaryRatio <= 20, '5G chỉ giữ lưu lượng nhỏ');

  // Wi-Fi bị đứt/lag đột ngột (Loss 5%, RTT 120ms) -> 5G lập tức cứu nguy
  const wifiLag = computeAiDecision(mockCellularStatus, 120, 5.0, 22, 0, 3.0, true);
  assert.ok(wifiLag.secondaryRatio > 50, '5G phải bung tải khi Wi-Fi bị nghẽn');
  assert.equal(wifiLag.redundancyActive, true, 'Kích hoạt duplicate packet để cứu khung hình');
});
