// Chọn ô kế tiếp khi bấm D-pad, kiểu giao diện PS5: tiêu điểm nhảy từng nấc từ
// phần tử này sang phần tử gần nhất theo hướng bấm, không có con trỏ tự do.
//
// PURE (không import react-native) để chạy được dưới `node --test`.

export type Direction = 'up' | 'down' | 'left' | 'right';

export type Rect = { x: number; y: number; w: number; h: number };

export type Candidate<T> = { item: T; rect: Rect };

const OPPOSITE_AXIS_WEIGHT = 3;
const ALIGN_WEIGHT = 0.35;
const CENTER_PULL = 0.15;

/**
 * Điểm của `target` khi đi từ `from` theo `direction` (nhỏ hơn = tốt hơn), hoặc
 * null nếu `target` không nằm về phía đó. Khoảng trống theo hướng đi được tính
 * giữa hai cạnh, độ lệch ngang hàng bị phạt nặng hơn để D-pad ưu tiên đi thẳng
 * hàng/cột thay vì nhảy chéo sang ô gần hơn một chút.
 */
export function directionScore(from: Rect, target: Rect, direction: Direction): number | null {
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'right' || direction === 'down' ? 1 : -1;

  const fromCenter = horizontal ? from.x + from.w / 2 : from.y + from.h / 2;
  const targetCenter = horizontal ? target.x + target.w / 2 : target.y + target.h / 2;
  const travel = (targetCenter - fromCenter) * sign;
  if (travel <= 1) return null;

  const gap = horizontal
    ? (sign > 0 ? target.x - (from.x + from.w) : from.x - (target.x + target.w))
    : (sign > 0 ? target.y - (from.y + from.h) : from.y - (target.y + target.h));
  const main = Math.max(0, gap) + CENTER_PULL * travel;

  const [fromStart, fromEnd] = horizontal ? [from.y, from.y + from.h] : [from.x, from.x + from.w];
  const [targetStart, targetEnd] = horizontal ? [target.y, target.y + target.h] : [target.x, target.x + target.w];
  const cross = Math.max(0, Math.max(fromStart, targetStart) - Math.min(fromEnd, targetEnd));
  const align = Math.abs(
    horizontal
      ? target.y + target.h / 2 - (from.y + from.h / 2)
      : target.x + target.w / 2 - (from.x + from.w / 2),
  );
  return main + cross * OPPOSITE_AXIS_WEIGHT + align * ALIGN_WEIGHT;
}

/** Ô gần nhất theo hướng, hoặc null khi đã ở rìa. */
export function pickNeighbor<T>(from: Rect, candidates: Array<Candidate<T>>, direction: Direction): T | null {
  let best: T | null = null;
  let bestScore = Infinity;
  for (const candidate of candidates) {
    const score = directionScore(from, candidate.rect, direction);
    if (score !== null && score < bestScore) {
      best = candidate.item;
      bestScore = score;
    }
  }
  return best;
}

/** Ô gần nhất với một điểm (dùng khi ô đang được chọn biến mất). */
export function pickNearest<T>(point: { x: number; y: number }, candidates: Array<Candidate<T>>): T | null {
  let best: T | null = null;
  let bestDistance = Infinity;
  for (const { item, rect } of candidates) {
    const dx = rect.x + rect.w / 2 - point.x;
    const dy = rect.y + rect.h / 2 - point.y;
    const distance = dx * dx + dy * dy;
    if (distance < bestDistance) {
      best = item;
      bestDistance = distance;
    }
  }
  return best;
}

/** Ô mặc định khi chưa có tiêu điểm: trên cùng, rồi trái nhất. */
export function pickFirst<T>(candidates: Array<Candidate<T>>): T | null {
  let best: T | null = null;
  let bestKey = Infinity;
  for (const { item, rect } of candidates) {
    const key = rect.y + rect.h / 2 + (rect.x + rect.w / 2) * 0.25;
    if (key < bestKey) {
      best = item;
      bestKey = key;
    }
  }
  return best;
}

/** Độ cuộn cần thêm để `rect` nằm trọn trong `viewport` (cùng trục), có đệm `padding`. */
export function revealDelta(rect: Rect, viewport: Rect, axis: 'x' | 'y', padding: number): number {
  const start = axis === 'x' ? rect.x : rect.y;
  const size = axis === 'x' ? rect.w : rect.h;
  const viewStart = axis === 'x' ? viewport.x : viewport.y;
  const viewSize = axis === 'x' ? viewport.w : viewport.h;
  // Phần tử lớn hơn khung nhìn: căn đầu phần tử vào đầu khung.
  if (size + padding * 2 >= viewSize) return start - viewStart - padding;
  if (start < viewStart + padding) return start - viewStart - padding;
  const end = start + size;
  const viewEnd = viewStart + viewSize;
  if (end > viewEnd - padding) return end - viewEnd + padding;
  return 0;
}
