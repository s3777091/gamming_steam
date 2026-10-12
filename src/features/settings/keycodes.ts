// Đổi keycode Android sang `KeyboardEvent.code` của web.
//
// `controller_settings.host_shortcuts` / `keyboard_remaps` dùng mã của web
// (KeyQ, ControlRight…) và dùng chung giữa web và app, nên app phải nói cùng
// ngôn ngữ ấy. Bảng này phủ phần bàn phím mà phím tắt thực tế dùng tới.

const TABLE: Record<number, string> = {
  4: 'Escape', // KEYCODE_BACK từ bàn phím không có; giữ để an toàn
  111: 'Escape',
  62: 'Space', 66: 'Enter', 61: 'Tab', 67: 'Backspace', 112: 'Delete', 124: 'Insert',
  122: 'Home', 123: 'End', 92: 'PageUp', 93: 'PageDown',
  19: 'ArrowUp', 20: 'ArrowDown', 21: 'ArrowLeft', 22: 'ArrowRight',
  59: 'ShiftLeft', 60: 'ShiftRight', 113: 'ControlLeft', 114: 'ControlRight',
  57: 'AltLeft', 58: 'AltRight', 117: 'MetaLeft', 118: 'MetaRight', 115: 'CapsLock',
  74: 'Semicolon', 70: 'Equal', 55: 'Comma', 69: 'Minus', 56: 'Period', 76: 'Slash',
  68: 'Backquote', 71: 'BracketLeft', 73: 'Backslash', 72: 'BracketRight', 75: 'Quote',
};

for (let i = 0; i < 26; i += 1) TABLE[29 + i] = `Key${String.fromCharCode(65 + i)}`;
for (let i = 0; i < 10; i += 1) TABLE[7 + i] = `Digit${i}`;
for (let i = 0; i < 12; i += 1) TABLE[131 + i] = `F${i + 1}`;

/** `KeyboardEvent.code` tương ứng, hoặc null khi phím không có chỗ trong bảng. */
export function webCodeForKeyCode(keyCode: number): string | null {
  return TABLE[keyCode] ?? null;
}

/** Ngược lại: Android keycode từ mã web (dùng để áp đổi phím trên luồng gửi sang PC). */
const REVERSE = new Map<string, number>(Object.entries(TABLE).map(([keyCode, code]) => [code, Number(keyCode)]));
export function keyCodeForWebCode(code: string): number | null {
  return REVERSE.get(code) ?? null;
}

const VK_BY_CODE: Record<string, number> = {
  Escape: 0x1B, Space: 0x20, Enter: 0x0D, Tab: 0x09, Backspace: 0x08, Delete: 0x2E, Insert: 0x2D,
  Home: 0x24, End: 0x23, PageUp: 0x21, PageDown: 0x22,
  ArrowLeft: 0x25, ArrowUp: 0x26, ArrowRight: 0x27, ArrowDown: 0x28,
  ShiftLeft: 0xA0, ShiftRight: 0xA1, ControlLeft: 0xA2, ControlRight: 0xA3, AltLeft: 0xA4, AltRight: 0xA5,
  MetaLeft: 0x5B, MetaRight: 0x5C, CapsLock: 0x14,
  Semicolon: 0xBA, Equal: 0xBB, Comma: 0xBC, Minus: 0xBD, Period: 0xBE, Slash: 0xBF, Backquote: 0xC0,
  BracketLeft: 0xDB, Backslash: 0xDC, BracketRight: 0xDD, Quote: 0xDE,
};
for (let i = 0; i < 26; i += 1) VK_BY_CODE[`Key${String.fromCharCode(65 + i)}`] = 0x41 + i;
for (let i = 0; i < 10; i += 1) VK_BY_CODE[`Digit${i}`] = 0x30 + i;
for (let i = 0; i < 12; i += 1) VK_BY_CODE[`F${i + 1}`] = 0x70 + i;

/** Windows virtual-key cho một `KeyboardEvent.code` (dùng khi đổi phím gửi sang PC). */
export function vkForWebCode(code: string): number | null {
  return VK_BY_CODE[code] ?? null;
}
