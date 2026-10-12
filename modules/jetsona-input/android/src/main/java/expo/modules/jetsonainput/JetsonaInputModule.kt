package expo.modules.jetsonainput

import android.app.Activity
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.hardware.input.InputManager
import android.media.AudioDeviceCallback
import android.media.AudioDeviceInfo
import android.media.AudioManager
import android.graphics.Bitmap
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.os.VibrationEffect
import android.os.Vibrator
import android.provider.Settings
import android.view.InputDevice
import android.view.KeyEvent
import android.view.MotionEvent
import android.util.Base64
import android.util.DisplayMetrics
import android.view.PixelCopy
import android.view.ViewGroup
import android.view.WindowManager
import android.view.Window
import androidx.core.view.WindowCompat
import java.io.ByteArrayOutputStream
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Cầu nối phần cứng nhập liệu cho app: tay cầm, bàn phím, chuột (Bluetooth hoặc
 * cắm dây), tai nghe, rung, và vài thao tác hệ thống mà JS không với tới.
 *
 * Mọi thay đổi thiết bị đi lên JS bằng SỰ KIỆN (InputDeviceListener,
 * AudioDeviceCallback, broadcast Bluetooth) — không có vòng lặp hỏi thăm nào.
 *
 * Ba chế độ bắt (`setCaptureMode`):
 *  - off    : không đụng gì, Android xử lý như bình thường.
 *  - ui     : tay cầm bị bắt để điều khiển con trỏ trong giao diện; bàn phím và
 *             chuột đi thẳng xuống React Native (gõ chữ vào ô tìm kiếm).
 *  - stream : tay cầm, bàn phím và chuột vật lý đều bị bắt và gửi sang PC.
 */
class JetsonaInputModule : Module(), InputSink {
  private val main = Handler(Looper.getMainLooper())

  private var attachedActivity: Activity? = null
  private var windowCallback: InputWindowCallback? = null
  private var captureView: CaptureView? = null
  private var captureMode = MODE_UI
  private var pointerCaptured = false
  private var listenersInstalled = false

  private val pads = HashMap<Int, PadState>()
  private val lastEmitted = HashMap<Int, IntArray>()
  private val lastEmitAt = HashMap<Int, Long>()
  private val heldKeys = HashSet<Int>()

  private var lastHoverX = Float.NaN
  private var lastHoverY = Float.NaN
  private var touchDownTime = 0L

  private val devicesDirty = Runnable { emitDevices() }

  private var lastFrame: Bitmap? = null
  private var previousAudioMode: Int? = null
  private var previousSpeakerphone: Boolean? = null

  private val inputManager: InputManager?
    get() = appContext.reactContext?.getSystemService(Context.INPUT_SERVICE) as? InputManager
  private val audioManager: AudioManager?
    get() = appContext.reactContext?.getSystemService(Context.AUDIO_SERVICE) as? AudioManager
  private val bluetoothAdapter: BluetoothAdapter?
    get() = (appContext.reactContext?.getSystemService(Context.BLUETOOTH_SERVICE) as? BluetoothManager)?.adapter

  private val deviceListener = object : InputManager.InputDeviceListener {
    override fun onInputDeviceAdded(deviceId: Int) = scheduleDevices()
    override fun onInputDeviceRemoved(deviceId: Int) {
      pads.remove(deviceId)
      lastEmitted.remove(deviceId)
      lastEmitAt.remove(deviceId)
      scheduleDevices()
    }
    override fun onInputDeviceChanged(deviceId: Int) = scheduleDevices()
  }

  private val audioCallback = object : AudioDeviceCallback() {
    override fun onAudioDevicesAdded(addedDevices: Array<out AudioDeviceInfo>?) = scheduleDevices()
    override fun onAudioDevicesRemoved(removedDevices: Array<out AudioDeviceInfo>?) = scheduleDevices()
  }

