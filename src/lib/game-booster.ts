// Game Booster: mức tối ưu máy tính mà deploy/pc/game-booster.ps1 áp dụng khi
// bấm Play. App chỉ chọn MỨC; PC tự quyết làm gì ở mỗi mức và tự trả lại mọi
// thứ khi game thoát. Bảng `actions` dưới đây phải khớp `$boostPresets` trong
// script đó, vì nó là lời hứa với người dùng về những gì sẽ đổi trên máy.
//
// File này thuần (không React, không storage) để test được bằng node --test.

export type GameBoostMode = 'auto' | 'high' | 'balanced' | 'low';

/** Mức PC thực sự chạy; `auto` được PC đổi thành một trong ba mức này. */
export type ResolvedGameBoostMode = Exclude<GameBoostMode, 'auto'>;

export const GAME_BOOST_MODES: GameBoostMode[] = ['auto', 'high', 'balanced', 'low'];

export const DEFAULT_GAME_BOOST_MODE: GameBoostMode = 'auto';

export type GameBoostAction =
  | 'powerPlan'
  | 'gameMode'
  | 'closeApps'
  | 'lowerPriority'
  | 'trimMemory'
  | 'gamePriority'
  | 'noThrottle';

export const GAME_BOOST_ACTION_LABEL: Record<GameBoostAction, string> = {
  powerPlan: 'Power plan hiệu năng cao',
  gameMode: 'Bật Windows Game Mode',
  closeApps: 'Tắt app nền (OneDrive, Widgets…)',
  lowerPriority: 'Hạ ưu tiên trình duyệt, Spotify',
  trimMemory: 'Giải phóng RAM cho game',
  gamePriority: 'Ưu tiên CPU cho game',
  noThrottle: 'Chặn Windows bóp xung game',
};

export const GAME_BOOST_ACTION_ORDER: GameBoostAction[] = [
  'powerPlan',
  'gameMode',
  'gamePriority',
  'noThrottle',
  'trimMemory',
  'lowerPriority',
  'closeApps',
];

export const GAME_BOOST_META: Record<GameBoostMode, {
  label: string;
  short: string;
  description: string;
  actions: GameBoostAction[];
}> = {
  auto: {
    label: 'Tự động',
    short: 'Auto',
    description: 'Máy tính tự chọn: cắm sạc thì Hiệu năng cao, chạy pin thì Cân bằng.',
    actions: [],
  },
  high: {
    label: 'Hiệu năng cao',
    short: 'Cao',
    description: 'FPS cao và ổn định nhất. Máy chạy nóng và tốn điện hơn.',
    actions: ['powerPlan', 'gameMode', 'gamePriority', 'noThrottle', 'trimMemory', 'lowerPriority', 'closeApps'],
  },
  balanced: {
    label: 'Cân bằng',
    short: 'Cân bằng',
    description: 'Mượt mà không đụng power plan hay tắt app nào của bạn.',
    actions: ['gameMode', 'gamePriority', 'noThrottle', 'trimMemory', 'lowerPriority'],
  },
  low: {
    label: 'Tiết kiệm',
    short: 'Tiết kiệm',
    description: 'Gần như không đổi gì trên máy. Mát, êm, hợp game nhẹ hoặc laptop.',
    actions: ['gameMode'],
  },
};

export function isGameBoostMode(value: unknown): value is GameBoostMode {
  return typeof value === 'string' && (GAME_BOOST_MODES as string[]).includes(value);
}

export function parseGameBoostMode(value: unknown): GameBoostMode {
  return isGameBoostMode(value) ? value : DEFAULT_GAME_BOOST_MODE;
}

export function isResolvedGameBoostMode(value: unknown): value is ResolvedGameBoostMode {
  return isGameBoostMode(value) && value !== 'auto';
}
