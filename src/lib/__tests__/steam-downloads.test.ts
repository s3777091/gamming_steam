// Chạy: node --experimental-strip-types --test src/lib/__tests__/steam-downloads.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  type DownloadsState,
  allDownloads,
  downloadForApp,
  formatBytes,
  formatEta,
  formatSpeed,
  isDownloadActive,
  parseAgentMessage,
  primaryDownload,
  uninstallForApp,
} from '../steam-downloads.ts';

function state(overrides: Partial<DownloadsState> = {}): DownloadsState {
  return {
    type: 'state',
    v: 1,
    at: 1,
    steam: { status: 'ready', error: null },
    active: null,
    queue: [],
    installs: [],
    uninstalls: [],
    controllers: [],
    ...overrides,
  };
}

const flow = (phase: DownloadsState['installs'][number]['phase'], extra = {}) => ({
  appid: 570, name: 'Dota 2', phase, eulas: null, error: null, updatedAt: 1, ...extra,
});

test('parseAgentMessage nhận state, bye, notice và bỏ tin lạ', () => {
  assert.equal(parseAgentMessage(JSON.stringify(state()))?.type, 'state');
  const bye = parseAgentMessage(JSON.stringify({ type: 'bye', reason: 'xong', state: state() }));
  assert.equal(bye?.type === 'bye' && bye.state?.type, 'state');
  assert.deepEqual(parseAgentMessage('{"type":"notice","appid":570,"message":"x"}'), { type: 'notice', appid: 570, message: 'x' });
  assert.equal(parseAgentMessage('{"type":"state","v":2}'), null);
  assert.equal(parseAgentMessage('không phải json'), null);
  assert.equal(parseAgentMessage(42), null);
});

test('tiến trình gỡ cài đặt lấy từ Steam client', () => {
  const uninstall = (phase: NonNullable<DownloadsState['uninstalls']>[number]['phase'], error: string | null = null) => state({
    uninstalls: [{ appid: 570, name: 'Dota 2', phase, error, updatedAt: 1 }],
  });
  assert.deepEqual(uninstallForApp(uninstall('starting'), 570), {
    appid: 570, name: 'Dota 2', status: 'starting', label: 'Đang mở Steam trên máy tính', progress: 12, error: null,
  });
  assert.equal(uninstallForApp(uninstall('uninstalling'), 570)?.label, 'Steam đang gỡ cài đặt');
  assert.equal(uninstallForApp(uninstall('uninstalled'), 570)?.progress, 100);
  assert.equal(uninstallForApp(uninstall('failed', 'đang chạy'), 570)?.error, 'đang chạy');
  assert.equal(uninstallForApp(state(), 570), null);
});

test('đang mở Steam -> preparing', () => {
  const result = downloadForApp(state({ steam: { status: 'starting', error: null }, installs: [flow('starting')] }), 570);
  assert.equal(result?.status, 'preparing');
  assert.equal(result?.label, 'Đang mở Steam trên máy tính');
});

test('chờ EULA mang theo danh sách điều khoản', () => {
  const eulas = [{ id: '570_eula_0', version: 1, url: 'https://example.com/eula' }];
  const result = downloadForApp(state({ installs: [flow('eula', { eulas })] }), 570);
  assert.equal(result?.status, 'eula');
  assert.deepEqual(result?.eulas, eulas);
});

test('đang tải lấy số từ overview', () => {
  const result = downloadForApp(state({
    installs: [flow('queued')],
    active: {
      appid: 570, name: 'Dota 2', state: 'Downloading', isInstall: true, isWorkshop: false,
      percent: 12, downloaded: 1_234_567, total: 9_876_543, bytesPerSec: 5_200_000,
      peakBytesPerSec: 0, diskBytesPerSec: 0, etaSec: 180, paused: false,
    },
  }), 570);
  assert.equal(result?.status, 'downloading');
  assert.equal(result?.percent, 12);
  assert.equal(result?.etaSec, 180);
});

test('bước trên ổ đĩa có nhãn riêng, tạm dừng thì không có tốc độ', () => {
  const active = {
    appid: 570, name: null, state: 'Validating', isInstall: false, isWorkshop: false,
    percent: 52, downloaded: 0, total: 0, bytesPerSec: 0, peakBytesPerSec: 0, diskBytesPerSec: 0, etaSec: null, paused: false,
  };
  assert.equal(downloadForApp(state({ active }), 570)?.label, 'Đang kiểm tra tệp');
  const paused = downloadForApp(state({ active: { ...active, state: 'Downloading', paused: true, bytesPerSec: 99 } }), 570);
  assert.equal(paused?.status, 'paused');
  assert.equal(paused?.bytesPerSec, 0);
});

