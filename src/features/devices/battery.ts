// Hiển thị pin tay cầm: header kệ game và menu thiết bị dùng chung một cách làm tròn + màu.

import type { Palette } from '@/theme';

import type { LocalDevice } from './useInputDevices';

/** 0..1 -> 0..100 (số nguyên). */
export function batteryPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value * 100)));
}

/** Màu theo mức pin, tô thẳng lên icon tay cầm thay cho con số %: đỏ sắp hết, vàng thấp, xanh còn nhiều. */
export function batteryColor(percent: number, colors: Pick<Palette, 'danger' | 'warning' | 'success'>): string {
  if (percent <= 20) return colors.danger;
  if (percent <= 50) return colors.warning;
  return colors.success;
}

/** Pin thấp nhất trong các tay cầm có báo pin (cái sắp tắt trước mới đáng để ý); null khi không có. */
export function lowestControllerBattery(devices: LocalDevice[]): number | null {
  let lowest: number | null = null;
  for (const device of devices) {
    if (device.kind !== 'controller' || device.battery === null) continue;
    const percent = batteryPercent(device.battery);
    if (lowest === null || percent < lowest) lowest = percent;
  }
  return lowest;
}
