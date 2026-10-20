import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';

const require = createRequire(import.meta.url);
const { configureAppDelegate } = require('../../../plugins/with-jetsona-ios.js');

const template = `internal import Expo
import React
class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func bundleURL() -> URL? { return nil }
}`;

test('iOS input host survives native regeneration and repeated plugin application', () => {
  const result = configureAppDelegate(template);
  assert.match(result, /internal import JetsonaInput/);
  assert.match(result, /override func createRootViewController\(\)/);
  assert.match(result, /return JetsonaInputViewController\(\)/);
  assert.match(result, /override func bundleURL\(\)/);
  assert.equal(configureAppDelegate(result), result);
  assert.equal(configureAppDelegate(result.replace('internal import JetsonaInput', 'import JetsonaInput')), result);
});

test('iOS input plugin requires review if a future template changes the root controller', () => {
  assert.throws(() => configureAppDelegate('class DifferentDelegate {}'), /template changed/);
  assert.throws(() => configureAppDelegate(template.replace('override func bundleURL', 'override func createRootViewController')), /template changed/);
});
