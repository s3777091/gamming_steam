package expo.modules.jetsonainput

import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import kotlin.math.abs
import kotlin.math.roundToInt

/**
 * Cờ nút của Moonlight (Limelight.h). Giá trị này đi nguyên vào gói
 * `controller` trên data channel nên không được đổi.
 */
object PadButton {
  const val UP = 0x0001
  const val DOWN = 0x0002
  const val LEFT = 0x0004
  const val RIGHT = 0x0008
  const val PLAY = 0x0010
  const val BACK = 0x0020
  const val LS_CLK = 0x0040
  const val RS_CLK = 0x0080
  const val LB = 0x0100
  const val RB = 0x0200
  const val SPECIAL = 0x0400
  const val A = 0x1000
  const val B = 0x2000
  const val X = 0x4000
  const val Y = 0x8000

  /** Tên nút cho sự kiện điều hướng UI (không phải cờ Moonlight). */
  fun nameOf(keyCode: Int): String? = when (keyCode) {
    KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_BUTTON_1 -> "a"
    KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_BUTTON_2 -> "b"
    KeyEvent.KEYCODE_BUTTON_C, KeyEvent.KEYCODE_BUTTON_3 -> "x"
    KeyEvent.KEYCODE_BUTTON_X -> "x"
    KeyEvent.KEYCODE_BUTTON_Y, KeyEvent.KEYCODE_BUTTON_4 -> "y"
    KeyEvent.KEYCODE_BUTTON_L1, KeyEvent.KEYCODE_BUTTON_5 -> "lb"
    KeyEvent.KEYCODE_BUTTON_R1, KeyEvent.KEYCODE_BUTTON_6 -> "rb"
    KeyEvent.KEYCODE_BUTTON_L2, KeyEvent.KEYCODE_BUTTON_7 -> "lt"
    KeyEvent.KEYCODE_BUTTON_R2, KeyEvent.KEYCODE_BUTTON_8 -> "rt"
    KeyEvent.KEYCODE_BUTTON_SELECT, KeyEvent.KEYCODE_BUTTON_9, KeyEvent.KEYCODE_BACK -> "select"
    KeyEvent.KEYCODE_BUTTON_START, KeyEvent.KEYCODE_BUTTON_10 -> "start"
    KeyEvent.KEYCODE_BUTTON_THUMBL, KeyEvent.KEYCODE_BUTTON_11 -> "l3"
    KeyEvent.KEYCODE_BUTTON_THUMBR, KeyEvent.KEYCODE_BUTTON_12 -> "r3"
    KeyEvent.KEYCODE_BUTTON_MODE, KeyEvent.KEYCODE_BUTTON_13 -> "guide"
    KeyEvent.KEYCODE_DPAD_UP -> "up"
    KeyEvent.KEYCODE_DPAD_DOWN -> "down"
    KeyEvent.KEYCODE_DPAD_LEFT -> "left"
    KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
    else -> null
  }

  fun flagOf(keyCode: Int): Int = when (keyCode) {
    KeyEvent.KEYCODE_BUTTON_A, KeyEvent.KEYCODE_BUTTON_1 -> A
    KeyEvent.KEYCODE_BUTTON_B, KeyEvent.KEYCODE_BUTTON_2 -> B
    KeyEvent.KEYCODE_BUTTON_C, KeyEvent.KEYCODE_BUTTON_3 -> X
    KeyEvent.KEYCODE_BUTTON_X -> X
    KeyEvent.KEYCODE_BUTTON_Y, KeyEvent.KEYCODE_BUTTON_4 -> Y
    KeyEvent.KEYCODE_BUTTON_L1, KeyEvent.KEYCODE_BUTTON_5 -> LB
    KeyEvent.KEYCODE_BUTTON_R1, KeyEvent.KEYCODE_BUTTON_6 -> RB
    KeyEvent.KEYCODE_BUTTON_THUMBL, KeyEvent.KEYCODE_BUTTON_11 -> LS_CLK
    KeyEvent.KEYCODE_BUTTON_THUMBR, KeyEvent.KEYCODE_BUTTON_12 -> RS_CLK
    KeyEvent.KEYCODE_BUTTON_START, KeyEvent.KEYCODE_BUTTON_10 -> PLAY
    KeyEvent.KEYCODE_BUTTON_SELECT, KeyEvent.KEYCODE_BUTTON_9, KeyEvent.KEYCODE_BACK -> BACK
    KeyEvent.KEYCODE_BUTTON_MODE, KeyEvent.KEYCODE_BUTTON_13 -> SPECIAL
    KeyEvent.KEYCODE_DPAD_UP -> UP
    KeyEvent.KEYCODE_DPAD_DOWN -> DOWN
    KeyEvent.KEYCODE_DPAD_LEFT -> LEFT
    KeyEvent.KEYCODE_DPAD_RIGHT -> RIGHT
    else -> 0
  }
}

