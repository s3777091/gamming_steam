// Thiết bị mà app điều khiển. Bản native chỉ phát stream máy tính ở nhà; kiểu
// DeviceId giữ đủ 'steam'/'vm' để dùng chung các hàm của client Moonlight.

export type DeviceId = 'pc' | 'steam' | 'vm';
export type DeviceState = 'online' | 'available' | 'sleep' | 'offline' | 'unknown';

export const STATE_LABEL: Record<DeviceState, string> = {
  online: 'Trực tuyến',
  available: 'Sẵn sàng',
  sleep: 'Đang khởi động',
  offline: 'Ngoại tuyến',
  unknown: 'Đang kiểm tra',
};

export const PC_LABEL: Record<DeviceState, string> = {
  online: 'Máy đang bật',
  available: 'Sẵn sàng chuyển sang PC',
  sleep: 'Đang bật máy',
  offline: 'Máy đang tắt',
  unknown: 'Đang kiểm tra',
};
