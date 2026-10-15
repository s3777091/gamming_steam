package expo.modules.jetsonainput

import android.view.InputDevice

fun isGamepadSource(source: Int): Boolean =
  (source and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD ||
    (source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK

/** Android merges keyboard/mouse/gamepad HID interfaces into one InputDevice.
 * Explicit controller sources take priority even when that device can type.
 * Typing keyboards only veto the heuristic fallback for incomplete HID reports.
 */
inline fun controllerDevicePolicy(
  sources: Int,
  typingKeyboard: () -> Boolean,
  controllerFallback: () -> Boolean,
): Boolean = isGamepadSource(sources) || (!typingKeyboard() && controllerFallback())

enum class InputKeyRoute { CONTROLLER, KEYBOARD, OTHER }

fun inputKeyRoute(
  source: Int,
  controllerDevice: Boolean,
  typingKeyboard: Boolean,
  gamepadButton: Boolean,
  gamepadKey: Boolean,
): InputKeyRoute = when {
  isGamepadSource(source) || (controllerDevice && gamepadKey) ||
    (!typingKeyboard && gamepadButton) -> InputKeyRoute.CONTROLLER
  typingKeyboard && (source and InputDevice.SOURCE_KEYBOARD) == InputDevice.SOURCE_KEYBOARD -> InputKeyRoute.KEYBOARD
  else -> InputKeyRoute.OTHER
}

fun isControllerMotion(source: Int, controllerDevice: Boolean): Boolean {
  val pointer = (source and InputDevice.SOURCE_MOUSE) == InputDevice.SOURCE_MOUSE ||
    (source and InputDevice.SOURCE_TOUCHPAD) == InputDevice.SOURCE_TOUCHPAD ||
    (source and InputDevice.SOURCE_MOUSE_RELATIVE) == InputDevice.SOURCE_MOUSE_RELATIVE
  return isGamepadSource(source) ||
    (source and InputDevice.SOURCE_CLASS_JOYSTICK) != 0 || (controllerDevice && !pointer)
}
