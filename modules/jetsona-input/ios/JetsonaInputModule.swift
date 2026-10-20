import ExpoModulesCore
import GameController
import CoreHaptics
import AVFoundation
import UIKit

public final class JetsonaInputModule: Module {
  private var observers: [NSObjectProtocol] = []
  private var controllers: [Int: GCController] = [:]
  private var mice: [Int: GCMouse] = [:]
  private var ids: [ObjectIdentifier: Int] = [:]
  private var nextID = 1
  private var mode = "ui"
  private var foreground = true
  private var heldKeys: Set<Int> = []
  private var heldMouse: [Int: Set<Int>] = [:]
  private var buttonStates: [Int: [String: Bool]] = [:]
  private var engines: [Int: CHHapticEngine] = [:]
  private var players: [Int: any CHHapticPatternPlayer] = [:]
  private var speakerOverridden = false
  // iOS posts no notification when a controller's battery changes, and it often
  // reads the level only some time after connect. Re-check while the app is open.
  private var batteryTimer: Timer?
  private var reportedBatteries: [Int: Float] = [:]

  // Game Controller and UIKit are always accessed on the main queue, including
  // synchronous JS getters. Input callbacks run on that same queue.
  private func main<T>(_ work: () -> T) -> T {
    if Thread.isMainThread { return work() }
    return DispatchQueue.main.sync(execute: work)
  }

  public func definition() -> ModuleDefinition {
    Name("JetsonaInput")
    Events("onDevicesChanged", "onBluetoothChanged", "onGamepadState",
           "onGamepadButton", "onGuideKey", "onKey", "onMouse")
    OnCreate { self.main { self.attach() } }
    OnDestroy { self.main { self.detach() } }
    OnAppEntersBackground {
      self.main {
        self.releaseInput()
        self.foreground = false
        JetsonaInputViewController.appActive = false
        JetsonaInputViewController.current?.updateInputPolicy()
      }
    }
    OnAppEntersForeground {
      self.main {
        self.foreground = true
        JetsonaInputViewController.appActive = true
        JetsonaInputViewController.current?.updateInputPolicy()
        self.refreshDevices()
      }
    }
    Function("getDevices") {
      self.main {
        // Reconcile with iOS even if a connect notification was missed. Avoid
        // emitting a devices event from a synchronous getter (JS may re-enter).
        self.refreshDevices(notify: false)
        return self.devices()
      }
    }
    Function("getBluetooth") { self.bluetoothInfo() }
    Function("setCaptureMode") { (mode: String) in
      self.main {
        self.releaseInput()
        self.mode = ["off", "ui", "stream"].contains(mode) ? mode : "off"
        JetsonaInputViewController.captureMode = self.mode
        JetsonaInputViewController.current?.updateInputPolicy()
      }
    }
    Function("setPointerCapture") { (enabled: Bool) in
      self.main {
        JetsonaInputViewController.pointerRequested = enabled
        JetsonaInputViewController.current?.updateInputPolicy()
      }
    }
    Function("setImmersive") { (_: Bool) in }
    Function("setStreamFrameRate") { (_: Double) in }
    Function("rumble") { (id: Int, low: Double, high: Double, duration: Int) in
      self.main { self.rumble(id, low: low, high: high, duration: duration) }
    }
    Function("stopRumble") { (id: Int) in self.main { self.stopRumble(id) } }
    Function("openBluetoothSettings") { self.main { self.openSettings() } }
    Function("openWifiSettings") { self.main { self.openSettings() } }
    Function("startSpeakerRoute") {
      self.main {
        let audio = AVAudioSession.sharedInstance()
        // Preserve Bluetooth/wired headphones. WebRTC manages category/activation.
        if audio.currentRoute.outputs.contains(where: { $0.portType == .builtInReceiver }) {
          do { try audio.overrideOutputAudioPort(.speaker); self.speakerOverridden = true } catch {}
        }
      }
    }
    Function("stopSpeakerRoute") {
      self.main {
        if self.speakerOverridden {
          try? AVAudioSession.sharedInstance().overrideOutputAudioPort(.none)
          self.speakerOverridden = false
        }
      }
    }
    Function("describeDevice") { (_: Int) -> [String: Any]? in nil }
    Function("getDisplayInfo") { self.main { self.displayInfo() } }
    // UIKit screenshots do not reliably include RTC Metal video surfaces.
    AsyncFunction("grabFrame") { () -> Bool in false }
    AsyncFunction("exportFrame") { (_: Int) -> String? in nil }
    Function("releaseFrame") {}
  }

  private func id(_ object: AnyObject) -> Int {
    let key = ObjectIdentifier(object)
    if let existing = ids[key] { return existing }
    let result = nextID
    nextID += 1
    ids[key] = result
    return result
  }

