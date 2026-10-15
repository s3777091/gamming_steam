// Game đang chơi dở trên PC sau khi người dùng bấm Home trong Control Center.
//
// Bấm Home chỉ rời màn stream (trả phiên Sunshine); game vẫn chạy trên PC. Ô
// game trên dock Control Center ở màn chính đọc giá trị này để hiện logo game,
// bấm vào thì mở lại stream và đưa đúng game đó lên foreground. Mỗi lần chỉ
// stream một game nên chỉ cần nhớ một giá trị.
//
// Lưu cả xuống AsyncStorage: Android có thể giết app khi nằm nền, mà game trên PC
// vẫn chạy. Chỉ QUÊN khi chính người dùng thoát game, hoặc khi nối lại mà PC báo
// game không còn chạy — không đoán theo danh sách quét tiến trình của PC, vì
// game mở qua launcher có thể không khớp đường dẫn cài đặt và bị bỏ sót.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type ResumableGame = {
  gameId: string;
  title: string;
  heroUrl: string | null;
  logoUrl: string | null;
};

const STORAGE_KEY = 'jetsona.stream.resumable';
/** Quá lâu không quay lại thì coi như phiên chơi đó đã xong. */
const MAX_AGE_MS = 24 * 60 * 60_000;

let current: ResumableGame | null = null;
let hydrated = false;
let pendingResume: ResumableGame | null = null;
const listeners = new Set<(game: ResumableGame | null) => void>();

function emit() {
  listeners.forEach((listener) => listener(current));
}

function persist() {
  const write = current
    ? AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, savedAt: Date.now() }))
    : AsyncStorage.removeItem(STORAGE_KEY);
  void write.catch(() => {});
}

function parseStored(raw: string | null): ResumableGame | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<ResumableGame> & { savedAt?: number };
    if (typeof value.gameId !== 'string' || !value.gameId || typeof value.title !== 'string') return null;
    if (typeof value.savedAt !== 'number' || Date.now() - value.savedAt > MAX_AGE_MS) return null;
    return {
      gameId: value.gameId,
      title: value.title,
      heroUrl: typeof value.heroUrl === 'string' ? value.heroUrl : null,
      logoUrl: typeof value.logoUrl === 'string' ? value.logoUrl : null,
    };
  } catch {
    return null;
  }
}

/** Đọc lại game đã lưu sau khi app khởi động lại (gọi một lần ở màn chính). */
export async function hydrateResumableGame(): Promise<ResumableGame | null> {
  if (hydrated) return current;
  hydrated = true;
  const stored = parseStored(await AsyncStorage.getItem(STORAGE_KEY).catch(() => null));
  // Trong lúc đọc mà đã có game mới thì giữ game mới.
  if (!current && stored) {
    current = stored;
    emit();
  }
  return current;
}

export function rememberStreamGame(game: ResumableGame): void {
  hydrated = true;
  if (
    current
    && current.gameId === game.gameId
    && current.title === game.title
    && current.heroUrl === game.heroUrl
    && current.logoUrl === game.logoUrl
  ) return;
  current = game;
  persist();
  emit();
}

/** Người dùng thoát game, hoặc PC xác nhận game không còn chạy: bỏ ô game. */
export function forgetStreamGame(gameId?: string): void {
  hydrated = true;
  if (!current || (gameId && current.gameId !== gameId)) return;
  current = null;
  persist();
  emit();
}

export function readResumableGame(): ResumableGame | null {
  return current;
}

export function subscribeResumableGame(listener: (game: ResumableGame | null) => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Bàn giao một lần cho màn stream: nối lại rồi đưa game này lên foreground. */
export function requestStreamResume(game: ResumableGame): void {
  pendingResume = game;
}

export function takeStreamResume(): ResumableGame | null {
  const game = pendingResume;
  pendingResume = null;
  return game;
}
