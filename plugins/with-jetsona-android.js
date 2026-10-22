// Khai báo phần cứng mà app dùng nhưng không bắt buộc: máy không có Bluetooth
// hay không có tay cầm vẫn cài được. Không cần sửa MainActivity — module
// jetsona-input tự bọc Window.Callback của Activity để bắt phím/chuột/tay cầm.
const { withAndroidManifest, withAndroidStyles } = require('expo/config-plugins');

const OPTIONAL_FEATURES = [
  'android.hardware.bluetooth',
  'android.hardware.bluetooth_le',
  'android.hardware.gamepad',
  'android.hardware.touchscreen',
  'android.hardware.wifi',
];

module.exports = function withJetsonaAndroid(config) {
  config = withAndroidManifest(config, (mod) => {
    const manifest = mod.modResults.manifest;
    manifest['uses-feature'] ??= [];
    for (const name of OPTIONAL_FEATURES) {
      if (manifest['uses-feature'].some((item) => item.$['android:name'] === name)) continue;
      manifest['uses-feature'].push({ $: { 'android:name': name, 'android:required': 'false' } });
    }
    const app = manifest.application?.[0];
    // Android 16 bỏ qua khoá hướng ngang trên màn lớn (>=600dp, như Galaxy Tab S9) của
    // mọi ứng dụng trừ game: khai báo đúng thể loại để màn console luôn nằm ngang.
    if (app) app.$['android:appCategory'] = 'game';
    const activity = app?.activity?.find((item) => item.$['android:name'] === '.MainActivity');
    if (activity) {
      activity.$['android:screenOrientation'] = 'sensorLandscape';
      const changes = new Set(String(activity.$['android:configChanges'] ?? '').split('|').filter(Boolean));
      ['keyboard', 'keyboardHidden', 'navigation', 'orientation', 'screenSize', 'screenLayout', 'uiMode', 'smallestScreenSize']
        .forEach((value) => changes.add(value));
      activity.$['android:configChanges'] = Array.from(changes).join('|');
    }
    return mod;
  });

  config = withAndroidStyles(config, (mod) => {
    const styles = mod.modResults.resources?.style ?? [];
    const appTheme = styles.find((s) => s.$?.name === 'AppTheme');
    if (appTheme) {
      appTheme.item ??= [];
      const existing = appTheme.item.find((i) => i.$?.name === 'android:autofilledHighlight');
      if (existing) {
        existing._ = '@android:color/transparent';
      } else {
        appTheme.item.push({
          $: { name: 'android:autofilledHighlight' },
          _: '@android:color/transparent',
        });
      }
    }
    return mod;
  });

  return config;
};