  private func attach() {
    guard observers.isEmpty else { return }
    foreground = UIApplication.shared.applicationState == .active
    JetsonaInputViewController.appActive = foreground
    for name in [Notification.Name.GCControllerDidConnect, .GCControllerDidDisconnect,
                 .GCKeyboardDidConnect, .GCKeyboardDidDisconnect,
                 .GCMouseDidConnect, .GCMouseDidDisconnect,
                 AVAudioSession.routeChangeNotification] {
      observers.append(NotificationCenter.default.addObserver(forName: name, object: nil, queue: .main) { [weak self] _ in
        self?.refreshDevices()
      })
    }
    batteryTimer = Timer.scheduledTimer(withTimeInterval: 30, repeats: true) { [weak self] _ in
      self?.checkBatteries()
    }
    refreshDevices()
  }

  /// -1 while iOS doesn't know the level: in the `.unknown` state `batteryLevel`
  /// is a placeholder (often 1.0), which showed up as a fake 100%.
  private func batteryLevel(_ controller: GCController) -> Float {
    guard let battery = controller.battery, battery.batteryState != .unknown else { return -1 }
    return battery.batteryLevel
  }

  private func checkBatteries() {
    guard foreground, !controllers.isEmpty else { return }
    if controllers.mapValues(batteryLevel) != reportedBatteries {
      sendEvent("onDevicesChanged", ["devices": devices()])
    }
  }

  private func refreshDevices(notify: Bool = true) {
    let currentControllers = GCController.controllers().filter { $0.extendedGamepad != nil }
    let currentMice = GCMouse.mice()
    let controllerIDs = Set(currentControllers.map { id($0) })
    let mouseIDs = Set(currentMice.map { id($0) })
    for key in Array(controllers.keys) where !controllerIDs.contains(key) {
      neutralController(key)
      unbind(controllers[key])
      stopRumble(key)
      engines.removeValue(forKey: key)?.stop(completionHandler: nil)
      controllers.removeValue(forKey: key)
      buttonStates.removeValue(forKey: key)
    }
    for key in Array(mice.keys) where !mouseIDs.contains(key) {
      releaseMouse(key)
      unbind(mice[key])
      mice.removeValue(forKey: key)
    }
    for controller in currentControllers {
      let key = id(controller)
      guard controllers[key] == nil else { continue }
      controllers[key] = controller
      controller.handlerQueue = .main
      controller.extendedGamepad?.valueChangedHandler = { [weak self, weak controller] _, _ in
        guard let self, let controller, self.foreground, self.mode != "off" else { return }
        self.emitController(controller, id: key)
      }
    }
    if let keyboard = GCKeyboard.coalesced {
      keyboard.handlerQueue = .main
      keyboard.keyboardInput?.keyChangedHandler = { [weak self] _, _, key, down in
        guard let self, self.foreground, self.mode == "stream" else { return }
        self.keyChanged(Int(key.rawValue), down: down)
      }
    } else {
      releaseKeys()
    }
    for mouse in currentMice {
      let key = id(mouse)
      guard mice[key] == nil else { continue }
      mice[key] = mouse
      bindMouse(mouse, id: key)
    }
    let connectedObjects = Set(currentControllers.map(ObjectIdentifier.init)
      + currentMice.map(ObjectIdentifier.init))
    ids = ids.filter { connectedObjects.contains($0.key) }
    if notify {
      sendEvent("onDevicesChanged", ["devices": devices()])
      sendEvent("onBluetoothChanged", bluetoothInfo())
    }
  }

  private func emitController(_ controller: GCController, id: Int) {
    guard let pad = controller.extendedGamepad else { return }
    let buttons: [(String, GCControllerButtonInput?, Int)] = [
      ("up", pad.dpad.up, 0x0001), ("down", pad.dpad.down, 0x0002),
      ("left", pad.dpad.left, 0x0004), ("right", pad.dpad.right, 0x0008),
      ("start", pad.buttonMenu, 0x0010), ("select", pad.buttonOptions, 0x0020),
      ("l3", pad.leftThumbstickButton, 0x0040), ("r3", pad.rightThumbstickButton, 0x0080),
      ("lb", pad.leftShoulder, 0x0100), ("rb", pad.rightShoulder, 0x0200),
      ("guide", pad.buttonHome, 0x0400), ("a", pad.buttonA, 0x1000),
      ("b", pad.buttonB, 0x2000), ("x", pad.buttonX, 0x4000), ("y", pad.buttonY, 0x8000),
      ("lt", pad.leftTrigger, 0), ("rt", pad.rightTrigger, 0)
    ]
    var mask = 0
    var states = buttonStates[id] ?? [:]
    for (name, input, flag) in buttons {
      let down = input?.isPressed ?? false
      if down { mask |= flag }
      if down != (states[name] ?? false) {
        sendEvent("onGamepadButton", ["deviceId": id, "button": name, "down": down])
        if name == "guide" { sendEvent("onGuideKey", ["down": down]) }
      }
      states[name] = down
    }
    buttonStates[id] = states
    sendEvent("onGamepadState", ["deviceId": id, "buttons": mask,
      "lt": pad.leftTrigger.value, "rt": pad.rightTrigger.value,
      "lx": pad.leftThumbstick.xAxis.value, "ly": -pad.leftThumbstick.yAxis.value,
      "rx": pad.rightThumbstick.xAxis.value, "ry": -pad.rightThumbstick.yAxis.value])
  }

