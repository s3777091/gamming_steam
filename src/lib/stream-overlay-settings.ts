// "Viền báo đang streaming" là tuỳ chọn LOCAL (AsyncStorage), không đồng bộ cloud
// (P3/P2). Nút bật/tắt trong cài đặt chỉ ảnh hưởng thiết bị này; không thay đổi
// stream_settings row. Rollback phải giữ nguyên giá trị này (cùng hud_enabled,
// region, ice_mode).

import AsyncStorage from '@react-native-async-storage/async-storage';

const LIVE_BORDER_KEY = 'jetsona.stream.live_border';
const DEFAULT_LIVE_BORDER = true;

const listeners = new Set<(enabled: boolean) => void>();
let cached: boolean | null = null;

export async function getLiveBorderEnabled(): Promise<boolean> {
  if (cached !== null) return cached;
  try {
    const raw = await AsyncStorage.getItem(LIVE_BORDER_KEY);
    cached = raw === null ? DEFAULT_LIVE_BORDER : raw === '1';
  } catch {
    cached = DEFAULT_LIVE_BORDER;
  }
  return cached;
}

export async function setLiveBorderEnabled(enabled: boolean): Promise<void> {
  cached = enabled;
  try {
    await AsyncStorage.setItem(LIVE_BORDER_KEY, enabled ? '1' : '0');
  } catch {
    // ghi thất bại không chặn UI; giá trị trong RAM vẫn đúng cho phiên này.
  }
  listeners.forEach((listener) => listener(enabled));
}

export function subscribeLiveBorderEnabled(listener: (enabled: boolean) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}