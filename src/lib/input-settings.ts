// Cài đặt input cho app native (port từ jetsona-ui/src/lib/input-settings.ts).
//
// Khác biệt duy nhất với bản web: localStorage -> AsyncStorage (async), và
// CustomEvent trên window -> một pub/sub nội bộ RN. Logic chuẩn hoá giữ nguyên.

import AsyncStorage from '@react-native-async-storage/async-storage';

export type InputSection = 'mouse' | 'keyboard' | 'headset';

/**
 * Tay cầm đã rời khỏi giao diện: host không còn controller ảo để nhận
 * input. Các trường dưới đây được giữ lại vì bảng `controller_settings`
 * trên Supabase vẫn có cột tương ứng, giúp đọc và ghi dữ liệu cũ an toàn.
 */
export type ControllerLayout = 'auto' | 'xbox' | 'playstation' | 'nintendo';
export type HostEmulation = 'xbox_360' | 'dualshock_4' | 'native';
export type HostShortcutAction =
  | 'exit'
  | 'reload'
  | 'hud'
  | 'clipboard'
  | 'settings'
  | 'shutdown'
  | 'zoom';

export const DEFAULT_HOST_SHORTCUTS: Record<string, HostShortcutAction> = {
  KeyQ: 'exit',
  KeyR: 'reload',
  KeyH: 'hud',
  KeyC: 'clipboard',
  KeyS: 'settings',
  KeyP: 'shutdown',
  KeyZ: 'zoom',
};

export type InputSettings = {
  mouseSensitivity: number;
  scrollSensitivity: number;
  invertScroll: boolean;
  captureAllKeys: boolean;
  hostKey: string;
  hostShortcuts: Record<string, HostShortcutAction>;
  keyboardRemaps: Record<string, string>;
  audioOutputId: string;
  audioVolume: number;
  audioMuted: boolean;
  controllerLayout: ControllerLayout;
  hostEmulation: HostEmulation;
  vibrationEnabled: boolean;
  vibrationStrength: number;
  leftDeadzone: number;
  rightDeadzone: number;
  triggerDeadzone: number;
  gyroscopeEnabled: boolean;
  gyroscopeSensitivity: number;
  updatedAt: string;
};

export type ControllerSettingsRow = {
  mouse_sensitivity?: number | string | null;
  scroll_sensitivity?: number | string | null;
  invert_scroll?: boolean | null;
  capture_all_keys?: boolean | null;
  host_key?: string | null;
  host_shortcuts?: unknown;
  keyboard_remaps?: unknown;
  audio_output_id?: string | null;
  audio_volume?: number | null;
  audio_muted?: boolean | null;
  layout?: ControllerLayout | null;
  host_emulation?: HostEmulation | null;
  vibration_enabled?: boolean | null;
  vibration_strength?: number | null;
  left_deadzone?: number | string | null;
  right_deadzone?: number | string | null;
  trigger_deadzone?: number | string | null;
  gyroscope_enabled?: boolean | null;
  gyroscope_sensitivity?: number | string | null;
  updated_at?: string | null;
};

export const INPUT_SETTINGS_KEY = '@jetsona/input-settings.v1';
export const INPUT_SETTINGS_EVENT = 'jetsona:input-settings-updated';

export const DEFAULT_INPUT_SETTINGS: InputSettings = {
  mouseSensitivity: 1,
  scrollSensitivity: 1,
  invertScroll: false,
  captureAllKeys: true,
  hostKey: 'ControlRight',
  hostShortcuts: DEFAULT_HOST_SHORTCUTS,
  keyboardRemaps: {},
  audioOutputId: '',
  audioVolume: 100,
  audioMuted: false,
  controllerLayout: 'auto',
  hostEmulation: 'xbox_360',
  vibrationEnabled: true,
  vibrationStrength: 100,
  leftDeadzone: 0.1,
  rightDeadzone: 0.1,
  triggerDeadzone: 0.05,
  gyroscopeEnabled: false,
  gyroscopeSensitivity: 1,
  updatedAt: '1970-01-01T00:00:00.000Z',
};

function clamp(value: unknown, minimum: number, maximum: number, fallback: number) {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? Math.min(maximum, Math.max(minimum, numeric)) : fallback;
}