  private func keyChanged(_ hid: Int, down: Bool) {
    guard let codes = KeyboardMap.codes(hid) else { return }
    if down { heldKeys.insert(hid) } else { heldKeys.remove(hid) }
    sendEvent("onKey", ["deviceId": 0, "keyCode": codes.key, "vk": codes.vk,
                        "down": down, "modifiers": KeyboardMap.modifiers(heldKeys)])
  }

  private func bindMouse(_ mouse: GCMouse, id: Int) {
    mouse.handlerQueue = .main
    guard let input = mouse.mouseInput else { return }
    input.mouseMovedHandler = { [weak self] _, x, y in
      guard let self, self.foreground, self.mode == "stream" else { return }
      self.sendEvent("onMouse", ["type": "move", "dx": x, "dy": -y])
    }
    input.scroll.valueChangedHandler = { [weak self] _, x, y in
      guard let self, self.foreground, self.mode == "stream" else { return }
      self.sendEvent("onMouse", ["type": "wheel", "dx": x, "dy": y])
    }
    let buttons: [(Int, GCControllerButtonInput?)] = [
      (1, input.leftButton), (2, input.middleButton), (3, input.rightButton)
    ] + (input.auxiliaryButtons ?? []).prefix(2).enumerated().map { ($0.offset + 4, Optional($0.element)) }
    for (button, input) in buttons {
      input?.pressedChangedHandler = { [weak self] _, _, down in
        guard let self, self.foreground, self.mode == "stream" else { return }
        if down { self.heldMouse[id, default: []].insert(button) }
        else { self.heldMouse[id]?.remove(button) }
        self.sendEvent("onMouse", ["type": "button", "button": button, "down": down])
      }
    }
  }

  private func neutralController(_ id: Int) {
    for (name, down) in buttonStates[id] ?? [:] where down {
      sendEvent("onGamepadButton", ["deviceId": id, "button": name, "down": false])
      if name == "guide" { sendEvent("onGuideKey", ["down": false]) }
    }
    buttonStates[id] = [:]
    sendEvent("onGamepadState", ["deviceId": id, "buttons": 0,
      "lt": 0, "rt": 0, "lx": 0, "ly": 0, "rx": 0, "ry": 0])
  }

  private func releaseKeys() {
    for hid in Array(heldKeys) { keyChanged(hid, down: false) }
  }

  private func releaseMouse(_ id: Int) {
    for button in heldMouse.removeValue(forKey: id) ?? [] {
      sendEvent("onMouse", ["type": "button", "button": button, "down": false])
    }
  }

  private func releaseInput() {
    releaseKeys()
    for id in mice.keys { releaseMouse(id) }
    for id in controllers.keys { neutralController(id); stopRumble(id) }
  }

  private func unbind(_ controller: GCController?) {
    controller?.extendedGamepad?.valueChangedHandler = nil
  }

  private func unbind(_ mouse: GCMouse?) {
    guard let input = mouse?.mouseInput else { return }
    input.mouseMovedHandler = nil
    input.scroll.valueChangedHandler = nil
    input.leftButton.pressedChangedHandler = nil
    input.rightButton?.pressedChangedHandler = nil
    input.middleButton?.pressedChangedHandler = nil
    for button in input.auxiliaryButtons ?? [] { button.pressedChangedHandler = nil }
  }

  private func detach() {
    releaseInput()
    JetsonaInputViewController.captureMode = "off"
    JetsonaInputViewController.pointerRequested = false
    JetsonaInputViewController.current?.updateInputPolicy()
    observers.forEach(NotificationCenter.default.removeObserver)
    observers.removeAll()
    batteryTimer?.invalidate()
    batteryTimer = nil
    reportedBatteries.removeAll()
    controllers.values.forEach { unbind($0) }
    mice.values.forEach { unbind($0) }
    GCKeyboard.coalesced?.keyboardInput?.keyChangedHandler = nil
    engines.values.forEach { $0.stop(completionHandler: nil) }
    engines.removeAll()
    controllers.removeAll()
    mice.removeAll()
    ids.removeAll()
  }

