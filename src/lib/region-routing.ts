// Chọn host theo khu vực NGƯỜI XEM, chạy ngay khi app khởi động — TRƯỚC khi
// tạo Supabase client (xem App.tsx). Cả hai domain (`vn.protexa.cloud`,
// `cn.protexa.cloud`) đều đánh về cùng origin VN; `cn` chỉ đi qua edge HK để
// né GFW cho người xem Trung Quốc. Bản web chọn host bằng same-origin
// (window.location.origin), bản native phải tự chọn.
//
// Chiến lược bootstrap:
//   1. Đọc region đã lưu trong AsyncStorage -> dùng luôn (CN viewer lần sau
//      khởi động qua edge cn, không phải chạm vn trước).
//   2. Lần đầu: dò /api/region trên origin vn (short timeout). Backend trả
//      {ok, detected: 'vn'|'cn'|null} dựa IP thật của viewer. detected==='cn'
//      -> dùng edge cn; còn lại -> vn.
//   3. Nếu vn không tới được (GFW chặn đường thẳng) -> rơi về edge cn.
// Region được lưu lại để lần kế tiếp bootstrap ngay qua đúng edge.

import AsyncStorage from '@react-native-async-storage/async-storage';

import { REGION_HOSTS, getActiveRegion, setActiveRegion } from '@/lib/config';
import type { ViewerRegion } from './stream-settings';

const REGION_KEY = 'jetsona:active-region';
const PROBE_TIMEOUT_MS = 4000;

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, cache: 'no-store' });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Chốt region hoạt động cho phiên. Phải chạy xong trước khi tạo Supabase client
 * lần đầu. Trả về region đã chọn.
 */
export async function bootstrapActiveRegion(): Promise<ViewerRegion> {
  const persisted = await AsyncStorage.getItem(REGION_KEY);
  if (persisted === 'vn' || persisted === 'cn') {
    setActiveRegion(persisted);
    return persisted;
  }

  // Lần đầu: dò qua origin vn. Endpoint công khai, không cần auth.
  try {
    const res = await fetchWithTimeout(`${REGION_HOSTS.vn}/api/region`, PROBE_TIMEOUT_MS);
    if (res.ok) {
      const data = (await res.json()) as { detected?: unknown };
      const region: ViewerRegion = data.detected === 'cn' ? 'cn' : 'vn';
      setActiveRegion(region);
      await AsyncStorage.setItem(REGION_KEY, region);
      return region;
    }
  } catch {
    // vn không tới được (GFW) -> đi edge cn.
  }

  const fallback: ViewerRegion = 'cn';
  setActiveRegion(fallback);
  await AsyncStorage.setItem(REGION_KEY, fallback);
  return fallback;
}

/** Lưu lại region để lần sau bootstrap qua đúng edge (gọi sau khi detectRegion refine). */
export async function persistActiveRegion(region: ViewerRegion): Promise<void> {
  if (getActiveRegion() !== region) setActiveRegion(region);
  await AsyncStorage.setItem(REGION_KEY, region);
}