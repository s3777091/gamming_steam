// Trạng thái tải game Steam mà agent trên PC (deploy/pc/steam-downloads) đẩy THẲNG
// về điện thoại qua WebRTC DataChannel. File này thuần (không React Native) để
// test bằng node --test; kết nối nằm ở features/library/useSteamDownloads.ts.

export const STEAM_DOWNLOADS_PRESENCE = 'jetsona:steam-downloads:home-pc';
export const STEAM_DOWNLOADS_CHANNEL = 'steam-downloads';

export type InstallPhase =
  | 'starting' | 'wizard' | 'config' | 'eula' | 'queued' | 'installed' | 'failed' | 'cancelled' | 'manual';

export type SteamEula = { id: string; version: number; url: string };

/** Một ổ đĩa / thư viện Steam có thể cài game vào (hộp thoại Install của Steam). */
export type InstallFolder = {
  index: number;
  label: string;
  path: string;
  freeBytes: number;
  capacityBytes: number;
  isDefault: boolean;
};

/** Nội dung hộp thoại Install: dung lượng, ổ đĩa, lối tắt. Người bấm Tải chọn trên điện thoại. */
export type InstallConfig = {
  requiredBytes: number;
  folders: InstallFolder[];
  selectedFolder: number;
  canChangeFolder: boolean;
  desktopShortcut: boolean;
  startMenuShortcut: boolean;
};

export type InstallFlow = {
  appid: number;
  name: string | null;
  phase: InstallPhase;
  eulas: SteamEula[] | null;
  config?: InstallConfig | null;
  error: string | null;
  updatedAt: number;
};

export type UninstallPhase = 'starting' | 'uninstalling' | 'uninstalled' | 'failed';

/** Tiến trình gỡ do chính Steam client thực hiện trên PC. */
export type UninstallFlow = {
  appid: number;
  name: string | null;
  phase: UninstallPhase;
  error: string | null;
  updatedAt: number;
};

export type ActiveDownload = {
  appid: number;
  name: string | null;
  state: string;
  isInstall: boolean;
  isWorkshop: boolean;
  percent: number;
  downloaded: number;
  total: number;
  bytesPerSec: number;
  peakBytesPerSec: number;
  diskBytesPerSec: number;
  etaSec: number | null;
  paused: boolean;
};

export type QueueItem = {
  appid: number;
  name: string | null;
  active: boolean;
  paused: boolean;
  completed: boolean;
  queueIndex: number;
  downloaded: number;
  total: number;
  percent?: number | null;
  error: string | null;
  completedAt: number | null;
};

export type DownloadsState = {
  type: 'state';
  v: 1;
  at: number;
  steam: { status: 'starting' | 'ready' | 'error'; error: string | null };
  active: ActiveDownload | null;
  queue: QueueItem[];
  installs: InstallFlow[];
  /** Agent cũ chưa có trường này; app coi như không có lượt gỡ nào. */
  uninstalls?: UninstallFlow[];
  controllers: string[];
};

function sameDownloadValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (!left || !right || typeof left !== 'object' || typeof right !== 'object') return false;
  if (Array.isArray(left) || Array.isArray(right)) {
    return Array.isArray(left) && Array.isArray(right) && left.length === right.length
      && left.every((value, index) => sameDownloadValue(value, right[index]));
  }
  const a = left as Record<string, unknown>;
  const b = right as Record<string, unknown>;
  const keys = Object.keys(a).filter((key) => key !== 'updatedAt');
  return keys.length === Object.keys(b).filter((key) => key !== 'updatedAt').length
    && keys.every((key) => Object.hasOwn(b, key) && sameDownloadValue(a[key], b[key]));
}

/** Agent timestamps alone do not change any displayed state. */
export function reuseDownloadSnapshot(previous: DownloadsState | null, next: DownloadsState): DownloadsState {
  if (!previous) return next;
  return sameDownloadValue(previous.steam, next.steam)
    && sameDownloadValue(previous.active, next.active)
    && sameDownloadValue(previous.queue, next.queue)
    && sameDownloadValue(previous.installs, next.installs)
    && sameDownloadValue(previous.uninstalls ?? [], next.uninstalls ?? [])
    && sameDownloadValue(previous.controllers, next.controllers) ? previous : next;
}

export type AgentMessage =
  | DownloadsState
  | { type: 'bye'; reason: string | null; state: DownloadsState | null }
  | { type: 'notice'; appid: number; message: string };

/** Completed history must not keep the fast polling cadence alive. */
export function hasPendingDownloads(state: DownloadsState | null): boolean {
  return Boolean(state && (
    state.active
    || state.queue.some((item) => !item.completed && !item.error)
    || state.installs.some((flow) => !['installed', 'failed', 'cancelled', 'manual'].includes(flow.phase))
    || state.uninstalls?.some((flow) => flow.phase === 'starting' || flow.phase === 'uninstalling')
  ));
}

