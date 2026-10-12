import { Gamepad2, Headphones, Keyboard, Mouse, type LucideIcon } from 'lucide-react-native';

import type { DeviceKind } from './useInputDevices';

export const KIND_ICONS: Record<DeviceKind, LucideIcon> = {
  controller: Gamepad2,
  headset: Headphones,
  keyboard: Keyboard,
  mouse: Mouse,
};
