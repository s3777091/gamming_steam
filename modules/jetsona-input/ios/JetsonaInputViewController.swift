import GameController
import UIKit

// The app is a landscape console. Hosting React in GCEventViewController routes
// controller input to Game Controller instead of also activating UIKit controls.
public final class JetsonaInputViewController: GCEventViewController {
  static weak var current: JetsonaInputViewController?
  static var captureMode = "ui"
  static var pointerRequested = false
  static var appActive = true

  public override func viewDidLoad() {
    super.viewDidLoad()
    Self.current = self
    updateInputPolicy()
  }

  public override var supportedInterfaceOrientations: UIInterfaceOrientationMask { .landscape }
  public override var prefersStatusBarHidden: Bool { true }
  public override var prefersHomeIndicatorAutoHidden: Bool { Self.captureMode == "stream" }
  public override var prefersPointerLocked: Bool {
    Self.appActive && Self.captureMode == "stream" && Self.pointerRequested
  }

  func updateInputPolicy() {
    controllerUserInteractionEnabled = Self.captureMode == "off"
    setNeedsUpdateOfPrefersPointerLocked()
    setNeedsUpdateOfHomeIndicatorAutoHidden()
  }

  // Keep native text entry in menus; streaming keyboard input goes only to the
  // remote PC. iOS-reserved system shortcuts remain controlled by the OS.
  public override func pressesBegan(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    if Self.captureMode == "stream", presses.contains(where: { $0.key != nil }) { return }
    super.pressesBegan(presses, with: event)
  }

  public override func pressesEnded(_ presses: Set<UIPress>, with event: UIPressesEvent?) {
    if Self.captureMode == "stream", presses.contains(where: { $0.key != nil }) { return }
    super.pressesEnded(presses, with: event)
  }
}