export type AppCommand =
  | { type: 'hello' }
  | { type: 'eula'; appid: number; accept: boolean }
  | { type: 'config'; appid: number; accept: boolean; folder?: number; desktopShortcut?: boolean; startMenuShortcut?: boolean }
  | { type: 'pause'; appid: number }
  | { type: 'resume'; appid: number }
  | { type: 'cancel'; appid: number };

function isState(value: unknown): value is DownloadsState {
  const data = value as DownloadsState | null;
  return Boolean(
    data
    && data.type === 'state'
    && data.v === 1
    && Array.isArray(data.queue)
    && Array.isArray(data.installs)
    && (data.uninstalls === undefined || Array.isArray(data.uninstalls))
    && Array.isArray(data.controllers),
  );
}

/** Đọc một tin từ DataChannel; tin lạ hoặc phiên bản khác thì bỏ qua. */
export function parseAgentMessage(raw: unknown): AgentMessage | null {
  if (typeof raw !== 'string' || raw.length > 256_000) return null;
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return null; }
  if (isState(data)) return data;
  const message = data as { type?: unknown; reason?: unknown; state?: unknown; appid?: unknown; message?: unknown } | null;
  if (message?.type === 'bye') {
    return {
      type: 'bye',
      reason: typeof message.reason === 'string' ? message.reason : null,
      state: isState(message.state) ? message.state : null,
    };
  }
  if (message?.type === 'notice' && typeof message.message === 'string') {
    return { type: 'notice', appid: Number(message.appid) || 0, message: message.message };
  }
  return null;
}

export type GameDownloadStatus =
  | 'preparing' | 'config' | 'eula' | 'downloading' | 'working' | 'paused' | 'queued'
  | 'installed' | 'failed' | 'cancelled' | 'manual';

/** Mọi thứ UI cần cho MỘT game, gộp từ luồng cài đặt + hàng đợi + lượt đang chạy. */
export type GameDownload = {
  appid: number;
  name: string | null;
  status: GameDownloadStatus;
  label: string;
  percent: number | null;
  downloaded: number;
  total: number;
  bytesPerSec: number;
  etaSec: number | null;
  error: string | null;
  eulas: SteamEula[] | null;
  config: InstallConfig | null;
};

export type GameUninstall = {
  appid: number;
  name: string | null;
  status: UninstallPhase;
  label: string;
  /** Mốc tiến trình theo bước của Steam, không giả lập phần trăm byte đã xóa. */
  progress: number;
  error: string | null;
};

export function uninstallForApp(state: DownloadsState | null, appid: number | null): GameUninstall | null {
  if (!state || !appid) return null;
  const flow = state.uninstalls?.find((entry) => entry.appid === appid);
  if (!flow) return null;
  if (flow.phase === 'starting') {
    return { appid, name: flow.name, status: flow.phase, label: 'Đang mở Steam trên máy tính', progress: 12, error: null };
  }
  if (flow.phase === 'uninstalling') {
    return { appid, name: flow.name, status: flow.phase, label: 'Steam đang gỡ cài đặt', progress: 62, error: null };
  }
  if (flow.phase === 'uninstalled') {
    return { appid, name: flow.name, status: flow.phase, label: 'Đã gỡ khỏi máy tính', progress: 100, error: null };
  }
  return {
    appid,
    name: flow.name,
    status: 'failed',
    label: 'Không gỡ được trò chơi',
    progress: 62,
    error: flow.error,
  };
}

// update_state của Steam (chuỗi nội bộ). Ngoài 'Downloading', các bước đều là
// việc trên ổ đĩa nên gộp thành nhãn dễ hiểu.
function workingLabel(state: string): string {
  if (/validat|verif/i.test(state)) return 'Đang kiểm tra tệp';
  if (/prealloc|reconfig/i.test(state)) return 'Đang chuẩn bị ổ đĩa';
  if (/stag|commit|copy|install/i.test(state)) return 'Đang cài đặt';
  if (/stop/i.test(state)) return 'Đang dừng';
  return 'Steam đang xử lý';
}

function percentOf(downloaded: number, total: number): number | null {
  return total > 0 ? Math.max(0, Math.min(100, Math.floor((downloaded / total) * 100))) : null;
}

