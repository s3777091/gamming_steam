// Phần thuần của điều hướng bằng tay cầm. Cùng hằng số với
// src/lib/gamepad-navigation.ts bên web để cảm giác con trỏ giống nhau.

import type { NativeGamepadState } from 'jetsona-input';

export const DPAD = { UP: 0x0001, DOWN: 0x0002, LEFT: 0x0004, RIGHT: 0x0008 } as const;

export type Vec = { x: number; y: number };

export function gamepadAxis(value: number | undefined, deadzone = 0.16): number {
  if (!Number.isFinite(value)) return 0;
  const clamped = Math.max(-1, Math.min(1, value || 0));
  const magnitude = Math.abs(clamped);
  if (magnitude <= deadzone) return 0;
  const normalized = (magnitude - deadzone) / (1 - deadzone);
  return Math.sign(clamped) * normalized ** 1.45;
}

/** Cần trái + D-pad -> vector con trỏ, độ dài tối đa 1. */
export function cursorVector(state: Pick<NativeGamepadState, 'buttons' | 'lx' | 'ly'>): Vec {
  let x = gamepadAxis(state.lx);
  let y = gamepadAxis(state.ly);
  if (state.buttons & DPAD.LEFT) x -= 0.62;
  if (state.buttons & DPAD.RIGHT) x += 0.62;
  if (state.buttons & DPAD.UP) y -= 0.62;
  if (state.buttons & DPAD.DOWN) y += 0.62;
  const magnitude = Math.hypot(x, y);
  if (magnitude > 1) {
    x /= magnitude;
    y /= magnitude;
  }
  return { x, y };
}

/** Cần phải -> vector cuộn. */
export function scrollVector(state: Pick<NativeGamepadState, 'rx' | 'ry'>): Vec {
  return { x: gamepadAxis(state.rx, 0.2), y: gamepadAxis(state.ry, 0.2) };
}

export function clampCursor(point: Vec, viewport: { width: number; height: number }, inset = 18): Vec {
  return {
    x: Math.max(inset, Math.min(Math.max(inset, viewport.width - inset), point.x)),
    y: Math.max(inset, Math.min(Math.max(inset, viewport.height - inset), point.y)),
  };
}
