package expo.modules.jetsonainput

import android.view.InputDevice
import android.view.KeyEvent
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class InputDevicePolicyTest {
  // Galaxy Tab S9+: 0f0d:0213, Android device 49, "Gamepad Controller Keyboard".
  // Three HID interfaces share one InputDevice, including a full typing keyboard.
  private val composite = InputDevice.SOURCE_KEYBOARD or InputDevice.SOURCE_GAMEPAD or
    InputDevice.SOURCE_MOUSE or InputDevice.SOURCE_JOYSTICK

  @Test fun compositeControllerWinsOverAlphabeticKeyboard() {
    assertTrue(controllerDevicePolicy(composite, { true }, { false }))
  }

  @Test fun explicitSourcesDoNotProbeTypingKeysOnEveryAnalogEvent() {
    for (source in listOf(InputDevice.SOURCE_GAMEPAD, InputDevice.SOURCE_JOYSTICK, composite)) {
      assertTrue(controllerDevicePolicy(source, { error("typing probe") }, { error("fallback probe") }))
    }
  }

  @Test fun samsungBookCoverArrowKeysDoNotMakeItAController() {
    val bookCover = InputDevice.SOURCE_KEYBOARD or InputDevice.SOURCE_DPAD
    assertFalse(controllerDevicePolicy(bookCover, { true }, { true }))
    assertEquals(InputKeyRoute.KEYBOARD, inputKeyRoute(InputDevice.SOURCE_KEYBOARD, false, true, false, true))
  }

  @Test fun keyboardWithExtraGameButtonStillTypesNormally() {
    assertFalse(controllerDevicePolicy(InputDevice.SOURCE_KEYBOARD, { true }, { true }))
    assertEquals(InputKeyRoute.KEYBOARD, inputKeyRoute(InputDevice.SOURCE_KEYBOARD, false, true, true, true))
  }

  @Test fun incompleteControllerDescriptorsCanUseButtonOrAxisFallback() {
    assertTrue(controllerDevicePolicy(InputDevice.SOURCE_KEYBOARD, { false }, { true }))
    assertFalse(controllerDevicePolicy(InputDevice.SOURCE_KEYBOARD, { false }, { false }))
  }

  @Test fun compositeButtonsAndDpadReachControllerEvenWhenReportedAsKeyboard() {
    assertEquals(InputKeyRoute.CONTROLLER, inputKeyRoute(InputDevice.SOURCE_GAMEPAD, true, true, true, true))
    assertEquals(InputKeyRoute.CONTROLLER, inputKeyRoute(InputDevice.SOURCE_KEYBOARD, true, true, true, true))
    assertEquals(InputKeyRoute.CONTROLLER, inputKeyRoute(InputDevice.SOURCE_KEYBOARD, true, true, false, true))
  }

  @Test fun compositeTypingInterfaceStillReachesKeyboard() {
    assertEquals(InputKeyRoute.KEYBOARD, inputKeyRoute(InputDevice.SOURCE_KEYBOARD, true, true, false, false))
    assertEquals(InputKeyRoute.OTHER, inputKeyRoute(InputDevice.SOURCE_TOUCHSCREEN, false, false, false, false))
  }

  @Test fun joystickEventsAreNeverVetoedByKeyboardCapabilities() {
    assertTrue(isControllerMotion(InputDevice.SOURCE_JOYSTICK, true))
    assertTrue(isControllerMotion(InputDevice.SOURCE_JOYSTICK, false))
    assertTrue(isControllerMotion(InputDevice.SOURCE_GAMEPAD, true))
  }

  @Test fun compositeMouseEventsDoNotOverwriteJoystickState() {
    for (source in listOf(InputDevice.SOURCE_MOUSE, InputDevice.SOURCE_TOUCHPAD, InputDevice.SOURCE_MOUSE_RELATIVE)) {
      assertFalse(isControllerMotion(source, true))
    }
    assertFalse(isGamepadSource(InputDevice.SOURCE_KEYBOARD))
    assertFalse(isGamepadSource(InputDevice.SOURCE_DPAD))
  }

  @Test fun shoulderButtonsKeepTheirNamesAndIndependentMoonlightBits() {
    assertEquals("lb", PadButton.nameOf(KeyEvent.KEYCODE_BUTTON_L1))
    assertEquals("rb", PadButton.nameOf(KeyEvent.KEYCODE_BUTTON_R1))
    val state = PadState(51)
    assertTrue(state.applyKey(KeyEvent.KEYCODE_BUTTON_L1, true))
    assertEquals(0x0100, state.buttons)
    assertTrue(state.applyKey(KeyEvent.KEYCODE_BUTTON_R1, true))
    assertEquals(0x0300, state.buttons)
    assertTrue(state.applyKey(KeyEvent.KEYCODE_BUTTON_L1, false))
    assertEquals(0x0200, state.buttons)
    assertTrue(state.applyKey(KeyEvent.KEYCODE_BUTTON_R1, false))
    assertEquals(0, state.buttons)
  }

  @Test fun triggersCannotClearHeldShoulderButtons() {
    val state = PadState(51)
    state.applyKey(KeyEvent.KEYCODE_BUTTON_L1, true)
    state.applyKey(KeyEvent.KEYCODE_BUTTON_R1, true)
    state.applyKey(KeyEvent.KEYCODE_BUTTON_L2, true)
    state.applyKey(KeyEvent.KEYCODE_BUTTON_L2, false)
    state.applyKey(KeyEvent.KEYCODE_BUTTON_R2, true)
    state.applyKey(KeyEvent.KEYCODE_BUTTON_R2, false)
    assertEquals(0x0300, state.buttons)
    assertEquals(0f, state.lt, 0f)
    assertEquals(0f, state.rt, 0f)
  }
}
