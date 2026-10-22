/** Wire data is versioned and contains only normalized screenshot coordinates. */
export type Point = { x: number; y: number };
export type Geometry = { width: number; height: number };
export const BUTTON_BITS = {
  a: 0x1000, b: 0x2000, x: 0x4000, y: 0x8000,
  up: 1, down: 2, left: 4, right: 8, l1: 0x100, r1: 0x200, l3: 0x40, r3: 0x80,
} as const;
export const AXIS_CONTROLS = ['l2', 'r2', 'ls-up', 'ls-down', 'ls-left', 'ls-right', 'rs-up', 'rs-down', 'rs-left', 'rs-right'] as const;
export type Control = keyof typeof BUTTON_BITS | typeof AXIS_CONTROLS[number];
export const CONTROLS = [...Object.keys(BUTTON_BITS), ...AXIS_CONTROLS] as Control[];
export const controlLabel = (control: Control) => control.toUpperCase().replace('LS-', 'L ').replace('RS-', 'R ');
export type PadState = { buttons: number; lt: number; rt: number; lx: number; ly: number; rx: number; ry: number };
export type Step =
  | { type: 'tap'; point: Point; durationMs: number }
  | { type: 'hold'; point: Point; durationMs: number }
  | { type: 'double'; point: Point; durationMs: number; intervalMs: number }
  | { type: 'wait'; durationMs: number }
  | { type: 'random'; minMs: number; maxMs: number }
  | { type: 'drag'; point: Point; end: Point; durationMs: number; initialHoldMs: number };
export type Binding = { id: string; name: string; controls: Control[]; point: Point; steps: Step[]; repeat: number; physicalHold: boolean };
export function anchorBinding(binding: Binding): Binding {
  const step = binding.steps.find(s => 'point' in s);
  return step && 'point' in step ? { ...binding, point: step.point } : binding;
}
export type MappingProfile = {
  id: string; user_id: string; game_id: string; game_title: string; name: string; description: string;
  screenshot_path: string; screenshot: Geometry; bindings: Binding[];
  settings: { markerOpacity: number }; schema_version: 1; created_at: string; updated_at: string;
};
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export function screenshotMimeType(bytes: ArrayBuffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  const b = new Uint8Array(bytes);
  const png = [137, 80, 78, 71, 13, 10, 26, 10].every((n, i) => b[i] === n);
  const jpeg = b[0] === 255 && b[1] === 216 && b[2] === 255;
  const webp = b[0] === 82 && b[1] === 73 && b[2] === 70 && b[3] === 70 && b[8] === 87 && b[9] === 69 && b[10] === 66 && b[11] === 80;
  return png ? 'image/png' : jpeg ? 'image/jpeg' : webp ? 'image/webp' : null;
}
export function validateScreenshot(bytes: ArrayBuffer, mime: string) {
  if (bytes.byteLength > MAX_IMAGE_BYTES || !mime || screenshotMimeType(bytes) !== mime) throw new Error('Chọn ảnh PNG, JPEG hoặc WebP hợp lệ, tối đa 10 MB.');
}
export const MAX_DURATION_MS = 60_000;
export const MAX_EXECUTION_MS = 300_000;
export const isPoint = (p: unknown): p is Point => Boolean(p && typeof p === 'object' &&
  Number.isFinite((p as Point).x) && Number.isFinite((p as Point).y) &&
  (p as Point).x >= 0 && (p as Point).x <= 1 && (p as Point).y >= 0 && (p as Point).y <= 1);
