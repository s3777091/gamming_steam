// Thiết bị đang kết nối: tay cầm, bàn phím, chuột, tai nghe — do module native
// báo bằng sự kiện (InputDeviceListener / AudioDeviceCallback / broadcast
// Bluetooth). Không có vòng lặp hỏi thăm nào.
//
// Header kệ game và Cài đặt > Thiết bị cùng đọc từ đây nên luôn báo giống nhau.

import { useCallback, useEffect, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import {
  addListener,
  getBluetooth,
  getDevices,
  type NativeBluetoothInfo,
  type NativeInputDevice,
} from 'jetsona-input';

export type DeviceKind = 'controller' | 'keyboard' | 'mouse' | 'headset';

export type LocalDevice = {
  id: string;
  nativeId: number;
  name: string;
  kind: DeviceKind;
  bluetooth: boolean;
  transport?: NativeInputDevice['transport'];
  /** 0..1, hoặc null khi thiết bị không báo pin. */
  battery: number | null;
  rumble: boolean;
};

export function toLocal(device: NativeInputDevice): LocalDevice {
  return {
    id: device.id,
    nativeId: device.nativeId,
    name: device.name,
    kind: device.kind,
    bluetooth: device.bluetooth,
    transport: device.transport,
    battery: device.battery >= 0 ? device.battery : null,
    rumble: device.rumble,
  };
}

/** Xin quyền BLUETOOTH_CONNECT (Android 12+) để biết tên các thiết bị đã ghép đôi. */
export async function requestBluetoothPermission(): Promise<boolean> {
  if (Platform.OS !== 'android' || Number(Platform.Version) < 31) return true;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  return result === PermissionsAndroid.RESULTS.GRANTED;
}

export function useInputDevices() {
  const [devices, setDevices] = useState<LocalDevice[]>(() => getDevices().map(toLocal));
  const [bluetooth, setBluetooth] = useState<NativeBluetoothInfo>(() => getBluetooth());

  useEffect(() => {
    const offDevices = addListener('onDevicesChanged', ({ devices: next }) => setDevices(next.map(toLocal)));
    const offBluetooth = addListener('onBluetoothChanged', (next) => setBluetooth(next));
    return () => {
      offDevices();
      offBluetooth();
    };
  }, []);

  const refresh = useCallback(async () => {
    await requestBluetoothPermission();
    setDevices(getDevices().map(toLocal));
    setBluetooth(getBluetooth());
  }, []);

  /** Đọc lại ngay (không xin quyền). Native chỉ báo khi cắm/rút, không báo khi pin tụt,
   *  nên gọi lúc người dùng mở menu thiết bị để % pin là số mới nhất. */
  const resync = useCallback(() => {
    setDevices(getDevices().map(toLocal));
  }, []);

  return { devices, bluetooth, refresh, resync };
}

export const KIND_LABEL: Record<DeviceKind, string> = {
  controller: 'Tay cầm',
  keyboard: 'Bàn phím',
  mouse: 'Chuột',
  headset: 'Tai nghe',
};

/** Thứ tự icon trên header: thứ quan trọng khi đang chơi đứng trước. */
export const DEVICE_KIND_ORDER: DeviceKind[] = ['controller', 'headset', 'keyboard', 'mouse'];
