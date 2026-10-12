import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  CaptureMode,
  JetsonaInputModuleEvents,
  NativeBluetoothInfo,
  NativeDeviceDescription,
  NativeDisplayInfo,
  NativeInputDevice,
} from './JetsonaInput.types';

declare class JetsonaInputNative extends NativeModule<JetsonaInputModuleEvents> {
  getDevices(): NativeInputDevice[];
  getBluetooth(): NativeBluetoothInfo;
  setCaptureMode(mode: CaptureMode): void;
  setPointerCapture(enabled: boolean): void;
  setImmersive(enabled: boolean): void;
  rumble(deviceId: number, low: number, high: number, durationMs: number): void;
  stopRumble(deviceId: number): void;
  openBluetoothSettings(): void;
  openWifiSettings(): void;
  startSpeakerRoute(): void;
  stopSpeakerRoute(): void;
  describeDevice(deviceId: number): NativeDeviceDescription | null;
  getDisplayInfo(): NativeDisplayInfo;
  grabFrame(): Promise<boolean>;
  exportFrame(maxWidth: number): Promise<string | null>;
  releaseFrame(): void;
}

/** null trên iOS/web: module chỉ có ở bản Android. */
export default requireOptionalNativeModule<JetsonaInputNative>('JetsonaInput');