export function downloadForApp(state: DownloadsState | null, appid: number | null): GameDownload | null {
  if (!state || !appid) return null;
  const flow = state.installs.find((entry) => entry.appid === appid) ?? null;
  const item = state.queue.find((entry) => entry.appid === appid) ?? null;
  const active = state.active?.appid === appid ? state.active : null;
  const base = {
    appid,
    name: active?.name ?? item?.name ?? flow?.name ?? null,
    percent: null as number | null,
    downloaded: 0,
    total: 0,
    bytesPerSec: 0,
    etaSec: null as number | null,
    error: null as string | null,
    eulas: null as SteamEula[] | null,
    config: null as InstallConfig | null,
  };

  if (flow && (flow.phase === 'starting' || flow.phase === 'wizard')) {
    return {
      ...base,
      status: 'preparing',
      label: state.steam.status === 'starting' ? 'Đang mở Steam trên máy tính' : 'Đang chuẩn bị cài đặt',
    };
  }
  if (flow?.phase === 'config' && flow.config) {
    return { ...base, status: 'config', label: 'Chọn nơi cài đặt', total: flow.config.requiredBytes, config: flow.config };
  }
  if (flow?.phase === 'eula') {
    return { ...base, status: 'eula', label: 'Cần đồng ý điều khoản', eulas: flow.eulas ?? [] };
  }
  if (flow && (flow.phase === 'failed' || flow.phase === 'cancelled' || flow.phase === 'manual')) {
    const label = flow.phase === 'failed' ? 'Không cài được' : flow.phase === 'cancelled' ? 'Đã huỷ cài đặt' : 'Tiếp tục trên máy tính';
    return { ...base, status: flow.phase, label, error: flow.error };
  }
  if (active) {
    const downloading = /download/i.test(active.state);
    const paused = active.paused;
    return {
      ...base,
      status: paused ? 'paused' : downloading ? 'downloading' : 'working',
      label: paused ? 'Đã tạm dừng' : downloading ? 'Đang tải' : workingLabel(active.state),
      percent: active.percent,
      downloaded: active.downloaded,
      total: active.total,
      bytesPerSec: paused ? 0 : active.bytesPerSec,
      etaSec: paused ? null : active.etaSec,
    };
  }
  if (item) {
    if (item.completed) return { ...base, status: 'installed', label: 'Đã cài xong', percent: 100 };
    const calculatedPercent = item.percent ?? percentOf(item.downloaded, item.total);
    const progress = { percent: calculatedPercent, downloaded: item.downloaded, total: item.total };
    if (item.error) return { ...base, ...progress, status: 'failed', label: 'Steam báo lỗi', error: item.error };
    return item.paused
      ? { ...base, ...progress, status: 'paused', label: 'Đã tạm dừng' }
      : { ...base, ...progress, status: 'queued', label: 'Đang chờ trong hàng tải' };
  }
  if (flow?.phase === 'installed') return { ...base, status: 'installed', label: 'Đã cài xong', percent: 100 };
  if (flow?.phase === 'queued') return { ...base, status: 'queued', label: 'Đang chờ Steam bắt đầu tải' };
  return null;
}

/** Game đang chạy / sắp chạy, để hiện ở thanh tải khi game đang chọn không phải nó. */
export function primaryDownload(state: DownloadsState | null): GameDownload | null {
  if (!state) return null;
  const order = [
    state.installs.find((flow) => flow.phase === 'config' || flow.phase === 'eula')?.appid,
    state.active?.appid,
    state.installs.find((flow) => flow.phase === 'starting' || flow.phase === 'wizard')?.appid,
    state.queue.find((item) => !item.completed)?.appid,
  ];
  for (const appid of order) {
    const download = appid ? downloadForApp(state, appid) : null;
    if (download) return download;
  }
  return null;
}

const LIST_ORDER: Record<GameDownloadStatus, number> = {
  config: 0, eula: 0, downloading: 1, working: 1, paused: 2, preparing: 3, queued: 4,
  failed: 5, manual: 5, cancelled: 6, installed: 7,
};

/** Mọi lượt tải Steam đang biết (đang chạy, đang chờ, vừa xong), việc cần người trả lời lên đầu. */
export function allDownloads(state: DownloadsState | null): GameDownload[] {
  if (!state) return [];
  const appids = new Set<number>();
  for (const flow of state.installs) appids.add(flow.appid);
  if (state.active) appids.add(state.active.appid);
  for (const item of state.queue) appids.add(item.appid);
  const list: GameDownload[] = [];
  for (const appid of appids) {
    const download = downloadForApp(state, appid);
    if (download) list.push(download);
  }
  const queueIndex = (appid: number) => state.queue.find((item) => item.appid === appid)?.queueIndex ?? 0;
  return list.sort((a, b) => (LIST_ORDER[a.status] - LIST_ORDER[b.status]) || (queueIndex(a.appid) - queueIndex(b.appid)));
}

/** Còn đang diễn ra (chưa xong, chưa lỗi): dùng cho số đếm trên chuông thông báo. */
export function isDownloadActive(download: GameDownload): boolean {
  return download.status !== 'installed' && download.status !== 'failed'
    && download.status !== 'cancelled' && download.status !== 'manual';
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

/** Steam đo tốc độ bằng byte/giây; người dùng quen đọc Mbps như nhà mạng. */
export function formatSpeed(bytesPerSec: number): string {
  if (!Number.isFinite(bytesPerSec) || bytesPerSec <= 0) return '';
  const mbps = (bytesPerSec * 8) / 1_000_000;
  return `${mbps >= 100 ? Math.round(mbps) : mbps.toFixed(1)} Mbps`;
}

export function formatEta(seconds: number | null): string {
  if (seconds === null || !Number.isFinite(seconds) || seconds <= 0) return '';
  if (seconds < 60) return 'còn chưa tới 1 phút';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `còn ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `còn ${hours} giờ ${rest} phút` : `còn ${hours} giờ`;
}