/** Phím có phải của tay cầm (kể cả D-pad đến từ tay cầm, không phải bàn phím). */
fun isGamepadKey(keyCode: Int): Boolean =
  KeyEvent.isGamepadButton(keyCode) || when (keyCode) {
    KeyEvent.KEYCODE_DPAD_UP, KeyEvent.KEYCODE_DPAD_DOWN,
    KeyEvent.KEYCODE_DPAD_LEFT, KeyEvent.KEYCODE_DPAD_RIGHT,
    KeyEvent.KEYCODE_DPAD_CENTER, KeyEvent.KEYCODE_BACK -> true
    else -> false
  }

/**
 * Kiểm tra xem thiết bị có bàn phím gõ chữ thực thụ (phím Q, W, E, R, Space, Enter...)
 * hay không. Đây là khả năng gõ chữ, không loại trừ khả năng chơi game của
 * thiết bị HID có nhiều giao diện được Android gộp lại.
 */
fun hasAlphabeticTypingKeys(device: InputDevice?): Boolean {
  if (device == null) return false
  return try {
    val hasKeys = device.hasKeys(
      KeyEvent.KEYCODE_Q,
      KeyEvent.KEYCODE_W,
      KeyEvent.KEYCODE_E,
      KeyEvent.KEYCODE_R,
      KeyEvent.KEYCODE_SPACE,
      KeyEvent.KEYCODE_ENTER,
    )
    hasKeys.count { it } >= 4
  } catch (_: Throwable) {
    false
  }
}

/**
 * Chỉ coi là bàn phím gõ chữ khi thiết bị có nguồn KEYBOARD, kiểu ALPHABETIC,
 * và thực sự có các phím chữ cái (Q, W, E, R, Space, Enter).
 */
fun isAlphabeticKeyboardDevice(device: InputDevice?): Boolean {
  if (device == null || device.id <= 0) return false
  if (device.keyboardType != InputDevice.KEYBOARD_TYPE_ALPHABETIC) return false
  if ((device.sources and InputDevice.SOURCE_KEYBOARD) != InputDevice.SOURCE_KEYBOARD &&
    !device.supportsSource(InputDevice.SOURCE_KEYBOARD)
  ) {
    return false
  }
  return hasAlphabeticTypingKeys(device)
}

/**
 * Nhận diện thiết bị có phải là tay cầm chơi game (Bluetooth, USB, hoặc hệ thống).
 * Kiểm tra bitmask source, các nút tay cầm đặc trưng qua hasKeys, và các trục joystick.
 * Nguồn GAMEPAD/JOYSTICK luôn ưu tiên hơn khả năng gõ chữ của thiết bị HID gộp.
 */