  private val bluetoothReceiver = object : BroadcastReceiver() {
    override fun onReceive(context: Context?, intent: Intent?) {
      sendEvent("onBluetoothChanged", bluetoothInfo())
      scheduleDevices()
    }
  }

  override fun definition() = ModuleDefinition {
    Name("JetsonaInput")

    Events(
      "onDevicesChanged",
      "onBluetoothChanged",
      "onGamepadState",
      "onGamepadButton",
      "onKey",
      "onMouse",
    )

    OnCreate { attach() }
    OnActivityEntersForeground { attach() }
    OnActivityEntersBackground { releaseAllInput() }
    OnDestroy { detach() }

    Function("getDevices") { listDevices() }
    Function("getBluetooth") { bluetoothInfo() }

    Function("setCaptureMode") { mode: String ->
      captureMode = if (mode == MODE_STREAM || mode == MODE_OFF) mode else MODE_UI
      if (captureMode != MODE_STREAM) setPointerCapture(false)
      releaseAllInput()
    }

    Function("setPointerCapture") { enabled: Boolean -> setPointerCapture(enabled) }

    Function("setImmersive") { enabled: Boolean -> runOnUi { applyImmersive(it, enabled) } }

    Function("injectTouch") { action: String, x: Double, y: Double -> injectTouch(action, x.toFloat(), y.toFloat()) }

    Function("rumble") { deviceId: Int, low: Double, high: Double, durationMs: Int ->
      rumble(deviceId, low.toFloat(), high.toFloat(), durationMs)
    }

    Function("stopRumble") { deviceId: Int -> stopRumble(deviceId) }

    Function("openBluetoothSettings") { openSettings(Settings.ACTION_BLUETOOTH_SETTINGS) }
    Function("openWifiSettings") { openSettings(Settings.ACTION_WIFI_SETTINGS) }

    Function("startSpeakerRoute") { startSpeakerRoute() }
    Function("stopSpeakerRoute") { stopSpeakerRoute() }

    Function("describeDevice") { deviceId: Int -> describeDevice(deviceId) }

    Function("getDisplayInfo") { displayInfo() }

    // Chụp khung hình đang hiện trên cửa sổ (kể cả video RTCView) bằng PixelCopy.
    // Tách hai bước: grabFrame giữ bitmap NGAY (trước khi menu che), exportFrame
    // nén PNG khi người dùng thật sự cần ảnh.
    AsyncFunction("grabFrame") { promise: Promise -> grabFrame(promise) }
    AsyncFunction("exportFrame") { maxWidth: Int, promise: Promise -> exportFrame(maxWidth, promise) }
    Function("releaseFrame") { lastFrame?.recycle(); lastFrame = null }
  }

  // ---- vòng đời ----

  private fun attach() {
    val activity = appContext.currentActivity ?: return
    if (attachedActivity === activity && windowCallback != null) return
    detachWindow()
    attachedActivity = activity
    runOnUi { target ->
      val window = target.window
      val current = window.callback
      if (current !is InputWindowCallback) {
        val wrapper = InputWindowCallback(current, this)
        window.callback = wrapper
        windowCallback = wrapper
      } else {
        windowCallback = current
      }
    }
    installListeners()
  }

  private fun detach() {
    detachWindow()
    removeListeners()
    stopSpeakerRoute()
    attachedActivity = null
  }

  private fun detachWindow() {
    val activity = attachedActivity ?: return
    val wrapper = windowCallback
    runOnUi {
      if (wrapper != null && activity.window.callback === wrapper) activity.window.callback = wrapper.base
      captureView?.let { (it.parent as? ViewGroup)?.removeView(it) }
      captureView = null
    }
    windowCallback = null
    pointerCaptured = false
  }

