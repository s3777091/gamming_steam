// Tiện ích nhỏ dùng chung cho app native. Tương đương cn() bên web nhưng RN
// không dùng Tailwind, nên ở đây chỉ gộp mảng class-type string cho dễ đọc.

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Gộp nhiều style object/array của RN, bản sau đè bản trước. */
export type StyleProp = Record<string, unknown> | Array<Record<string, unknown> | undefined | false | null> | undefined;

export function mergeStyles(...styles: Array<StyleProp>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const style of styles) {
    if (!style) continue;
    const list = Array.isArray(style) ? style : [style];
    for (const item of list) {
      if (!item) continue;
      Object.assign(out, item);
    }
  }
  return out;
}