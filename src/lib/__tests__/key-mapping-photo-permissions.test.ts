import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function fixture(os: string, sdk = 34) {
  const full = 'android.permission.READ_MEDIA_IMAGES'; const selected = 'android.permission.READ_MEDIA_VISUAL_USER_SELECTED'; const legacy = 'android.permission.READ_EXTERNAL_STORAGE';
  const calls: unknown[][] = [];
  const state = {
    checked: new Set<string>(), results: {} as Record<string, string>,
    ios: { granted: false, accessPrivileges: 'none', canAskAgain: true },
    requested: { granted: true, accessPrivileges: 'all', canAskAgain: true },
  };
  const modules: Record<string, unknown> = {
    'react-native': {
      Platform: { OS: os, Version: sdk },
      PermissionsAndroid: {
        PERMISSIONS: { READ_MEDIA_IMAGES: full, READ_MEDIA_VISUAL_USER_SELECTED: selected, READ_EXTERNAL_STORAGE: legacy },
        RESULTS: { GRANTED: 'granted', DENIED: 'denied', NEVER_ASK_AGAIN: 'never_ask_again' },
        check: async (permission: string) => { calls.push(['check', permission]); return state.checked.has(permission); },
        requestMultiple: async (permissions: string[]) => { calls.push(['request', ...permissions]); return state.results; },
      },
    },
    'expo-image-picker': {
      getMediaLibraryPermissionsAsync: async (writeOnly: boolean) => { calls.push(['ios-get', writeOnly]); return state.ios; },
      requestMediaLibraryPermissionsAsync: async (writeOnly: boolean) => { calls.push(['ios-request', writeOnly]); return state.requested; },
    },
  };
  const output = ts.transpileModule(readFileSync(new URL('../../features/key-mapping/photo-permissions.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  runInNewContext(output, { exports, Promise, require: (name: string) => { assert.ok(name in modules); return modules[name]; } });
  return { ...exports, state, calls, full, selected, legacy };
}
test('Android 12 requests read-only legacy access; Android 13 requests images only', async () => {
  for (const sdk of [32, 33]) {
    const f = fixture('android', sdk); const permission = sdk === 32 ? f.legacy : f.full;
    f.state.results[permission] = 'granted'; await f.ensurePhotoLibraryPermission();
    assert.deepEqual(f.calls.filter(c => c[0] === 'request'), [['request', permission]]);
    assert.ok(f.calls.every(c => !c.join().includes('WRITE_EXTERNAL') && !c.join().includes('READ_MEDIA_VIDEO')));
  }
});
test('Android 14 accepts selected-photo access when whole-library access is denied', async () => {
  const f = fixture('android'); f.state.results = { [f.full]: 'denied', [f.selected]: 'granted' };
  await f.ensurePhotoLibraryPermission();
  assert.deepEqual(f.calls.filter(c => c[0] === 'request'), [['request', f.full, f.selected]]);
});
test('already granted full or selected Android access does not prompt again', async () => {
  for (const limited of [false, true]) {
    const f = fixture('android'); f.state.checked.add(limited ? f.selected : f.full);
    await f.ensurePhotoLibraryPermission(); assert.equal(f.calls.some(c => c[0] === 'request'), false);
  }
});
test('Android denial blocks library access and permanent denial exposes the Settings recovery', async () => {
  for (const blocked of [false, true]) {
    const f = fixture('android'); f.state.results = { [f.full]: blocked ? 'never_ask_again' : 'denied', [f.selected]: 'denied' };
    await assert.rejects(() => f.ensurePhotoLibraryPermission(), (e: any) => e.canOpenSettings === blocked);
  }
});
test('iOS requests read access on demand and respects an existing limited grant', async () => {
  const f = fixture('ios'); await f.ensurePhotoLibraryPermission();
  assert.deepEqual(f.calls, [['ios-get', false], ['ios-request', false]]);
  const limited = fixture('ios'); limited.state.ios = { granted: false, accessPrivileges: 'limited', canAskAgain: true };
  await limited.ensurePhotoLibraryPermission(); assert.equal(limited.calls.length, 1);
});
test('iOS permanent denial directs the user to Settings without another prompt', async () => {
  const f = fixture('ios'); f.state.ios.canAskAgain = false;
  await assert.rejects(() => f.ensurePhotoLibraryPermission(), (e: any) => e.canOpenSettings === true);
  assert.deepEqual(f.calls, [['ios-get', false]]);
});
test('Android declares image/selected-photo permissions and preserves the iOS usage description', () => {
  const config = JSON.parse(readFileSync(new URL('../../../app.json', import.meta.url), 'utf8')).expo;
  assert.ok(config.android.permissions.includes('android.permission.READ_MEDIA_IMAGES'));
  assert.ok(config.android.permissions.includes('android.permission.READ_MEDIA_VISUAL_USER_SELECTED'));
  const picker = config.plugins.find((entry: any) => Array.isArray(entry) && entry[0] === 'expo-image-picker');
  assert.ok(picker[1].photosPermission); assert.equal(picker[1].cameraPermission, false); assert.equal(picker[1].microphonePermission, false);
});