test('hàng đợi: chờ, tạm dừng, xong', () => {
  const item = {
    appid: 570, name: 'Dota 2', active: false, paused: false, completed: false, queueIndex: 1,
    downloaded: 50, total: 200, error: null, completedAt: null,
  };
  assert.equal(downloadForApp(state({ queue: [item] }), 570)?.percent, 25);
  assert.equal(downloadForApp(state({ queue: [{ ...item, paused: true }] }), 570)?.status, 'paused');
  assert.equal(downloadForApp(state({ queue: [{ ...item, completed: true }] }), 570)?.status, 'installed');
  assert.equal(downloadForApp(state({ queue: [item] }), 730), null);
});

test('primaryDownload ưu tiên game đang chờ đồng ý điều khoản', () => {
  const item = {
    appid: 730, name: 'CS2', active: false, paused: false, completed: false, queueIndex: 0,
    downloaded: 0, total: 0, error: null, completedAt: null,
  };
  const result = primaryDownload(state({ queue: [item], installs: [flow('eula', { eulas: [] })] }));
  assert.equal(result?.appid, 570);
  assert.equal(primaryDownload(state({ queue: [item] }))?.appid, 730);
  assert.equal(primaryDownload(state()), null);
});

test('định dạng dung lượng, tốc độ, thời gian', () => {
  assert.equal(formatBytes(0), '0 B');
  assert.equal(formatBytes(1_087_548_688), '1.0 GB');
  assert.equal(formatBytes(512), '512 B');
  assert.equal(formatSpeed(5_200_000), '41.6 Mbps');
  assert.equal(formatSpeed(0), '');
  assert.equal(formatEta(30), 'còn chưa tới 1 phút');
  assert.equal(formatEta(180), 'còn 3 phút');
  assert.equal(formatEta(3 * 3600 + 5 * 60), 'còn 3 giờ 5 phút');
  assert.equal(formatEta(null), '');
});

const config = {
  requiredBytes: 61_300_000_000,
  folders: [{ index: 0, label: 'Ổ đĩa cục bộ (C:)', path: 'C:\Steam', freeBytes: 317_773_721_600, capacityBytes: 999_099_985_920, isDefault: true }],
  selectedFolder: 0,
  canChangeFolder: false,
  desktopShortcut: true,
  startMenuShortcut: true,
};

test('chờ chọn nơi cài đặt mang theo ổ đĩa và dung lượng cần', () => {
  const result = downloadForApp(state({ installs: [flow('config', { config })] }), 570);
  assert.equal(result?.status, 'config');
  assert.equal(result?.label, 'Chọn nơi cài đặt');
  assert.equal(result?.total, 61_300_000_000);
  assert.deepEqual(result?.config, config);
  // Agent cũ không gửi config: không có gì để hiện nên bỏ qua.
  assert.equal(downloadForApp(state({ installs: [flow('config')] }), 570), null);
});

test('primaryDownload cũng ưu tiên game đang chờ chọn nơi cài đặt', () => {
  const item = {
    appid: 730, name: 'CS2', active: false, paused: false, completed: false, queueIndex: 0,
    downloaded: 0, total: 0, error: null, completedAt: null,
  };
  assert.equal(primaryDownload(state({ queue: [item], installs: [flow('config', { config })] }))?.appid, 570);
});

test('allDownloads gộp mọi game, việc cần trả lời lên đầu, xong xuống cuối', () => {
  const item = (appid: number, extra = {}) => ({
    appid, name: `Game ${appid}`, active: false, paused: false, completed: false, queueIndex: 1,
    downloaded: 0, total: 0, error: null, completedAt: null, ...extra,
  });
  const list = allDownloads(state({
    installs: [flow('config', { config })],
    queue: [item(100, { completed: true }), item(200), item(300, { queueIndex: 0 })],
    active: {
      appid: 400, name: 'Active', state: 'Downloading', isInstall: true, isWorkshop: false,
      percent: 5, downloaded: 1, total: 20, bytesPerSec: 1000, peakBytesPerSec: 0, diskBytesPerSec: 0, etaSec: 60, paused: false,
    },
  }));
  assert.deepEqual(list.map((entry) => entry.appid), [570, 400, 300, 200, 100]);
  assert.deepEqual(allDownloads(null), []);
  assert.equal(isDownloadActive(list[0]), true);
  assert.equal(isDownloadActive(list[4]), false);
});
