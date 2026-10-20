# iOS readiness — 2026-10-20

## Verified

- Lint and TypeScript checks pass; all 131 JavaScript tests pass, including dependency compatibility, malformed URI input, missing multipath and native plugin regeneration regressions.
- Release JavaScript/assets export for iOS succeeds. This is not a native build or a device test.
- Only the four used Inter fonts are included (previously 18), removing approximately 4.8 MB of uncompressed font assets.
- Startup continues if font loading fails. Failed region storage/session reads no longer leave rejected promises on those startup paths.
- Authentication token refresh pauses while backgrounded and resumes when active; the listener is removed on cleanup.
- Expo and Expo Router patch versions match SDK 57 recommendations.
- Config introspection succeeds without creating an ios directory.
- EAS iOS Simulator native build **finished successfully** on 2026-10-20: [build 3ada0169-4341-450f-b6a3-104ef5a1e18c](https://expo.dev/accounts/dathuynh_coolest/projects/jetsona-console/builds/3ada0169-4341-450f-b6a3-104ef5a1e18c). Xcode compiled JetsonaInput, its root controller, the generated app integration and WebRTC for simulator architectures and linked the app. The Swift keyboard mapping tests passed on the worker. This confirms compilation, not Bluetooth hardware behavior.
- [Download the Simulator application archive](https://expo.dev/artifacts/eas/ycTzM3kp2I7vKRTIerTKdC2ew01StLnC_r4bM6olzFQ.tar.gz). It contains a Simulator app for macOS, not a signed IPA for an iPhone.

## Build profiles

The existing Android preview profile is preserved. iOS uses remote signing credentials, separately from Android's local credentials.

```sh
# Development build for a registered iPhone/iPad
npx eas-cli@latest build --platform ios --profile ios-development

# Standalone internal build for registered devices
npx eas-cli@latest build --platform ios --profile ios-preview

# Simulator build (requires a Mac with Simulator to run)
npx eas-cli@latest build --platform ios --profile ios-simulator

# App Store / TestFlight build, submission is a separate step
npx eas-cli@latest build --platform ios --profile ios-production
```

An attempted non-interactive ios-preview build stopped during credential setup: no suitable internal-distribution iOS credentials exist on EAS. No IPA was produced. An Apple Developer account, signing certificate, provisioning profile, and registered device are needed for this internal-device build. Configure these interactively; do not commit signing secrets. EAS also reported that the encryption compliance declaration must be completed before testing through App Store Connect. Review actual encryption use before supplying that declaration.

## Hardware input

- Added the iOS JetsonaInput module using Apple's Game Controller framework. It enumerates connected supported controllers, a coalesced hardware keyboard and mice; forwards controller buttons/sticks/triggers, physical keyboard HID events and mouse movement/buttons/wheel through the existing event contract.
- Game Controller receives accessories already paired in iOS Settings, including Bluetooth accessories. No BLE scanning or private Bluetooth Settings URL is used. iOS does not expose the global paired HID list or reliable Bluetooth-vs-USB transport through this API; the UI reports unknown transport instead of incorrectly labelling Bluetooth accessories as USB.
- The generated Swift AppDelegate hosts React in GCEventViewController via `plugins/with-jetsona-ios.js`. The host keeps this console app landscape, requests pointer lock only during streaming and returns native keyboard handling to menus. UIKit may refuse pointer lock when system conditions are unmet. The fixed landscape host intentionally replaces Expo's default orientation root controller; dynamic portrait orientation is outside this app's scope.
- Controller haptics use Core Haptics where available. Release keys, mouse buttons, controller state and haptics on capture changes, disconnect and background. Bluetooth/wired audio routes are preserved rather than forced onto the speaker.
- Keyboard HID codes are translated to the existing Android-keycode/Windows-VK event contract, preserving remapping and left/right modifier identity. Swift mapping tests run automatically on macOS EAS iOS workers after dependency installation.
- Native video-frame capture remains unavailable on iOS; no placeholder screenshot is reported as a successful capture. System-reserved key combinations remain under iOS control.

## Remaining limitations

- `jetsona-multipath` remains Android-only. Bluetooth accessory support does not provide network multipath. The current WebRTC transport does not bond Wi-Fi/cellular on iOS; adding Apple's Multipath TCP entitlement would not make its UDP media multipath. The iOS UI now exposes the single system-selected network rather than fabricated dual-Wi-Fi data or simulated connection success.
- Verify WebRTC video/audio, speaker and Bluetooth routing, touch input, landscape safe areas and background/reconnect behavior on an actual iPhone and iPad. Exporting the bundle cannot validate these.
- Expo Doctor: 21/21 checks pass. The recursive peer graph previously found the parent web project's react-dom and therefore its React 19.0.0. Installing the SDK-compatible react-dom 19.2.3 locally removes that traversal; a regression test verifies no duplicate React resolution. The web project's dependencies and Doctor exclusions were not changed.
- npm audit reduced from 25 entries to 14 high entries; all 11 moderate entries were removed. Scoped xcode/uuid override uses 11.1.1; the URI decoder uses upstream 0.5.0's patched implementation with a CommonJS-only export conversion to preserve Expo Router SDK 57's query-string 7 API. Its source/license are in `vendor/decode-uri-component`; regression tests check both consumers.
- The remaining 14 audit entries propagate from two unpatched root advisories: [braces <=3.0.3](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and [node-forge <=1.4.0](https://github.com/advisories/GHSA-86w9-cpqp-85rv). At review time these are the latest published versions and the advisories list no patched release. These remain open, not suppressed. Do not use `npm audit fix --force`, which proposes incompatible Expo/RN downgrades. Assess exposure in developer/build tooling and update when upstream patches are published; do not describe this project as vulnerability-free.

References: [SDK 57](https://docs.expo.dev/versions/v57.0.0/), [iOS builds](https://docs.expo.dev/build-reference/ios-builds/), [EAS profiles](https://docs.expo.dev/eas/json/).
