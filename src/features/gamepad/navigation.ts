// Phần thuần của điều hướng bằng tay cầm: đổi trạng thái D-pad / cần analog
// thành hướng bấm rời rạc cho tiêu điểm kiểu PS5.

import type { NativeGamepadState } from 'jetsona-input';

import type { Direction } from './spatial';

export const DPAD = { UP: 0x0001, DOWN: 0x0002, LEFT: 0x0004, RIGHT: 0x0008 } as const;

/** Nhịp lặp khi giữ hướng: dừng một chút rồi chạy đều, giống menu console. */
export const REPEAT_DELAY_MS = 380;
export const REPEAT_INTERVAL_MS = 120;

const STICK_PRESS = 0.55;
const STICK_RELEASE = 0.35;

export function gamepadAxis(value: number | undefined, deadzone = 0.16): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value || 0));
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadzone) return 0;
  const normalized = (magnitude - deadzone) / (1 - deadzone);
  return Math.sign(clamped) * normalized ** 1.45;
}

/**
 * Hướng đang giữ: D-pad thắng cần trái; cần trái phải vượt ngưỡng mới tính và
 * (khi đang giữ một hướng) chỉ nhả khi về dưới ngưỡng thấp hơn để không nháy.
 */
export function navDirection(
  state: Pick<NativeGamepadState, 'buttons' | 'lx' | 'ly'>,
  previous: Direction | null = null,
): Direction | null {
  const { buttons } = state;
  if (buttons & DPAD.UP) return 'up';
  if (buttons & DPAD.DOWN) return 'down';
  if (buttons & DPAD.LEFT) return 'left';
  if (buttons & DPAD.RIGHT) return 'right';

  const x = Number.isFinite(state.lx) ? state.lx : 0;
  const y = Number.isFinite(state.ly) ? state.ly : 0;
  const threshold = previous ? STICK_RELEASE : STICK_PRESS;
  if (Math.hypot(x, y) < threshold) return null;
  if (Math.abs(x) > Math.abs(y)) return x > 0 ? 'right' : 'left';
  return y > 0 ? 'down' : 'up';
}

/** Cần phải -> vector cuộn. */
export function scrollVector(state: Pick<NativeGamepadState, 'rx' | 'ry'>): { x: number; y: number } {
  return { x: gamepadAxis(state.rx, 0.2), y: gamepadAxis(state.ry, 0.2) };
}
