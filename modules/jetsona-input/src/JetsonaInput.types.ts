export type InputDeviceKind = 'controller' | 'keyboard' | 'mouse' | 'headset';

export type NativeInputDevice = {
  /** `input:<id>` hoặc `audio:<id>`: ổn định trong một lần cắm. */
  id: string;
  nativeId: number;
  name: string;
  kind: InputDeviceKind;
  source: 'gamepad' | 'keyboard' | 'mouse' | 'audio';
  vendorId: number;
  productId: number;
  /** Tên trùng một thiết bị Bluetooth đã ghép đôi. */
  bluetooth: boolean;
  /** 0..1, hoặc -1 khi thiết bị không báo pin. */
  battery: number;
  rumble: boolean;
  connected: boolean;
};

export type NativeBluetoothInfo = {
  supported: boolean;
  enabled: boolean;
  /** Đã có quyền BLUETOOTH_CONNECT (Android 12+). */
  permitted: boolean;
  bonded: Array<{ name: string; type: number | null }>;
};

/** Cờ nút đúng như gói `controller` của moonlight-web. */
export type NativeGamepadState = {
  deviceId: number;
  buttons: number;
  lt: number;
  rt: number;
  lx: number;
  ly: number;
  rx: number;
  ry: number;
};

export type GamepadButtonName =
  | 'a' | 'b' | 'x' | 'y' | 'lb' | 'rb' | 'lt' | 'rt' | 'l3' | 'r3'
  | 'start' | 'select' | 'guide' | 'up' | 'down' | 'left' | 'right';

export type NativeGamepadButton = {
  deviceId: number;
  button: GamepadButtonName;
  down: boolean;
};

export type NativeKeyEvent = {
  deviceId: number;
  keyCode: number;
  /** Windows virtual-key đã đổi sẵn. */
  vk: number;
  down: boolean;
  /** SHIFT=1, CTRL=2, ALT=4, META=8. */
  modifiers: number;
};

export type NativeMouseEvent =
  | { type: 'move'; dx: number; dy: number }
  | { type: 'button'; button: 1 | 2 | 3 | 4 | 5; down: boolean }
  | { type: 'wheel'; dx: number; dy: number };

export type CaptureMode = 'off' | 'ui' | 'stream';

export type JetsonaInputModuleEvents = {
  onDevicesChanged: (params: { devices: NativeInputDevice[] }) => void;
  onBluetoothChanged: (params: NativeBluetoothInfo) => void;
  onGamepadState: (params: NativeGamepadState) => void;
  onGamepadButton: (params: NativeGamepadButton) => void;
  onKey: (params: NativeKeyEvent) => void;
  onMouse: (params: NativeMouseEvent) => void;
};

export type NativeAxisRange = { axis: string; min: number; max: number; flat: number };
export type NativeDeviceDescription = {
  name: string;
  descriptor: string;
  sources: number;
  axes: NativeAxisRange[];
};

export type NativeDisplayInfo = {
  /** Hz thật của panel, ví dụ 120.0. */
  refreshRate: number;
  widthPx: number;
  heightPx: number;
  /** Inset hộp thoại cắt (tai thỏ/camera) theo px, đã xoay theo hướng hiện tại. */
  insets: { left: number; top: number; right: number; bottom: number };
};