function oneOf<T extends string>(value: unknown, choices: readonly T[], fallback: T): T {
  return typeof value === 'string' && choices.includes(value as T) ? value as T : fallback;
}

function cleanRemaps(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([source, target]) => /^\w/.test(source) && typeof target === 'string' && /^\w/.test(target))
      .slice(0, 24) as Array<[string, string]>,
  );
}

function cleanKeyCode(value: unknown, fallback: string): string {
  return typeof value === 'string' && value !== 'Escape' && /^[A-Za-z][A-Za-z0-9]*$/.test(value)
    ? value
    : fallback;
}

const HOST_SHORTCUT_ACTIONS: readonly HostShortcutAction[] = [
  'exit', 'reload', 'hud', 'clipboard', 'settings', 'shutdown', 'zoom',
];

function cleanHostShortcuts(value: unknown, hostKey: string): Record<string, HostShortcutAction> {
  const shortcuts = !value || typeof value !== 'object' || Array.isArray(value) ? {} : Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([code, action]) => (
        code !== hostKey
        && code !== 'Escape'
        && /^[A-Za-z][A-Za-z0-9]*$/.test(code)
        && typeof action === 'string'
        && HOST_SHORTCUT_ACTIONS.includes(action as HostShortcutAction)
      ))
      .slice(0, 24) as Array<[string, HostShortcutAction]>,
  );
  return shortcuts;
}

export function normalizeInputSettings(value?: Partial<InputSettings> | null): InputSettings {
  const source = value ?? {};
  const hostKey = cleanKeyCode(source.hostKey, DEFAULT_INPUT_SETTINGS.hostKey);
  return {
    mouseSensitivity: clamp(source.mouseSensitivity, 0.25, 2.5, 1),
    scrollSensitivity: clamp(source.scrollSensitivity, 0.25, 3, 1),
    invertScroll: Boolean(source.invertScroll),
    captureAllKeys: source.captureAllKeys ?? true,
    hostKey,
    hostShortcuts: cleanHostShortcuts(source.hostShortcuts ?? DEFAULT_HOST_SHORTCUTS, hostKey),
    keyboardRemaps: cleanRemaps(source.keyboardRemaps),
    audioOutputId: typeof source.audioOutputId === 'string' ? source.audioOutputId : '',
    audioVolume: clamp(source.audioVolume, 0, 100, 100),
    audioMuted: Boolean(source.audioMuted),
    controllerLayout: oneOf(source.controllerLayout, ['auto', 'xbox', 'playstation', 'nintendo'], 'auto'),
    hostEmulation: oneOf(source.hostEmulation, ['xbox_360', 'dualshock_4', 'native'], 'xbox_360'),
    vibrationEnabled: source.vibrationEnabled ?? true,
    vibrationStrength: clamp(source.vibrationStrength, 0, 100, 100),
    leftDeadzone: clamp(source.leftDeadzone, 0, 0.5, 0.1),
    rightDeadzone: clamp(source.rightDeadzone, 0, 0.5, 0.1),
    triggerDeadzone: clamp(source.triggerDeadzone, 0, 0.5, 0.05),
    gyroscopeEnabled: Boolean(source.gyroscopeEnabled),
    gyroscopeSensitivity: clamp(source.gyroscopeSensitivity, 0.1, 5, 1),
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : DEFAULT_INPUT_SETTINGS.updatedAt,
  };
}

// Pub/sub nội bộ thay cho window.dispatchEvent (RN không có window events).
type Listener = (value: InputSettings) => void;
const listeners = new Set<Listener>();

export function subscribeInputSettings(listener: Listener): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export async function loadInputSettings(): Promise<InputSettings> {
  try {
    const raw = await AsyncStorage.getItem(INPUT_SETTINGS_KEY);
    if (!raw) return DEFAULT_INPUT_SETTINGS;
    return normalizeInputSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_INPUT_SETTINGS;
  }
}

export async function storeInputSettings(
  value: InputSettings,
  broadcast = true,
): Promise<InputSettings> {
  const normalized = normalizeInputSettings(value);
  try {
    await AsyncStorage.setItem(INPUT_SETTINGS_KEY, JSON.stringify(normalized));
  } catch {
    // Runtime application vẫn dùng được cho phiên hiện tại khi storage lỗi.
  }
  if (broadcast) listeners.forEach((listener) => listener(normalized));
  return normalized;
}

