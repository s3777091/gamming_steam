// Chế độ Game Booster là tuỳ chọn LOCAL (AsyncStorage) của thiết bị này, gửi
// kèm mỗi lần bấm Play (xem usePcLibrary.launchSelected). Không đồng bộ cloud:
// chơi bằng tablet ở nhà và điện thoại ngoài đường có thể muốn mức khác nhau.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_GAME_BOOST_MODE, parseGameBoostMode, type GameBoostMode } from './game-booster';

const GAME_BOOST_MODE_KEY = 'jetsona.game.boost_mode';

const listeners = new Set<(mode: GameBoostMode) => void>();
let cached: GameBoostMode | null = null;

export async function getGameBoostMode(): Promise<GameBoostMode> {
  if (cached !== null) return cached;
  try {
    const raw = await AsyncStorage.getItem(GAME_BOOST_MODE_KEY);
    cached = raw === null ? DEFAULT_GAME_BOOST_MODE : parseGameBoostMode(raw);
  } catch {
    cached = DEFAULT_GAME_BOOST_MODE;
  }
  return cached;
}

export async function setGameBoostMode(mode: GameBoostMode): Promise<void> {
  cached = mode;
  listeners.forEach((listener) => listener(mode));
  try {
    await AsyncStorage.setItem(GAME_BOOST_MODE_KEY, mode);
  } catch {
    // ghi thất bại không chặn UI; giá trị trong RAM vẫn đúng cho phiên này.
  }
}

export function subscribeGameBoostMode(listener: (mode: GameBoostMode) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
