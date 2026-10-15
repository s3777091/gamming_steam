import Native from './src/JetsonaInputModule';
import type {
  CaptureMode,
  JetsonaInputModuleEvents,
  NativeBluetoothInfo,
  NativeDeviceDescription,
  NativeDisplayInfo,
  NativeInputDevice,
} from './src/JetsonaInput.types';

export * from './src/JetsonaInput.types';

const EMPTY_BLUETOOTH: NativeBluetoothInfo = { supported: false, enabled: false, permitted: false, bonded: [] };

export const hasNativeInput = Native != null;

export function getDevices(): NativeInputDevice[] {
  return Native?.getDevices() ?? [];
}

export function getBluetooth(): NativeBluetoothInfo {
  return Native?.getBluetooth() ?? EMPTY_BLUETOOTH;
}

export function setCaptureMode(mode: CaptureMode): void {
  Native?.setCaptureMode(mode);
}

export function setPointerCapture(enabled: boolean): void {
  Native?.setPointerCapture(enabled);
}

export function setImmersive(enabled: boolean): void {
  Native?.setImmersive(enabled);
}

export function rumble(deviceId: number, low: number, high: number, durationMs = 120): void {
  Native?.rumble(deviceId, low, high, durationMs);
}

export function stopRumble(deviceId: number): void {
  Native?.stopRumble(deviceId);
}

export function openBluetoothSettings(): void {
  Native?.openBluetoothSettings();
}

export function openWifiSettings(): void {
  Native?.openWifiSettings();
}

export function startSpeakerRoute(): void {
  Native?.startSpeakerRoute();
}

export function stopSpeakerRoute(): void {
  Native?.stopSpeakerRoute();
}

export function describeDevice(deviceId: number): NativeDeviceDescription | null {
  return Native?.describeDevice(deviceId) ?? null;
}

/** Đăng ký một sự kiện; trả về hàm huỷ. Không làm gì khi không có module native. */
export function addListener<K extends keyof JetsonaInputModuleEvents>(
  event: K,
  listener: JetsonaInputModuleEvents[K],
): () => void {
  if (!Native) return () => {};
  const subscription = Native.addListener(event, listener);
  return () => subscription.remove();
}

export function getDisplayInfo(): NativeDisplayInfo | null {
  return Native?.getDisplayInfo() ?? null;
}

/** Zero restores the window preference after the stream ends. */
export function setStreamFrameRate(fps: number): void {
  Native?.setStreamFrameRate?.(fps);
}

/** Giữ lại khung hình đang hiện trên màn (gồm video stream) ngay lúc này. */
export async function grabFrame(): Promise<boolean> {
  return (await Native?.grabFrame()) ?? false;
}

/** Nén khung hình đã giữ thành PNG base64, rộng tối đa maxWidth px; null nếu chưa có. */
export async function exportFrame(maxWidth = 1920): Promise<string | null> {
  return (await Native?.exportFrame(maxWidth)) ?? null;
}

export function releaseFrame(): void {
  Native?.releaseFrame();
}
