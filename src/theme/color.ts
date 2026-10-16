// Token màu nhấn và bề mặt của theme luôn viết ở dạng hex (#rgb hoặc #rrggbb) để pha được.

function rgb(hex: string): [number, number, number] | null {
  let h = hex.startsWith('#') ? hex.slice(1) : hex;
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h.slice(0, 6), 16);
  if (h.length < 6 || Number.isNaN(n)) return null;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Pha alpha: alpha('#66a8ff', 0.35) → 'rgba(102, 168, 255, 0.35)'. */
export function alpha(hex: string, a: number): string {
  const c = rgb(hex);
  return c ? `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})` : hex;
}

/** Trộn hai màu hex: mix(a, b, 0) = a, mix(a, b, 1) = b. */
export function mix(a: string, b: string, t: number): string {
  const x = rgb(a);
  const y = rgb(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}
