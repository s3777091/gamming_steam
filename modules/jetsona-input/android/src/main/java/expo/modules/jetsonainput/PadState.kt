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
    KeyEvent.KEYCODE_BUTTON_A -> "a"
    KeyEvent.KEYCODE_BUTTON_B -> "b"
    KeyEvent.KEYCODE_BUTTON_X -> "x"
    KeyEvent.KEYCODE_BUTTON_Y -> "y"
    KeyEvent.KEYCODE_BUTTON_L1 -> "lb"
    KeyEvent.KEYCODE_BUTTON_R1 -> "rb"
    KeyEvent.KEYCODE_BUTTON_L2 -> "lt"
    KeyEvent.KEYCODE_BUTTON_R2 -> "rt"
    KeyEvent.KEYCODE_BUTTON_THUMBL -> "l3"
    KeyEvent.KEYCODE_BUTTON_THUMBR -> "r3"
    KeyEvent.KEYCODE_BUTTON_START -> "start"
    KeyEvent.KEYCODE_BUTTON_SELECT -> "select"
    KeyEvent.KEYCODE_BUTTON_MODE -> "guide"
    KeyEvent.KEYCODE_DPAD_UP -> "up"
    KeyEvent.KEYCODE_DPAD_DOWN -> "down"
    KeyEvent.KEYCODE_DPAD_LEFT -> "left"
    KeyEvent.KEYCODE_DPAD_RIGHT -> "right"
    else -> null
  }

  fun flagOf(keyCode: Int): Int = when (keyCode) {
    KeyEvent.KEYCODE_BUTTON_A -> A
    KeyEvent.KEYCODE_BUTTON_B -> B
    KeyEvent.KEYCODE_BUTTON_X -> X
    KeyEvent.KEYCODE_BUTTON_Y -> Y
    KeyEvent.KEYCODE_BUTTON_L1 -> LB
    KeyEvent.KEYCODE_BUTTON_R1 -> RB
    KeyEvent.KEYCODE_BUTTON_THUMBL -> LS_CLK
    KeyEvent.KEYCODE_BUTTON_THUMBR -> RS_CLK
    KeyEvent.KEYCODE_BUTTON_START -> PLAY
    KeyEvent.KEYCODE_BUTTON_SELECT -> BACK
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
    KeyEvent.KEYCODE_DPAD_CENTER -> true
    else -> false
  }

/** Sự kiện đến từ tay cầm thật chứ không phải bàn phím có phím mũi tên. */
fun isGamepadSource(source: Int): Boolean =
  (source and InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD ||
    (source and InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK

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
  private var leftTriggerAxis = MotionEvent.AXIS_LTRIGGER
  private var rightTriggerAxis = MotionEvent.AXIS_RTRIGGER

  val buttons: Int get() = keyButtons or hatButtons

  val lt: Float get() = if (digitalLt) 1f else axisLt
  val rt: Float get() = if (digitalRt) 1f else axisRt

  fun configure(device: InputDevice?) {
    if (device == null) return
    fun has(axis: Int) = device.getMotionRange(axis, InputDevice.SOURCE_JOYSTICK) != null ||
      device.getMotionRange(axis) != null
    val hasRz = has(MotionEvent.AXIS_RZ)
    val hasRxRy = has(MotionEvent.AXIS_RX) && has(MotionEvent.AXIS_RY)
    if (hasRxRy && !(has(MotionEvent.AXIS_Z) && hasRz)) {
      rightAxisX = MotionEvent.AXIS_RX
      rightAxisY = MotionEvent.AXIS_RY
    } else {
      rightAxisX = MotionEvent.AXIS_Z
      rightAxisY = MotionEvent.AXIS_RZ
    }
    if (!has(MotionEvent.AXIS_LTRIGGER) && has(MotionEvent.AXIS_BRAKE)) leftTriggerAxis = MotionEvent.AXIS_BRAKE
    if (!has(MotionEvent.AXIS_RTRIGGER) && has(MotionEvent.AXIS_GAS)) rightTriggerAxis = MotionEvent.AXIS_GAS
    // PlayStation: cò nằm ở Z/RZ khi cần phải dùng RX/RY.
    if (hasRxRy && has(MotionEvent.AXIS_Z) && hasRz &&
      !has(MotionEvent.AXIS_LTRIGGER) && !has(MotionEvent.AXIS_BRAKE)
    ) {
      leftTriggerAxis = MotionEvent.AXIS_Z
      rightTriggerAxis = MotionEvent.AXIS_RZ
      rightAxisX = MotionEvent.AXIS_RX
      rightAxisY = MotionEvent.AXIS_RY
    }
  }

  /** Cập nhật nút; trả về true khi trạng thái thật sự đổi. */
  fun applyKey(keyCode: Int, down: Boolean): Boolean {
    when (keyCode) {
      KeyEvent.KEYCODE_BUTTON_L2 -> {
        if (digitalLt == down) return false
        digitalLt = down
        return true
      }
      KeyEvent.KEYCODE_BUTTON_R2 -> {
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
    axisLt = trigger(event, device, leftTriggerAxis)
    axisRt = trigger(event, device, rightTriggerAxis)

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
    val range = device?.getMotionRange(axis, event.source)
    val value = event.getAxisValue(axis)
    if (range == null) return value.coerceIn(0f, 1f)
    // Cò có thể báo -1..1 (trạng thái nghỉ là -1) hoặc 0..1.
    val normalized = if (range.min < 0f) (value - range.min) / (range.max - range.min) else value / range.max
    return normalized.coerceIn(0f, 1f)
  }

  /** Lượng tử hoá để loại gói trùng khi cần analog rung nhẹ quanh một giá trị. */
  fun snapshot(): IntArray = intArrayOf(
    buttons,
    quant(lt), quant(rt), quant(lx), quant(ly), quant(rx), quant(ry),
  )

  private fun quant(value: Float): Int = (value * 127f).roundToInt()
}