fun isGamepadDevice(device: InputDevice?): Boolean {
  if (device == null || device.id <= 0) return false
  return controllerDevicePolicy(device.sources, { isAlphabeticKeyboardDevice(device) }) {
    // Một số tay cầm Bluetooth rẻ tiền tự khai báo như keyboard/DPAD. Không dùng
    // `any()` ở đây: bàn phím có thể quảng bá một keycode BUTTON_* phụ và bị biến
    // thành controller. Chỉ nhận fallback khi có cả cụm nút mặt và nút điều khiển.
    val hasControllerButtons = try {
      val hasKeys = device.hasKeys(
        KeyEvent.KEYCODE_BUTTON_A,
        KeyEvent.KEYCODE_BUTTON_B,
        KeyEvent.KEYCODE_BUTTON_X,
        KeyEvent.KEYCODE_BUTTON_Y,
        KeyEvent.KEYCODE_BUTTON_START,
        KeyEvent.KEYCODE_BUTTON_SELECT,
        KeyEvent.KEYCODE_BUTTON_MODE,
        KeyEvent.KEYCODE_BUTTON_1,
        KeyEvent.KEYCODE_BUTTON_THUMBL,
        KeyEvent.KEYCODE_BUTTON_L1,
      )
      val faceButtons = hasKeys.sliceArray(0..3).count { it }
      val controlButtons = hasKeys.sliceArray(4..9).count { it }
      faceButtons >= 2 && controlButtons >= 1
    } catch (_: Throwable) {
      false
    }

    if (hasControllerButtons) return@controllerDevicePolicy true

    val isMouse = device.supportsSource(InputDevice.SOURCE_MOUSE) ||
      device.supportsSource(InputDevice.SOURCE_TOUCHPAD)
    if (!isMouse) {
      val hasHat = device.getMotionRange(MotionEvent.AXIS_HAT_X) != null ||
        device.getMotionRange(MotionEvent.AXIS_HAT_Y) != null
      val hasRightStick = (device.getMotionRange(MotionEvent.AXIS_Z) != null && device.getMotionRange(MotionEvent.AXIS_RZ) != null) ||
        (device.getMotionRange(MotionEvent.AXIS_RX) != null && device.getMotionRange(MotionEvent.AXIS_RY) != null)
      if (hasHat || hasRightStick) return@controllerDevicePolicy true
    }

    false
  }
}

/**
 * Trạng thái một tay cầm, cùng hình dạng với `GamepadState` của moonlight-web:
 * cờ nút + hai cò + bốn trục. Trục giữ nguyên quy ước của Gamepad API (lên là
 * âm); phía JS đảo dấu Y đúng như `sendController` của client web.
 */
class PadState(val deviceId: Int) {
  var keyButtons = 0
  var hatButtons = 0
  var digitalLt = false
  var digitalRt = false
  var axisLt = 0f
  var axisRt = 0f
  var lx = 0f
  var ly = 0f
  var rx = 0f
  var ry = 0f

  // Lấy một lần từ MotionRange của thiết bị: tay cầm kiểu Xbox dùng Z/RZ cho
  // cần phải, kiểu PlayStation dùng RX/RY. Chọn sai là cần phải chết cứng.
  private var rightAxisX = MotionEvent.AXIS_Z
  private var rightAxisY = MotionEvent.AXIS_RZ
  private var leftTriggerAxis = -1
  private var rightTriggerAxis = -1

  val buttons: Int get() = keyButtons or hatButtons

  val lt: Float get() = if (digitalLt) 1f else axisLt
  val rt: Float get() = if (digitalRt) 1f else axisRt

  fun configure(device: InputDevice?) {
    if (device == null) return
    fun has(axis: Int) = device.getMotionRange(axis, InputDevice.SOURCE_JOYSTICK) != null ||
      device.getMotionRange(axis, InputDevice.SOURCE_GAMEPAD) != null ||
      device.getMotionRange(axis) != null
    val hasZ = has(MotionEvent.AXIS_Z)
    val hasRz = has(MotionEvent.AXIS_RZ)
    val hasRxRy = has(MotionEvent.AXIS_RX) && has(MotionEvent.AXIS_RY)

    leftTriggerAxis = when {
      has(MotionEvent.AXIS_LTRIGGER) -> MotionEvent.AXIS_LTRIGGER
      has(MotionEvent.AXIS_BRAKE) -> MotionEvent.AXIS_BRAKE
      else -> -1
    }
    rightTriggerAxis = when {
      has(MotionEvent.AXIS_RTRIGGER) -> MotionEvent.AXIS_RTRIGGER
      has(MotionEvent.AXIS_GAS) -> MotionEvent.AXIS_GAS
      else -> -1
    }

    if (hasRxRy && !(hasZ && hasRz)) {
      rightAxisX = MotionEvent.AXIS_RX
      rightAxisY = MotionEvent.AXIS_RY
    } else if (hasRxRy && hasZ && hasRz && leftTriggerAxis == -1) {
      rightAxisX = MotionEvent.AXIS_RX
      rightAxisY = MotionEvent.AXIS_RY
      leftTriggerAxis = MotionEvent.AXIS_Z
      rightTriggerAxis = MotionEvent.AXIS_RZ
    } else {
      rightAxisX = MotionEvent.AXIS_Z
      rightAxisY = MotionEvent.AXIS_RZ
    }
  }