export function inputSettingsFromRow(
  row: ControllerSettingsRow | null | undefined,
  fallback = DEFAULT_INPUT_SETTINGS,
): InputSettings {
  if (!row) return fallback;
  const numeric = (value: number | string | null | undefined, fallbackValue: number) =>
    value === null || value === undefined ? fallbackValue : Number(value);
  return normalizeInputSettings({
    ...fallback,
    mouseSensitivity: numeric(row.mouse_sensitivity, fallback.mouseSensitivity),
    scrollSensitivity: numeric(row.scroll_sensitivity, fallback.scrollSensitivity),
    invertScroll: row.invert_scroll ?? fallback.invertScroll,
    captureAllKeys: row.capture_all_keys ?? fallback.captureAllKeys,
    hostKey: cleanKeyCode(row.host_key, fallback.hostKey),
    hostShortcuts: cleanHostShortcuts(row.host_shortcuts ?? fallback.hostShortcuts, row.host_key ?? fallback.hostKey),
    keyboardRemaps: cleanRemaps(row.keyboard_remaps ?? fallback.keyboardRemaps),
    audioOutputId: row.audio_output_id ?? fallback.audioOutputId,
    audioVolume: row.audio_volume ?? fallback.audioVolume,
    audioMuted: row.audio_muted ?? fallback.audioMuted,
    controllerLayout: row.layout ?? fallback.controllerLayout,
    hostEmulation: row.host_emulation ?? fallback.hostEmulation,
    vibrationEnabled: row.vibration_enabled ?? fallback.vibrationEnabled,
    vibrationStrength: row.vibration_strength ?? fallback.vibrationStrength,
    leftDeadzone: numeric(row.left_deadzone, fallback.leftDeadzone),
    rightDeadzone: numeric(row.right_deadzone, fallback.rightDeadzone),
    triggerDeadzone: numeric(row.trigger_deadzone, fallback.triggerDeadzone),
    gyroscopeEnabled: row.gyroscope_enabled ?? fallback.gyroscopeEnabled,
    gyroscopeSensitivity: numeric(row.gyroscope_sensitivity, fallback.gyroscopeSensitivity),
    updatedAt: row.updated_at ?? fallback.updatedAt,
  });
}

export function inputSettingsToRow(value: InputSettings) {
  return {
    mouse_sensitivity: value.mouseSensitivity,
    scroll_sensitivity: value.scrollSensitivity,
    invert_scroll: value.invertScroll,
    capture_all_keys: value.captureAllKeys,
    host_key: value.hostKey,
    host_shortcuts: value.hostShortcuts,
    keyboard_remaps: value.keyboardRemaps,
    audio_output_id: value.audioOutputId || null,
    audio_volume: value.audioVolume,
    audio_muted: value.audioMuted,
    layout: value.controllerLayout,
    host_emulation: value.hostEmulation,
    vibration_enabled: value.vibrationEnabled,
    vibration_strength: value.vibrationStrength,
    left_deadzone: value.leftDeadzone,
    right_deadzone: value.rightDeadzone,
    trigger_deadzone: value.triggerDeadzone,
    gyroscope_enabled: value.gyroscopeEnabled,
    gyroscope_sensitivity: value.gyroscopeSensitivity,
  };
}

export function keyCodeLabel(code: string): string {
  return code
    .replace(/^Key/, '')
    .replace(/^Digit/, '')
    .replace('Control', 'Ctrl ')
    .replace('Arrow', '')
    .replace('BracketLeft', '[')
    .replace('BracketRight', ']')
    .replace('Semicolon', ';')
    .replace('Quote', "'")
    .replace('Backquote', '`')
    .replace('Backslash', '\\')
    .replace('Comma', ',')
    .replace('Period', '.')
    .replace('Slash', '/');
}

export function applyDeadzone(value: number, deadzone: number): number {
  const magnitude = Math.abs(value);
  if (magnitude <= deadzone) return 0;
  return Math.sign(value) * Math.min(1, (magnitude - deadzone) / Math.max(0.001, 1 - deadzone));
}