  private fun installListeners() {
    if (listenersInstalled) return
    val context = appContext.reactContext ?: return
    inputManager?.registerInputDeviceListener(deviceListener, main)
    audioManager?.registerAudioDeviceCallback(audioCallback, main)
    val filter = IntentFilter().apply {
      addAction(BluetoothAdapter.ACTION_STATE_CHANGED)
      addAction(BluetoothDevice.ACTION_ACL_CONNECTED)
      addAction(BluetoothDevice.ACTION_ACL_DISCONNECTED)
      addAction(BluetoothDevice.ACTION_BOND_STATE_CHANGED)
    }
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
      context.registerReceiver(bluetoothReceiver, filter, Context.RECEIVER_EXPORTED)
    } else {
      @Suppress("UnspecifiedRegisterReceiverFlag")
      context.registerReceiver(bluetoothReceiver, filter)
    }
    listenersInstalled = true
  }

  private fun removeListeners() {
    if (!listenersInstalled) return
    inputManager?.unregisterInputDeviceListener(deviceListener)
    audioManager?.unregisterAudioDeviceCallback(audioCallback)
    try {
      appContext.reactContext?.unregisterReceiver(bluetoothReceiver)
    } catch (_: IllegalArgumentException) {
      // Đã gỡ.
    }
    listenersInstalled = false
  }

  private fun runOnUi(block: (Activity) -> Unit) {
    val activity = attachedActivity ?: appContext.currentActivity ?: return
    if (Looper.myLooper() == Looper.getMainLooper()) block(activity) else activity.runOnUiThread { block(activity) }
  }

  private fun scheduleDevices() {
    main.removeCallbacks(devicesDirty)
    main.postDelayed(devicesDirty, 120)
  }

  private fun emitDevices() {
    sendEvent("onDevicesChanged", mapOf("devices" to listDevices()))
  }

  // ---- danh sách thiết bị ----

  private fun bondedNames(): Set<String> = try {
    bluetoothAdapter?.bondedDevices?.mapNotNull { it.name }?.toSet() ?: emptySet()
  } catch (_: SecurityException) {
    emptySet()
  }

  private fun classify(device: InputDevice): String? {
    val sources = device.sources
    return when {
      isGamepadSource(sources) -> "controller"
      (sources and InputDevice.SOURCE_KEYBOARD) == InputDevice.SOURCE_KEYBOARD &&
        device.keyboardType == InputDevice.KEYBOARD_TYPE_ALPHABETIC -> "keyboard"
      (sources and InputDevice.SOURCE_MOUSE) == InputDevice.SOURCE_MOUSE ||
        (sources and InputDevice.SOURCE_TOUCHPAD) == InputDevice.SOURCE_TOUCHPAD -> "mouse"
      else -> null
    }
  }

  private fun batteryOf(device: InputDevice): Double {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) return -1.0
    return try {
      val battery = device.batteryState
      if (battery.isPresent && !battery.capacity.isNaN()) battery.capacity.toDouble() else -1.0
    } catch (_: Throwable) {
      -1.0
    }
  }

  private fun listDevices(): List<Map<String, Any?>> {
    val result = ArrayList<Map<String, Any?>>()
    val bonded = bondedNames()
    for (id in InputDevice.getDeviceIds()) {
      val device = InputDevice.getDevice(id) ?: continue
      if (device.isVirtual) continue
      val kind = classify(device) ?: continue
      result += mapOf(
        "id" to "input:$id",
        "nativeId" to id,
        "name" to device.name,
        "kind" to kind,
        "source" to if (kind == "controller") "gamepad" else kind,
        "vendorId" to device.vendorId,
        "productId" to device.productId,
        "bluetooth" to bonded.contains(device.name),
        "battery" to batteryOf(device),
        "rumble" to (kind == "controller" && vibratorFor(id) != null),
        "connected" to true,
      )
    }
    val audio = audioManager
    if (audio != null) {
      val seen = HashSet<String>()
      for (info in audio.getDevices(AudioManager.GET_DEVICES_OUTPUTS)) {
        val label = when (info.type) {
          AudioDeviceInfo.TYPE_BLUETOOTH_A2DP,
          AudioDeviceInfo.TYPE_BLUETOOTH_SCO -> "bluetooth"
          AudioDeviceInfo.TYPE_WIRED_HEADSET,
          AudioDeviceInfo.TYPE_WIRED_HEADPHONES -> "wired"
          AudioDeviceInfo.TYPE_USB_HEADSET,
          AudioDeviceInfo.TYPE_USB_DEVICE -> "usb"
          else -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S && info.type == AudioDeviceInfo.TYPE_BLE_HEADSET) "bluetooth" else null
        } ?: continue
        val name = info.productName?.toString().orEmpty().ifBlank { "Tai nghe" }
        if (!seen.add("$label:$name")) continue
        result += mapOf(
          "id" to "audio:${info.id}",
          "nativeId" to info.id,
          "name" to name,
          "kind" to "headset",
          "source" to "audio",
          "vendorId" to 0,
          "productId" to 0,
          "bluetooth" to (label == "bluetooth"),
          "battery" to -1.0,
          "rumble" to false,
          "connected" to true,
        )
      }
    }
    return result
  }

  private fun bluetoothInfo(): Map<String, Any?> {
    val adapter = bluetoothAdapter
    val permitted = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || try {
      appContext.reactContext?.checkSelfPermission(android.Manifest.permission.BLUETOOTH_CONNECT) ==
        android.content.pm.PackageManager.PERMISSION_GRANTED
    } catch (_: Throwable) {
      false
    }
    val bonded = ArrayList<Map<String, Any?>>()
    if (adapter != null && permitted) {
      try {
        for (device in adapter.bondedDevices.orEmpty()) {
          bonded += mapOf("name" to (device.name ?: "Thiết bị Bluetooth"), "type" to device.bluetoothClass?.majorDeviceClass)
        }
      } catch (_: SecurityException) {
        // Quyền bị thu hồi giữa chừng.
      }
    }
    return mapOf(
      "supported" to (adapter != null),
      "enabled" to (adapter?.isEnabled == true),
      "permitted" to permitted,
      "bonded" to bonded,
    )
  }

  private fun describeDevice(deviceId: Int): Map<String, Any?>? {
    val device = InputDevice.getDevice(deviceId) ?: return null
    val ranges = device.motionRanges.map {
      mapOf("axis" to MotionEvent.axisToString(it.axis), "min" to it.min, "max" to it.max, "flat" to it.flat)
    }
    return mapOf("name" to device.name, "descriptor" to device.descriptor, "sources" to device.sources, "axes" to ranges)
  }


  private fun displayInfo(): Map<String, Any?> {
    val context = appContext.reactContext
    val activity = attachedActivity ?: appContext.currentActivity
    @Suppress("DEPRECATION")
    val display = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
      activity?.display
    } else {
      (context?.getSystemService(Context.WINDOW_SERVICE) as? WindowManager)?.defaultDisplay
    }
    val metrics = DisplayMetrics()
    @Suppress("DEPRECATION")
    display?.getRealMetrics(metrics)
    val cutout = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) activity?.window?.decorView?.rootWindowInsets?.displayCutout else null
    return mapOf(
      "refreshRate" to (display?.refreshRate?.toDouble() ?: 60.0),
      "widthPx" to metrics.widthPixels,
      "heightPx" to metrics.heightPixels,
      "insets" to mapOf(
        "left" to (cutout?.safeInsetLeft ?: 0),
        "top" to (cutout?.safeInsetTop ?: 0),
        "right" to (cutout?.safeInsetRight ?: 0),
        "bottom" to (cutout?.safeInsetBottom ?: 0),
      ),
    )
  }


  private fun grabFrame(promise: Promise) {
    val activity = attachedActivity ?: appContext.currentActivity
    if (activity == null || Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      promise.resolve(false)
      return
    }
    activity.runOnUiThread {
      val view = activity.window.decorView
      if (view.width <= 0 || view.height <= 0) {
        promise.resolve(false)
        return@runOnUiThread
      }
      val bitmap = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
      try {
        PixelCopy.request(activity.window, bitmap, { result ->
          if (result == PixelCopy.SUCCESS) {
            lastFrame?.recycle()
            lastFrame = bitmap
            promise.resolve(true)
          } else {
            bitmap.recycle()
            promise.resolve(false)
          }
        }, main)
      } catch (_: IllegalArgumentException) {
        bitmap.recycle()
        promise.resolve(false)
      }
    }
  }

  private fun exportFrame(maxWidth: Int, promise: Promise) {
    val frame = lastFrame
    if (frame == null || frame.isRecycled) {
      promise.resolve(null)
      return
    }
    Thread {
      try {
        val scaled = if (frame.width > maxWidth && maxWidth > 0) {
          Bitmap.createScaledBitmap(frame, maxWidth, frame.height * maxWidth / frame.width, true)
        } else frame
        val out = ByteArrayOutputStream()
        scaled.compress(Bitmap.CompressFormat.PNG, 100, out)
        if (scaled !== frame) scaled.recycle()
        promise.resolve(Base64.encodeToString(out.toByteArray(), Base64.NO_WRAP))
      } catch (error: Throwable) {
        promise.resolve(null)
      }
    }.start()
  }

  // ---- sự kiện phím / trục / chuột ----

  private fun pad(deviceId: Int): PadState {
    return pads.getOrPut(deviceId) {
      PadState(deviceId).also { it.configure(InputDevice.getDevice(deviceId)) }
    }
  }

  private fun capturing(): Boolean = captureMode != MODE_OFF

  override fun onKey(event: KeyEvent): Boolean {
    val source = event.source
    val keyCode = event.keyCode
    val down = event.action == KeyEvent.ACTION_DOWN

    if (captureMode == MODE_OFF) return false

    // 1) Tay cầm
    if (isGamepadSource(source) && isGamepadKey(keyCode)) {
      val pad = pad(event.deviceId)
      val name = PadButton.nameOf(keyCode)
      val changed = pad.applyKey(keyCode, down)
      if (name != null && (changed || name == "guide") && event.repeatCount == 0) {
        sendEvent("onGamepadButton", mapOf("deviceId" to event.deviceId, "button" to name, "down" to down))
      }
      if (changed) emitPad(pad, force = true)
      return true
    }

    // 2) Bàn phím vật lý, chỉ khi đang stream
    if (captureMode == MODE_STREAM && isPhysicalKeyboard(event)) {
      if (keyCode == KeyEvent.KEYCODE_BACK || keyCode == KeyEvent.KEYCODE_HOME) return false
      val vk = KeyMap.virtualKey(keyCode)
      if (vk == 0) return false
      if (down && event.repeatCount > 0 && heldKeys.contains(keyCode)) {
        // Windows tự lặp phím khi đang giữ; không gửi thêm keydown.
        return true
      }
      if (down) heldKeys.add(keyCode) else heldKeys.remove(keyCode)
      sendEvent(
        "onKey",
        mapOf(
          "deviceId" to event.deviceId,
          "keyCode" to keyCode,
          "vk" to vk,
          "down" to down,
          "modifiers" to KeyMap.modifiers(event.metaState),
        ),
      )
      return true
    }
    return false
  }

  private fun isPhysicalKeyboard(event: KeyEvent): Boolean {
    if ((event.source and InputDevice.SOURCE_KEYBOARD) != InputDevice.SOURCE_KEYBOARD) return false
    val device = event.device ?: return false
    return !device.isVirtual && device.keyboardType == InputDevice.KEYBOARD_TYPE_ALPHABETIC
  }

  override fun onMotion(event: MotionEvent): Boolean {
    if (captureMode == MODE_OFF) return false
    val source = event.source

    if (isGamepadSource(source) && event.actionMasked == MotionEvent.ACTION_MOVE) {
      val device = event.device
      val pad = pad(event.deviceId)
      if (pad.applyMotion(event, device)) emitPad(pad, force = false)
      return true
    }

    if (captureMode != MODE_STREAM) return false

    if ((source and InputDevice.SOURCE_MOUSE_RELATIVE) == InputDevice.SOURCE_MOUSE_RELATIVE) {
      return onCapturedPointer(event)
    }
    if ((source and InputDevice.SOURCE_MOUSE) == InputDevice.SOURCE_MOUSE) {
      return onAbsoluteMouse(event)
    }
    return false
  }

  override fun onTouch(event: MotionEvent): Boolean {
    if (captureMode != MODE_STREAM) return false
    if ((event.source and InputDevice.SOURCE_MOUSE) != InputDevice.SOURCE_MOUSE) return false
    return onAbsoluteMouse(event)
  }

  private var absoluteButtons = 0

  /** Chuột chưa được pointer capture: suy ra chuyển động từ toạ độ tuyệt đối. */
  private fun onAbsoluteMouse(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_HOVER_MOVE, MotionEvent.ACTION_MOVE -> {
        if (!lastHoverX.isNaN()) {
          val dx = event.x - lastHoverX
          val dy = event.y - lastHoverY
          if (dx != 0f || dy != 0f) sendEvent("onMouse", mapOf("type" to "move", "dx" to dx.toDouble(), "dy" to dy.toDouble()))
        }
        lastHoverX = event.x
        lastHoverY = event.y
      }
      MotionEvent.ACTION_HOVER_EXIT, MotionEvent.ACTION_HOVER_ENTER -> {
        lastHoverX = Float.NaN
        lastHoverY = Float.NaN
      }
      MotionEvent.ACTION_SCROLL -> emitScroll(event)
    }
    if (event.actionMasked == MotionEvent.ACTION_DOWN ||
      event.actionMasked == MotionEvent.ACTION_UP ||
      event.actionMasked == MotionEvent.ACTION_MOVE ||
      event.actionMasked == MotionEvent.ACTION_CANCEL
    ) {
      syncButtons(if (event.actionMasked == MotionEvent.ACTION_UP || event.actionMasked == MotionEvent.ACTION_CANCEL) 0 else event.buttonState)
    }
    return true
  }

  private fun syncButtons(state: Int) {
    val changed = state xor absoluteButtons
    if (changed == 0) return
    for ((mask, button) in BUTTON_MAP) {
      if ((changed and mask) != 0) {
        sendEvent("onMouse", mapOf("type" to "button", "button" to button, "down" to ((state and mask) != 0)))
      }
    }
    absoluteButtons = state
  }

  private fun emitScroll(event: MotionEvent) {
    val v = event.getAxisValue(MotionEvent.AXIS_VSCROLL).toDouble()
    val h = event.getAxisValue(MotionEvent.AXIS_HSCROLL).toDouble()
    if (v != 0.0 || h != 0.0) sendEvent("onMouse", mapOf("type" to "wheel", "dx" to h, "dy" to v))
  }

  /** Chuyển động tương đối do pointer capture: x/y của sự kiện đã là delta. */
  private fun onCapturedPointer(event: MotionEvent): Boolean {
    when (event.actionMasked) {
      MotionEvent.ACTION_MOVE, MotionEvent.ACTION_HOVER_MOVE -> {
        val dx = event.x
        val dy = event.y
        if (dx != 0f || dy != 0f) sendEvent("onMouse", mapOf("type" to "move", "dx" to dx.toDouble(), "dy" to dy.toDouble()))
        syncButtons(event.buttonState)
      }
      MotionEvent.ACTION_BUTTON_PRESS, MotionEvent.ACTION_BUTTON_RELEASE,
      MotionEvent.ACTION_DOWN, MotionEvent.ACTION_UP -> syncButtons(
        if (event.actionMasked == MotionEvent.ACTION_UP) 0 else event.buttonState,
      )
      MotionEvent.ACTION_SCROLL -> emitScroll(event)
    }
    return true
  }

  // ---- phát trạng thái tay cầm ----

  private fun emitPad(pad: PadState, force: Boolean) {
    val snapshot = pad.snapshot()
    val previous = lastEmitted[pad.deviceId]
    if (previous != null && previous.contentEquals(snapshot)) return
    val now = SystemClock.uptimeMillis()
    val buttonsChanged = previous == null || previous[0] != snapshot[0]
    val last = lastEmitAt[pad.deviceId] ?: 0L
    // Trục chỉ cần ~125 Hz; nút luôn đi ngay để không mất một cú bấm.
    if (!force && !buttonsChanged && now - last < MIN_AXIS_INTERVAL_MS) return
    lastEmitted[pad.deviceId] = snapshot
    lastEmitAt[pad.deviceId] = now
    sendEvent(
      "onGamepadState",
      mapOf(
        "deviceId" to pad.deviceId,
        "buttons" to pad.buttons,
        "lt" to pad.lt.toDouble(),
        "rt" to pad.rt.toDouble(),
        "lx" to pad.lx.toDouble(),
        "ly" to pad.ly.toDouble(),
        "rx" to pad.rx.toDouble(),
        "ry" to pad.ry.toDouble(),
      ),
    )
  }

  /** Nhả mọi thứ đang giữ (đổi chế độ, app xuống nền) để PC không kẹt phím. */
  private fun releaseAllInput() {
    for (pad in pads.values) {
      pad.keyButtons = 0
      pad.hatButtons = 0
      pad.digitalLt = false
      pad.digitalRt = false
      pad.axisLt = 0f
      pad.axisRt = 0f
      pad.lx = 0f; pad.ly = 0f; pad.rx = 0f; pad.ry = 0f
      emitPad(pad, force = true)
    }
    for (keyCode in heldKeys.toList()) {
      val vk = KeyMap.virtualKey(keyCode)
      if (vk != 0) sendEvent("onKey", mapOf("deviceId" to -1, "keyCode" to keyCode, "vk" to vk, "down" to false, "modifiers" to 0))
    }
    heldKeys.clear()
    syncButtons(0)
    lastHoverX = Float.NaN
    lastHoverY = Float.NaN
  }

  // ---- chuột tương đối ----

  private fun setPointerCapture(enabled: Boolean) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    runOnUi { activity ->
      if (enabled) {
        val view = captureView ?: CaptureView(activity) { onCapturedPointer(it) }.also {
          activity.addContentView(it, ViewGroup.LayoutParams(1, 1))
          captureView = it
        }
        view.requestFocus()
        view.requestPointerCapture()
        pointerCaptured = true
      } else {
        captureView?.releasePointerCapture()
        pointerCaptured = false
      }
    }
  }

  // ---- chạm giả cho con trỏ điều khiển UI bằng tay cầm ----

  private fun injectTouch(action: String, x: Float, y: Float) {
    runOnUi { activity ->
      val now = SystemClock.uptimeMillis()
      val motionAction = when (action) {
        "down" -> { touchDownTime = now; MotionEvent.ACTION_DOWN }
        "move" -> MotionEvent.ACTION_MOVE
        "cancel" -> MotionEvent.ACTION_CANCEL
        else -> MotionEvent.ACTION_UP
      }
      val event = MotionEvent.obtain(if (touchDownTime == 0L) now else touchDownTime, now, motionAction, x, y, 0)
      event.source = InputDevice.SOURCE_TOUCHSCREEN
      try {
        activity.window.decorView.dispatchTouchEvent(event)
      } finally {
        event.recycle()
      }
    }
  }

  // ---- rung ----

  private fun vibratorFor(deviceId: Int): Vibrator? {
    val device = InputDevice.getDevice(deviceId) ?: return null
    return try {
      val vibrator = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        device.vibratorManager.defaultVibrator
      } else {
        @Suppress("DEPRECATION")
        device.vibrator
      }
      if (vibrator.hasVibrator()) vibrator else null
    } catch (_: Throwable) {
      null
    }
  }

  private fun rumble(deviceId: Int, low: Float, high: Float, durationMs: Int) {
    val vibrator = vibratorFor(deviceId) ?: return
    val strength = maxOf(low, high).coerceIn(0f, 1f)
    if (strength <= 0.01f) {
      vibrator.cancel()
      return
    }
    val amplitude = (strength * 255f).toInt().coerceIn(1, 255)
    vibrator.vibrate(VibrationEffect.createOneShot(durationMs.toLong().coerceIn(20, 2000), amplitude))
  }

  private fun stopRumble(deviceId: Int) {
    vibratorFor(deviceId)?.cancel()
  }

  // ---- hệ thống ----

  private fun applyImmersive(activity: Activity, enabled: Boolean) {
    val window: Window = activity.window
    WindowCompat.setDecorFitsSystemWindows(window, !enabled)
    val controller = WindowInsetsControllerCompat(window, window.decorView)
    if (enabled) {
      controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
      controller.hide(WindowInsetsCompat.Type.systemBars())
    } else {
      controller.show(WindowInsetsCompat.Type.systemBars())
    }
  }

  private fun openSettings(action: String) {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    val intent = Intent(action).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
    context.startActivity(intent)
  }

  /**
   * WebRTC dùng route âm thanh kiểu cuộc gọi trên Android; không ép ra loa thì
   * tiếng game nhỏ và chui vào loa thoại. Port từ AudioRouteModule của jetson-phone.
   */
  private fun startSpeakerRoute() {
    val audio = audioManager ?: return
    if (previousAudioMode == null) previousAudioMode = audio.mode
    if (previousSpeakerphone == null) previousSpeakerphone = @Suppress("DEPRECATION") audio.isSpeakerphoneOn
    audio.mode = AudioManager.MODE_IN_COMMUNICATION
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      // Có tai nghe Bluetooth thì để hệ thống chọn tai nghe; chỉ ép loa khi không có.
      val external = audio.availableCommunicationDevices.firstOrNull {
        it.type == AudioDeviceInfo.TYPE_BLUETOOTH_SCO ||
          it.type == AudioDeviceInfo.TYPE_BLE_HEADSET ||
          it.type == AudioDeviceInfo.TYPE_WIRED_HEADSET ||
          it.type == AudioDeviceInfo.TYPE_USB_HEADSET
      }
      val target = external ?: audio.availableCommunicationDevices.firstOrNull { it.type == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER }
      if (target != null) audio.setCommunicationDevice(target)
    } else {
      @Suppress("DEPRECATION")
      audio.isSpeakerphoneOn = true
    }
  }

  private fun stopSpeakerRoute() {
    val audio = audioManager ?: return
    if (previousAudioMode == null) return
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
      audio.clearCommunicationDevice()
    } else {
      @Suppress("DEPRECATION")
      previousSpeakerphone?.let { audio.isSpeakerphoneOn = it }
    }
    previousAudioMode?.let { audio.mode = it }
    previousAudioMode = null
    previousSpeakerphone = null
  }

  companion object {
    private const val MODE_OFF = "off"
    private const val MODE_UI = "ui"
    private const val MODE_STREAM = "stream"
    private const val MIN_AXIS_INTERVAL_MS = 8L

    // Bit buttonState của Android -> số nút của Moonlight.
    private val BUTTON_MAP = listOf(
      MotionEvent.BUTTON_PRIMARY to 1,
      MotionEvent.BUTTON_TERTIARY to 2,
      MotionEvent.BUTTON_SECONDARY to 3,
      MotionEvent.BUTTON_BACK to 4,
      MotionEvent.BUTTON_FORWARD to 5,
    )
  }
}