  /** Cập nhật nút; trả về true khi trạng thái thật sự đổi. */
  fun applyKey(keyCode: Int, down: Boolean): Boolean {
    when (keyCode) {
      KeyEvent.KEYCODE_BUTTON_L2, KeyEvent.KEYCODE_BUTTON_7 -> {
        if (digitalLt == down) return false
        digitalLt = down
        return true
      }
      KeyEvent.KEYCODE_BUTTON_R2, KeyEvent.KEYCODE_BUTTON_8 -> {
        if (digitalRt == down) return false
        digitalRt = down
        return true
      }
    }
    val flag = PadButton.flagOf(keyCode)
    if (flag == 0) return false
    val next = if (down) keyButtons or flag else keyButtons and flag.inv()
    if (next == keyButtons) return false
    keyButtons = next
    return true
  }

  /** Đọc trục từ MotionEvent; trả về true khi có giá trị đổi. */
  fun applyMotion(event: MotionEvent, device: InputDevice?): Boolean {
    val before = snapshot()
    lx = axis(event, device, MotionEvent.AXIS_X)
    ly = axis(event, device, MotionEvent.AXIS_Y)
    rx = axis(event, device, rightAxisX)
    ry = axis(event, device, rightAxisY)
    axisLt = if (leftTriggerAxis >= 0) trigger(event, device, leftTriggerAxis) else 0f
    axisRt = if (rightTriggerAxis >= 0) trigger(event, device, rightTriggerAxis) else 0f

    val hatX = event.getAxisValue(MotionEvent.AXIS_HAT_X)
    val hatY = event.getAxisValue(MotionEvent.AXIS_HAT_Y)
    var hat = 0
    if (hatX < -0.5f) hat = hat or PadButton.LEFT
    if (hatX > 0.5f) hat = hat or PadButton.RIGHT
    if (hatY < -0.5f) hat = hat or PadButton.UP
    if (hatY > 0.5f) hat = hat or PadButton.DOWN
    hatButtons = hat
    return !snapshot().contentEquals(before)
  }

  private fun axis(event: MotionEvent, device: InputDevice?, axis: Int): Float {
    val value = event.getAxisValue(axis)
    val flat = device?.getMotionRange(axis, event.source)?.flat ?: 0f
    // Chỉ cắt vùng chết cứng của phần cứng; vùng chết mềm do JS áp theo cài đặt.
    return if (abs(value) <= flat) 0f else value.coerceIn(-1f, 1f)
  }

  private fun trigger(event: MotionEvent, device: InputDevice?, axis: Int): Float {
    if (axis < 0) return 0f
    val range = device?.getMotionRange(axis, event.source) ?: device?.getMotionRange(axis)
    if (range == null) return 0f
    val value = event.getAxisValue(axis)
    // Cò có thể báo -1..1 (trạng thái nghỉ là -1) hoặc 0..1.
    val normalized = if (range.min < 0f && range.max > range.min) {
      (value - range.min) / (range.max - range.min)
    } else if (range.max > 0f) {
      value / range.max
    } else 0f
    return normalized.coerceIn(0f, 1f)
  }

  /** Lượng tử hoá để loại gói trùng khi cần analog rung nhẹ quanh một giá trị. */
  fun snapshot(): IntArray = intArrayOf(
    buttons,
    quant(lt), quant(rt), quant(lx), quant(ly), quant(rx), quant(ry),
  )

  private fun quant(value: Float): Int = (value * 127f).roundToInt()
}