export function geometryCompatible(a: Geometry, b: Geometry): boolean {
  return [a.width, a.height, b.width, b.height].every(n => Number.isFinite(n) && n > 0) &&
    Math.abs((a.width / a.height) / (b.width / b.height) - 1) <= 0.01;
}
export function validateProfile(value: unknown): asserts value is MappingProfile {
  const p = value as MappingProfile;
  const invalid = (reason: string): never => { throw new Error(reason); };
  if (!p || p.schema_version !== 1) invalid('Phiên bản mapping không được hỗ trợ.');
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(p.id) || !uuid.test(p.user_id)) invalid('ID profile hoặc người dùng không hợp lệ.');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.trim().length > 80) invalid('Tên profile phải có 1–80 ký tự.');
  if (typeof p.game_id !== 'string' || !p.game_id || p.game_id.length > 200 || typeof p.game_title !== 'string' || p.game_title.length > 300) invalid('Chưa chọn game hoặc tên game không hợp lệ.');
  if (typeof p.description !== 'string' || p.description.length > 2000 || typeof p.screenshot_path !== 'string' || p.screenshot_path.length > 1024) invalid('Metadata profile không hợp lệ.');
  if (!p.screenshot || !geometryCompatible(p.screenshot, p.screenshot) || p.screenshot.width > 16384 || p.screenshot.height > 16384) invalid('Kích thước ảnh không hợp lệ.');
  if (!p.settings || !Number.isFinite(p.settings.markerOpacity) || p.settings.markerOpacity < 0.1 || p.settings.markerOpacity > 1) invalid('Độ trong suốt không hợp lệ.');
  if (!Array.isArray(p.bindings) || p.bindings.length < 1 || p.bindings.length > 64) invalid('Cần 1–64 mapping.');
  const ids = new Set<string>(); const triggers = new Set<string>();
  for (const b of p.bindings) {
    if (!b || typeof b.id !== 'string' || !b.id || b.id.length > 100 || ids.has(b.id) || typeof b.name !== 'string' || b.name.length > 80) invalid('Tên hoặc ID mapping không hợp lệ.');
    ids.add(b.id);
    if (!Array.isArray(b.controls) || !b.controls.length || b.controls.length > 4 || new Set(b.controls).size !== b.controls.length || b.controls.some(c => !CONTROLS.includes(c))) invalid('Nút không hợp lệ; Start/Select dành cho menu.');
    const trigger = [...b.controls].sort().join('+');
    if (triggers.has(trigger)) invalid('Hai mapping không thể dùng cùng tổ hợp nút.');
    triggers.add(trigger);
    if (!isPoint(b.point) || !Number.isInteger(b.repeat) || b.repeat < 1 || b.repeat > 20 || typeof b.physicalHold !== 'boolean') invalid('Vị trí hoặc số lần lặp không hợp lệ.');
    if (!Array.isArray(b.steps) || !b.steps.length || b.steps.length > 32) invalid('Macro cần 1–32 bước.');
    if (b.physicalHold && (b.steps.length !== 1 || b.steps[0].type !== 'hold' || b.repeat !== 1)) invalid('Giữ theo nút chỉ hỗ trợ một bước giữ, không lặp.');
    let duration = 0;
    const time = (n: number, min = 0) => { if (!Number.isFinite(n) || n < min || n > MAX_DURATION_MS) invalid('Thời gian phải nằm trong 0–60000 ms.'); return n; };
    for (const step of b.steps) {
      if (!step || !['tap', 'hold', 'double', 'wait', 'random', 'drag'].includes(step.type)) invalid('Loại bước không được hỗ trợ.');
      if (step.type === 'random') {
        duration += time(step.maxMs);
        if (time(step.minMs) > step.maxMs) invalid('Khoảng ngẫu nhiên: min phải nhỏ hơn hoặc bằng max.');
      } else {
        duration += time(step.durationMs, step.type === 'wait' ? 0 : 1);
        if (step.type !== 'wait' && !isPoint(step.point)) invalid('Vị trí bước không hợp lệ.');
        if (step.type === 'double') duration += time(step.intervalMs) + step.durationMs;
        if (step.type === 'drag') {
          if (!isPoint(step.end)) invalid('Điểm cuối không hợp lệ.');
          duration += time(step.initialHoldMs);
        }
      }
    }
    if (duration * b.repeat > MAX_EXECUTION_MS) invalid('Macro tối đa 5 phút.');
  }
}
export function pressedControls(p: PadState): Set<Control> {
  const result = new Set<Control>();
  for (const [control, bit] of Object.entries(BUTTON_BITS)) if (p.buttons & bit) result.add(control as Control);
  if (p.lt >= 0.55) result.add('l2'); if (p.rt >= 0.55) result.add('r2');
  for (const [prefix, x, y] of [['ls', p.lx, p.ly], ['rs', p.rx, p.ry]] as const) {
    if (x < -0.55) result.add(`${prefix}-left`); if (x > 0.55) result.add(`${prefix}-right`);
    // Both native modules emit negative-up axes; the wire encoder inverts Y.
    if (y < -0.55) result.add(`${prefix}-up`); if (y > 0.55) result.add(`${prefix}-down`);
  }
  return result;
}
export function stripMappedInputs(state: PadState, bindings: Binding[]): PadState {
  const next = { ...state };
  for (const c of bindings.flatMap(b => b.controls)) {
    if (c in BUTTON_BITS) next.buttons &= ~BUTTON_BITS[c as keyof typeof BUTTON_BITS];
    else if (c === 'l2') next.lt = 0;
    else if (c === 'r2') next.rt = 0;
    else {
      const axis = c.startsWith('ls') ? (c.endsWith('up') || c.endsWith('down') ? 'ly' : 'lx') : (c.endsWith('up') || c.endsWith('down') ? 'ry' : 'rx');
      // Preserve the unassigned direction of the same stick axis.
      const positive = c.endsWith('down') || c.endsWith('right');
      if ((positive && next[axis] > 0) || (!positive && next[axis] < 0)) next[axis] = 0;
    }
  }
  return next;
}
/** Editor uses a contained image; reject drops in the surrounding letterbox. */
export function canvasPoint(x: number, y: number, box: Geometry, image: Geometry, zoom = 1, pan: Point = { x: 0, y: 0 }): Point | null {
  const scale = Math.min(box.width / image.width, box.height / image.height) * zoom;
  const width = image.width * scale; const height = image.height * scale;
  const p = { x: (x - (box.width - width) / 2 - pan.x) / width, y: (y - (box.height - height) / 2 - pan.y) / height };
  return isPoint(p) ? p : null;
}