  private func devices() -> [[String: Any]] {
    reportedBatteries = controllers.mapValues(batteryLevel)
    var result: [[String: Any]] = controllers.keys.sorted().compactMap { id in
      guard let controller = controllers[id] else { return nil }
      return device(id, name: controller.vendorName ?? "Game controller", kind: "controller",
        source: "gamepad", battery: reportedBatteries[id] ?? -1,
        rumble: controller.haptics != nil)
    }
    if let keyboard = GCKeyboard.coalesced {
      result.append(device(0, name: keyboard.vendorName ?? "Keyboard", kind: "keyboard", source: "keyboard"))
    }
    for id in mice.keys.sorted() {
      result.append(device(id, name: mice[id]?.vendorName ?? "Mouse", kind: "mouse", source: "mouse"))
    }
    for output in AVAudioSession.sharedInstance().currentRoute.outputs {
      if [.bluetoothA2DP, .bluetoothHFP, .bluetoothLE, .headphones, .usbAudio].contains(output.portType) {
        let bluetooth = [.bluetoothA2DP, .bluetoothHFP, .bluetoothLE].contains(output.portType)
        result.append(["id": "audio:\(output.uid)", "nativeId": -1, "name": output.portName,
          "kind": "headset", "source": "audio", "vendorId": 0, "productId": 0,
          "bluetooth": bluetooth, "transport": bluetooth ? "bluetooth" : "usb",
          "battery": -1, "rumble": false, "connected": true])
      }
    }
    return result
  }

  private func device(_ id: Int, name: String, kind: String, source: String,
                      battery: Float = -1, rumble: Bool = false) -> [String: Any] {
    // Game Controller doesn't expose Bluetooth-vs-USB transport for HID devices.
    return ["id": "input:\(id)", "nativeId": id, "name": name, "kind": kind,
      "source": source, "vendorId": 0, "productId": 0, "bluetooth": false,
      "transport": "unknown", "battery": battery, "rumble": rumble, "connected": true]
  }

  private func bluetoothInfo() -> [String: Any] {
    // iOS doesn't expose the global paired-device list or radio state through
    // Game Controller. Pair in system Settings; input requires no BLE scan.
    return ["supported": true, "enabled": false, "permitted": true,
            "stateKnown": false, "bonded": [] as [[String: Any]]]
  }

  private func displayInfo() -> [String: Any] {
    let window = appContext?.utilities?.currentViewController()?.view.window
    let screen = window?.screen ?? UIScreen.main
    let bounds = screen.bounds
    let scale = screen.nativeScale
    let insets = window?.safeAreaInsets ?? .zero
    let hz = screen.maximumFramesPerSecond
    return ["refreshRate": hz, "supportedRefreshRates": [hz],
      "widthPx": bounds.width * scale, "heightPx": bounds.height * scale,
      "smallestScreenWidthDp": min(bounds.width, bounds.height),
      "insets": ["left": insets.left * scale, "top": insets.top * scale,
                 "right": insets.right * scale, "bottom": insets.bottom * scale]]
  }

  private func stopRumble(_ id: Int) {
    try? players.removeValue(forKey: id)?.stop(atTime: CHHapticTimeImmediate)
  }

  private func rumble(_ id: Int, low: Double, high: Double, duration: Int) {
    stopRumble(id)
    guard foreground, mode != "off", low.isFinite, high.isFinite,
          let haptics = controllers[id]?.haptics else { return }
    let intensity = Float(max(0, min(1, max(low, high))))
    guard intensity > 0, duration > 0 else { return }
    do {
      guard let engine = engines[id] ?? haptics.createEngine(withLocality: .default) else { return }
      engines[id] = engine
      try engine.start()
      let event = CHHapticEvent(eventType: .hapticContinuous, parameters: [
        CHHapticEventParameter(parameterID: .hapticIntensity, value: intensity),
        CHHapticEventParameter(parameterID: .hapticSharpness, value: Float(max(0, min(1, high))))
      ], relativeTime: 0, duration: min(5, Double(duration) / 1000))
      let player = try engine.makePlayer(with: CHHapticPattern(events: [event], parameters: []))
      players[id] = player
      try player.start(atTime: CHHapticTimeImmediate)
    } catch {
      engines.removeValue(forKey: id)?.stop(completionHandler: nil)
    }
  }

  private func openSettings() {
    guard let url = URL(string: UIApplication.openSettingsURLString) else { return }
    UIApplication.shared.open(url)
  }
}
