// Cổng duy nhất tới dữ liệu máy tính ở nhà: thư viện game, Steam Store, hồ sơ
// Steam, phiên chơi, cài đặt game.
//
// Mặc định là backend Jetsona (`/api/pc/*`) — chính các route mà web đang dùng,
// đứng trước proxy Steam (steam.protexa.cloud) vì Việt Nam chặn Steam. Muốn trỏ
// sang một API khác (agent steamapi đang làm, hoặc môi trường thử) chỉ cần đổi
// MỘT chỗ: biến EXPO_PUBLIC_PC_API_URL hoặc `extra.pcApiBaseUrl` trong app.json.
// Toàn bộ UI chỉ gọi qua `pcFetch`/`pcFetchJson`, không nơi nào ghép URL riêng.

import Constants from 'expo-constants';

import { apiFetch } from '@/lib/api';
import { getBackendBaseUrl } from '@/lib/config';
import { UI_DEMO, demoResponse } from '@/lib/demo';

const extra = (Constants.expoConfig?.extra ?? {}) as { pcApiBaseUrl?: string };

function override(): string | null {
  const value = process.env.EXPO_PUBLIC_PC_API_URL || extra.pcApiBaseUrl || '';
  return value.trim() ? value.trim().replace(/\/+$/, '') : null;
}

/** Gốc của API máy tính, theo region đang hoạt động khi không có ghi đè. */
export function pcApiBase(): string {
  return override() ?? `${getBackendBaseUrl().replace(/\/+$/, '')}/api/pc`;
}

export function pcApiUrl(path: string): string {
  return `${pcApiBase()}${path.startsWith('/') ? path : `/${path}`}`;
}

/** Các đường dẫn logic; đổi API chỉ cần sửa bảng này nếu hình dạng route khác. */
export const PC_ROUTES = {
  games: '/games',
  gameAchievements: (appId: number) => `/games/${appId}/achievements`,
  gameNews: (appId: number) => `/games/${appId}/news`,
  gameLaunch: '/games/launch',
  gameInstall: '/games/install',
  gameUninstall: '/games/uninstall',
  gameSession: '/games/session',
  gameRuntime: '/games/runtime',
  store: '/store',
  storeSearch: (query: string) => `/store/search?q=${encodeURIComponent(query)}`,
  storeDetail: (appId: number) => `/store/${appId}`,
  storePurchase: '/store/purchase',
  storeOwnership: (appId: number) => `/store/${appId}/ownership`,
  steamProfile: '/steam/profile',
  display: '/display',
  clipboard: '/clipboard',
  clipboardState: '/clipboard/state',
  keystate: '/keystate',
  sleep: '/sleep',
  shutdown: '/shutdown',
} as const;

export function pcFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return apiFetch(pcApiUrl(path), init);
}

export type PcJson = { ok?: boolean; error?: string };

/** GET JSON, ném đúng thông điệp lỗi mà API trả về. */
export async function pcFetchJson<T extends PcJson>(
  path: string,
  fallbackError: string,
  isValid: (data: T) => boolean = () => true,
  signal?: AbortSignal,
): Promise<T> {
  if (UI_DEMO) {
    const sample = demoResponse(path) as T | null;
    if (sample) {
      if (!sample.ok || !isValid(sample)) throw new Error(sample.error || fallbackError);
      return sample;
    }
  }
  const response = await pcFetch(path, { cache: 'no-store', signal });
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok || !data?.ok || !isValid(data)) {
    throw new Error(data?.error || fallbackError);
  }
  return data;
}

export async function pcPostJson<T extends PcJson>(
  path: string,
  body: unknown,
  fallbackError: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await pcFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });
  const data = await response.json().catch(() => null) as T | null;
  if (!response.ok || !data?.ok) throw new Error(data?.error || fallbackError);
  return data;
}
