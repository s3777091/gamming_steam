import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const require = createRequire(import.meta.url);

test('clean installs resolve the patched URI decoder from its root vendor package', () => {
  const manifest = require('../../../package.json');
  const lock = require('../../../package-lock.json');
  const decoder = lock.packages['node_modules/decode-uri-component'];
  assert.equal(lock.packages[''].dependencies['decode-uri-component'], manifest.dependencies['decode-uri-component']);
  assert.equal(manifest.overrides['decode-uri-component'], '$decode-uri-component');
  assert.equal(decoder.resolved, 'vendor/decode-uri-component');
  const vendorManifest = require(`../../../${decoder.resolved}/package.json`);
  assert.equal(lock.packages[decoder.resolved].version, vendorManifest.version);
});

test('Router query-string keeps its CommonJS API and decodes Vietnamese with the security override', () => {
  const fromRouter = createRequire(require.resolve('expo-router/package.json'));
  const query = fromRouter('query-string');
  const value = { game: 'Tiếng Việt', mode: 'stream', id: '7' };
  assert.deepEqual({ ...query.parse(query.stringify(value)) }, value);
  assert.equal(query.parse('id=1&id=2').id.length, 2);
  assert.equal(query.parse('bad=%E0%A4%A').bad, '%E0%A4%A');
});

test('patched URI decoding completes on long malformed input instead of exponential recursion', () => {
  // Run in a child with a deadline so a vulnerable decoder cannot hang the suite.
  const result = spawnSync(process.execPath, ['-e', `
    const assert = require('node:assert/strict');
    const { createRequire } = require('node:module');
    const fromQuery = createRequire(require.resolve('query-string'));
    const decode = fromQuery('decode-uri-component');
    const input = '%C0'.repeat(10000) + '%E2%82%AC';
    assert.equal(decode(input), '%C0'.repeat(10000) + '€');
    assert.equal(decode('%F0%9F%8E%AE'), '🎮');
    assert.throws(() => decode(null), TypeError);
  `], { cwd: process.cwd(), timeout: 5000, encoding: 'utf8' });
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
});

test('xcode still generates Apple project IDs after the scoped uuid upgrade', () => {
  const xcode = require('xcode');
  const project = xcode.project('unused.pbxproj');
  project.hash = { project: { objects: {} } };
  const ids = Array.from({ length: 100 }, () => project.generateUuid());
  assert.equal(new Set(ids).size, ids.length);
  for (const id of ids) assert.match(id, /^[A-F0-9]{24}$/);
});

test('mobile dependencies resolve one React version without traversing the parent web app', async () => {
  const { scanDependenciesRecursively } = require('expo-modules-autolinking/build/dependencies/resolution');
  const resolutions = await scanDependenciesRecursively(process.cwd());
  assert.equal(resolutions.react.version, require('react/package.json').version);
  assert.equal(resolutions.react.duplicates?.length ?? 0, 0);
  assert.equal(resolutions['react-dom'].version, resolutions.react.version);
});
