import { Dimensions } from 'react-native';
import { getDisplayInfo } from 'jetsona-input';

import type { StreamDeviceClass } from './stream-settings';

let detected: StreamDeviceClass | null = null;

/**
 * Điện thoại hay màn lớn — chốt một lần.
 *
 * Ưu tiên smallestScreenWidthDp của Android, tránh kích thước cửa sổ hoặc hướng
 * xoay làm tablet rơi vào bảng điện thoại. Đây chỉ là cách chọn bảng lưu;
 * Auto luôn dựa trên pixel/Hz thật, kể cả khi thiết bị nhỏ hơn ngưỡng 600 dp.
 */
export function detectStreamDeviceClass(): StreamDeviceClass {
  if (detected) return detected;
  const screen = Dimensions.get('screen');
  const smallest = getDisplayInfo()?.smallestScreenWidthDp;
  detected = (smallest && smallest > 0 ? smallest : Math.min(screen.width, screen.height)) < 600 ? 'phone' : 'large';
  return detected;
}
