// Bấm Play trên kệ game → loading screen của stream → màn hình loading của
// chính game. Người dùng không bao giờ thấy desktop Windows ở giữa:
//
//   1. Kệ game gọi /api/pc/games/launch. PC bắt đầu phiên chơi và tối ưu máy
//      ngay (deploy/pc/game-booster.ps1), rồi kệ game chuyển sang stream.
//   2. Loading screen của stream che trong lúc kết nối. Stream lên rồi thì báo
//      `start`: PC mới mở game, vì Sunshine có thể đổi độ phân giải desktop lúc
//      bắt đầu stream và game fullscreen mở trước đó sẽ bị đổi mode giữa chừng.
//   3. Loading screen tiếp tục che khung hình cho tới khi cửa sổ game đứng ở
//      foreground, rồi mới tan ra để lộ màn hình loading của game.
//
// File này giữ phần thuần (không React) để test được bằng node --test.

export type GameSessionPhase =
  | 'queued'
  | 'boosting'
  | 'armed'
  | 'launching'
  | 'starting'
  | 'running'
  | 'ended'
  | 'cancelled'
  | 'failed';

export type GameBoostSummary = {
  trimmedMb: number;
  closedApps: string[];
  lowered: string[];
  powerPlan: string | null;
  gameMode: boolean;
  gamePriority: string | null;
};

export type GameSessionStatus = {
  id: string;
  gameId: string;
  title: string;
  phase: GameSessionPhase;
  timedOut: boolean;
  error: string | null;
  boost: GameBoostSummary | null;
};

/** What the shelf hands to the stream loading screen across the route change. */
export type PendingGameLaunch = {
  sessionId: string;
  gameId: string;
  title: string;
  heroUrl: string | null;
  logoUrl: string | null;
  createdAt: number;
};

/** A Play tap older than this no longer belongs to the stream being opened. */
export const PENDING_GAME_LAUNCH_MAX_AGE_MS = 3 * 60_000;
/** Launcher with no game process for this long: Steam is probably waiting on a dialog. */
export const LAUNCH_REVEAL_AFTER_MS = 60_000;
/**
 * Game process alive but its window never took the foreground. Một số game khác
 * vẫn có launcher/hộp thoại cần thao tác nên không bao giờ lên foreground như
 * một game: đừng che nó quá lâu. Where Winds Meet được PC agent mở thẳng game,
 * không đi qua launcher "Enter Game".
 */
export const STARTING_REVEAL_AFTER_MS = 15_000;
/** Loading screen đã che chừng này mà chưa tan thì hiện nút "Xem màn hình máy tính". */
export const COVER_SKIP_AFTER_MS = 4_000;

const TERMINAL_PHASES: ReadonlySet<GameSessionPhase> = new Set(['ended', 'cancelled', 'failed']);

// Bàn giao từ kệ game sang màn stream: sống trong bộ nhớ (một lần dùng), không
// cần storage vì hai màn cùng một tiến trình.
let pending: PendingGameLaunch | null = null;

export function savePendingGameLaunch(launch: PendingGameLaunch): void {
  pending = launch;
}

export function readPendingGameLaunch(now = Date.now()): PendingGameLaunch | null {
  return pending ? parsePendingGameLaunch(pending, now) : null;
}

export function clearPendingGameLaunch(): void {
  pending = null;
}

export function parsePendingGameLaunch(value: unknown, now: number): PendingGameLaunch | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Partial<PendingGameLaunch>;
  if (
    typeof item.sessionId !== 'string'
    || !/^[0-9a-f]{32}$/.test(item.sessionId)
    || typeof item.gameId !== 'string'
    || typeof item.title !== 'string'
    || typeof item.createdAt !== 'number'
    || now - item.createdAt > PENDING_GAME_LAUNCH_MAX_AGE_MS
  ) return null;
  return {
    sessionId: item.sessionId,
    gameId: item.gameId,
    title: item.title,
    heroUrl: typeof item.heroUrl === 'string' ? item.heroUrl : null,
    logoUrl: typeof item.logoUrl === 'string' ? item.logoUrl : null,
    createdAt: item.createdAt,
  };
}

export function isTerminalGamePhase(phase: GameSessionPhase): boolean {
  return TERMINAL_PHASES.has(phase);
}

export type GameLaunchStage = {
  /** Keep the loading screen over a stream that is already live. */
  covering: boolean;
  /** Line shown under the game title while covering. */
  label: string;
  /** 0-100, the part of the progress rail that belongs to the game. */
  progress: number;
  /** The stream is up and the PC is waiting for the go signal. */
  shouldStart: boolean;
};

/**
 * Decides what the loading screen says and whether it still covers the stream.
 * `phaseSinceMs` is how long the session has been in its current phase, used
 * to stop covering a launcher that is stuck on a dialog only the desktop shows.
 */
export function gameLaunchStage(
  title: string,
  status: GameSessionStatus | null,
  streamLive: boolean,
  phaseSinceMs: number,
): GameLaunchStage {
  if (!status) {
    return { covering: true, label: 'Đang chuẩn bị máy tính…', progress: 8, shouldStart: false };
  }
  if (status.timedOut || isTerminalGamePhase(status.phase)) {
    return {
      covering: false,
      label: status.phase === 'failed' ? gameLaunchErrorMessage(status.error) : '',
      progress: 100,
      shouldStart: false,
    };
  }
  switch (status.phase) {
    case 'queued':
    case 'boosting':
      return { covering: true, label: 'Đang tối ưu máy cho trò chơi…', progress: 20, shouldStart: false };
    case 'armed':
      return {
        covering: true,
        label: streamLive ? `Đang mở ${title}…` : 'Đã tối ưu xong · đang kết nối…',
        progress: 45,
        shouldStart: streamLive,
      };
    case 'launching':
      return {
        covering: phaseSinceMs < LAUNCH_REVEAL_AFTER_MS,
        label: `Đang mở ${title}…`,
        progress: 60,
        shouldStart: false,
      };
    case 'starting':
      return {
        covering: phaseSinceMs < STARTING_REVEAL_AFTER_MS,
        label: `${title} đang khởi động…`,
        progress: 82,
        shouldStart: false,
      };
    case 'running':
    default:
      return { covering: false, label: '', progress: 100, shouldStart: false };
  }
}

export function gameLaunchErrorMessage(code: string | null): string {
  switch (code) {
    case 'launch-failed':
      return 'Không mở được trò chơi trên máy tính.';
    case 'no-start':
      return 'Trò chơi không khởi động sau 3 phút.';
    case 'booster-died':
      return 'Trình tối ưu trên máy tính dừng đột ngột.';
    default:
      return 'Không mở được trò chơi.';
  }
}

/** Short, honest lines about what the booster actually changed on the PC. */
export function boostHighlights(boost: GameBoostSummary | null): string[] {
  if (!boost) return [];
  const lines: string[] = [];
  if (boost.trimmedMb >= 64) {
    lines.push(
      boost.trimmedMb >= 1024
        ? `Giải phóng ${(boost.trimmedMb / 1024).toLocaleString('vi-VN', { maximumFractionDigits: 1 })} GB RAM`
        : `Giải phóng ${boost.trimmedMb} MB RAM`,
    );
  }
  if (boost.closedApps.length) lines.push(`Tắt ${boost.closedApps.length} ứng dụng nền`);
  if (boost.lowered.length) lines.push('Hạ ưu tiên ứng dụng nền');
  if (boost.gamePriority) lines.push('Ưu tiên CPU cho game');
  if (boost.powerPlan) lines.push('Hiệu năng tối đa');
  if (boost.gameMode) lines.push('Game Mode');
  return lines;
}
