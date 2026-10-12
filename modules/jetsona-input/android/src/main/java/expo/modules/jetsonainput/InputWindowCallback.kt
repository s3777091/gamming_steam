package expo.modules.jetsonainput

import android.content.Context
import android.os.Build
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.View
import android.view.Window
import androidx.annotation.RequiresApi

/**
 * Nơi duy nhất nhìn thấy phím/trục/chuột vật lý TRƯỚC khi React Native thấy.
 *
 * Bọc `Window.Callback` của Activity thay vì sửa MainActivity: nhờ vậy
 * `expo prebuild --clean` không làm mất hook, và module tự gỡ được khi dừng.
 * Trả `true` nghĩa là sự kiện đã được tiêu thụ và Android không đưa nó cho UI.
 */
interface InputSink {
  fun onKey(event: KeyEvent): Boolean
  fun onMotion(event: MotionEvent): Boolean
  fun onTouch(event: MotionEvent): Boolean
}

class InputWindowCallback(
  val base: Window.Callback,
  private val sink: InputSink,
) : Window.Callback by base {
  override fun dispatchKeyEvent(event: KeyEvent): Boolean =
    sink.onKey(event) || base.dispatchKeyEvent(event)

  override fun dispatchGenericMotionEvent(event: MotionEvent): Boolean =
    sink.onMotion(event) || base.dispatchGenericMotionEvent(event)

  override fun dispatchTouchEvent(event: MotionEvent): Boolean =
    sink.onTouch(event) || base.dispatchTouchEvent(event)

  // Một số bản Android đưa chuột bị bắt (pointer capture) qua trackball.
  override fun dispatchTrackballEvent(event: MotionEvent): Boolean =
    sink.onMotion(event) || base.dispatchTrackballEvent(event)
}

/**
 * View vô hình giữ focus để xin pointer capture: chuột Bluetooth khi đó gửi
 * chuyển động TƯƠNG ĐỐI, không bị kẹt ở mép màn hình như con trỏ Android.
 * Không bao giờ nhận chạm — cảm ứng đi thẳng xuống React Native.
 */
@RequiresApi(Build.VERSION_CODES.O)
class CaptureView(context: Context, private val onCaptured: (MotionEvent) -> Boolean) : View(context) {
  init {
    isFocusable = true
    isFocusableInTouchMode = true
    alpha = 0f
    importantForAccessibility = IMPORTANT_FOR_ACCESSIBILITY_NO
    setOnCapturedPointerListener { _, event -> onCaptured(event) }
  }

  override fun onTouchEvent(event: MotionEvent): Boolean = false
}
