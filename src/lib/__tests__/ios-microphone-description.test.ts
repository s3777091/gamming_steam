import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// WebRTC opens the microphone path when a stream starts; iOS kills an app that
// does so without NSMicrophoneUsageDescription. A plugin given
// `microphonePermission: false` deletes that key from Info.plist, so no plugin
// may disable it — this already broke streams twice (expo-audio, expo-image-picker).
const app = JSON.parse(readFileSync(new URL('../../../app.json', import.meta.url), 'utf8')).expo;

test('no config plugin removes the iOS microphone description', () => {
  for (const entry of app.plugins) {
    if (!Array.isArray(entry)) continue;
    const [name, options] = entry;
    assert.notEqual(options?.microphonePermission, false, `${name} must not set microphonePermission: false`);
  }
});

test('Android still never requests RECORD_AUDIO', () => {
  assert.ok(app.android.blockedPermissions.includes('android.permission.RECORD_AUDIO'));
  assert.ok(!app.android.permissions.includes('android.permission.RECORD_AUDIO'));
});
