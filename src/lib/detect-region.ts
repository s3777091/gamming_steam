// Nhận dạng khu vực người xem từ IP (/api/region). P1: gọi TRƯỚC phiên đầu tiên,
// giữ giá trị hiện tại khi lỗi — KHÔNG lặng lẽ rơi về 'vn' (xem ghi chú trong
// stream-settings: region là vị trí, không phải preference; rơi về vn sẽ
// giấu lỗi migration/CHECK constraint thành "sao stream vẫn 1440p").
//
// Backend trả { ok, detected: 'vn' | 'cn' | null }. detected=null cho viewer
// ở nước thứ ba/VPN/qua edge (edge HK nhìn IP edge, không có trong bảng APNIC)
// — giữ region hiện tại (đã được region-routing bootstrap chốt sẵn).

import { apiFetch } from '@/lib/api';
import type { ViewerRegion } from './stream-settings';

export async function detectRegion(current: ViewerRegion): Promise<ViewerRegion> {
  try {
    const response = await apiFetch('/api/region', { cache: 'no-store' });
    if (!response.ok) return current;
    const data = (await response.json()) as { detected?: unknown };
    const detected = data.detected;
    if (detected === 'vn' || detected === 'cn') return detected;
    return current;
  } catch {
    return current;
  }
}