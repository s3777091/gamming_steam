// Tần số quét của màn hình. Web phải ĐO bằng requestAnimationFrame vì trình
// duyệt không cho biết Hz; native hỏi thẳng Display.refreshRate nên không có
// phép đo nào cả, chỉ chốt về bậc fps mà Sunshine nhận.

import { getDisplayInfo } from 'jetsona-input';

// Những tần số quét có thật trên panel bán ra ngoài. Đo được 118.7 Hz nghĩa là
// panel 120 Hz chứ không phải "118.7 fps".
const REFRESH_TIERS = [60, 75, 90, 100, 120, 144, 165, 240] as const;

/** Các bậc fps `frame_rate` chấp nhận, trừ 30 — auto không bao giờ tự hạ xuống đó. */
const FRAME_RATE_TIERS = [60, 90, 120, 144] as const;
export type AutoFrameRate = (typeof FRAME_RATE_TIERS)[number];

/** Chốt một số Hz thô về bậc tần số quét thật gần nhất (sai số 6%), hoặc null. */
export function snapRefreshHz(hz: number | null): number | null {
  if (hz == null || !Number.isFinite(hz)) return null;
  let best: number | null = null;
  for (const tier of REFRESH_TIERS) {
    if (Math.abs(hz - tier) / tier > 0.06) continue;
    if (best == null || Math.abs(hz - tier) < Math.abs(hz - best)) best = tier;
  }
  return best;
}

/**
 * fps nên xin khi người dùng để `frame_rate` ở "auto".
 *
 * Không bao giờ vượt tần số quét, và không bao giờ xuống dưới 60.
 */
export function autoFrameRate(refreshHz: number | null): AutoFrameRate {
  const snapped = snapRefreshHz(refreshHz);
  if (snapped == null) return 60;
  let chosen: AutoFrameRate = 60;
  for (const tier of FRAME_RATE_TIERS) {
    if (tier <= snapped) chosen = tier;
  }
  return chosen;
}

/** Tần số quét đã chốt bậc của màn hình này. Đồng bộ, không tốn gì. */
export async function displayRefreshHz(): Promise<number | null> {
  return snapRefreshHz(getDisplayInfo()?.refreshRate ?? null);
}
