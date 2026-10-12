import { Dimensions } from 'react-native';

import type { StreamDeviceClass } from './stream-settings';

let detected: StreamDeviceClass | null = null;

/**
 * Điện thoại hay màn lớn — chốt một lần.
 *
 * Cùng quy tắc với bản web: cạnh ngắn của màn dưới 600 dp là điện thoại (mọi
 * điện thoại), tablet nhỏ nhất đã ~744. Galaxy Tab S9 (cạnh ngắn ~800 dp) vì thế
 * thuộc `large` và dùng bảng cài đặt chung với laptop; iPhone 14 Pro Max (430 dp)
 * thuộc `phone` và dùng bảng riêng `user_phone_stream_settings`.
 */
export function detectStreamDeviceClass(): StreamDeviceClass {
  if (detected) return detected;
  const screen = Dimensions.get('screen');
  detected = Math.min(screen.width, screen.height) < 600 ? 'phone' : 'large';
  return detected;
}
