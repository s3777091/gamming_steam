// Cấu hình runtime cho app native. Lấy từ app.json -> expoConfig.extra (do
// `npx expo install` / EAS Update đẩy xuống), với hằng số chỉnh tay làm rơi
// cuối cùng để chạy máy ngay được.
//
// Cách dùng nhanh: sửa hai hằng số EDITABLE_* dưới đây rồi `npx expo start`.
// Triển khai正经: đặt cùng tên vào app.json `extra` (hoặc .env + babel inline)
// để không commit thông tin đăng nhập.
//
// backendBaseUrl = URL tuyệt đối của origin VN (server jetsona-ui Next.js +
// self-hosted Supabase phía sau Caddy). Mọi endpoint web (/api/wol/wake,
// /media/jetsona/whep, /pc/api/*) và Supabase (/auth/v1, /rest/v1, /realtime/v1)
// đều nằm dưới gốc đó. Người xem Trung Quốc đi qua edge HK `cn.protexa.cloud`
// để né GFW — cả hai domain đều đánh về cùng origin VN, nên cùng một self-hosted
// Supabase và cùng backend. Bản web chọn host bằng same-origin
// (window.location.origin); bản native không có origin nên tự chọn host theo
// region (xem region-routing.ts). Input KHÔNG qua /input WebSocket nữa: chạy
// trên data channel "input" của cùng peer WebRTC.

import Constants from 'expo-constants';

import type { ViewerRegion } from './stream-settings';

type Extra = {
  backendBaseUrl?: string;
  supabaseAnonKey?: string;
};

// ┌── Sửa chỗ này để chạy máy không cần cấu hình ──────────────────────────┐
const EDITABLE = {
  backendBaseUrl: '',
  supabaseAnonKey: '',
};
// └────────────────────────────────────────────────────────────────────────┘

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

function pick(env: string | undefined, fallback: string): string {
  return env && env.trim().length > 0 ? env.trim() : fallback;
}

// Origin VN — env/extra/EDITABLE (dev dùng LAN IP). Production:
// https://vn.protexa.cloud.
const CONFIGURED_VN_HOST = pick(
  process.env.EXPO_PUBLIC_BACKEND_URL,
  pick(extra.backendBaseUrl, EDITABLE.backendBaseUrl),
);
export const SUPABASE_ANON_KEY = pick(
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  pick(extra.supabaseAnonKey, EDITABLE.supabaseAnonKey),
);

/**
 * Host theo khu vực người xem. Cả hai domain đều终止 tại cùng origin VN
 * (self-hosted Supabase + backend qua Caddy); `cn.protexa.cloud` đi qua edge
 * HK để người xem Trung Quốc không bị GFW chặn đường thẳng tới `vn.protexa.cloud`.
 * `vn` lấy từ cấu hình (env/extra/EDITABLE) để dev chạy LAN; `cn` cố định edge.
 */
export const REGION_HOSTS: Record<ViewerRegion, string> = {
  vn: CONFIGURED_VN_HOST || 'https://vn.protexa.cloud',
  cn: 'https://cn.protexa.cloud',
};

// Region đang hoạt động — do region-routing.bootstrapActiveRegion() đặt ngay
// khi app khởi động, TRƯỚC khi tạo Supabase client. Mặc định 'vn' cho đến lúc
// bootstrap chốt lại.
let activeRegion: ViewerRegion = 'vn';

export function getActiveRegion(): ViewerRegion {
  return activeRegion;
}

export function setActiveRegion(region: ViewerRegion): void {
  activeRegion = region;
}

/** Base URL của backend + Supabase cho region đang hoạt động. */
export function getBackendBaseUrl(): string {
  return REGION_HOSTS[activeRegion];
}

/**
 * Supabase URL = cùng host với backend (self-hosted phía sau Caddy, same-origin
 * như bản web). Theo region: vn viewer -> vn.protexa.cloud, cn viewer ->
 * cn.protexa.cloud (edge HK).
 */
export function getSupabaseUrl(): string {
  return REGION_HOSTS[activeRegion];
}

// Hằng số giữ lại cho cờ *Configured (đánh giá lúc module load, region mặc định
// 'vn'). Code cần host theo region phải dùng backendUrl()/getBackendBaseUrl().
export const BACKEND_BASE_URL = REGION_HOSTS.vn;
export const SUPABASE_URL = REGION_HOSTS.vn;

/** true khi chưa cấu hình Supabase — app sẽ chạy ở chế độ "khách" (xem stream Jetson). */
export const supabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
/** true khi có backend — chưa có thì các nút nguồn/PC tự tắt. */
export const backendConfigured = Boolean(BACKEND_BASE_URL);

/** Ghép path tương đối với backend của region đang hoạt động; chấp nhận path bắt đầu bằng '/' hoặc không. */
export function backendUrl(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = getBackendBaseUrl().replace(/\/+$/, '');
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${suffix}`;
}