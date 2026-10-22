import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const hooks = registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context); } });
const model = await import('../../features/key-mapping/model.ts');
hooks.deregister();
const png = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer;
function fixture() {
  const files = new Map<string, ArrayBuffer>([['file:///gallery/user-photo.png', png]]);
  const state = { permissions: 0, pickCalls: 0, canceled: false, permissionDenied: false, decodeFails: false, released: 0, storageModes: [] as string[] };
  class File {
    uri: string;
    constructor(root: string | { uri: string }, name?: string) { const base = typeof root === 'string' ? root : root.uri; this.uri = name ? `${base}${name}` : base; }
    get exists() { return files.has(this.uri); }
    get size() { return files.get(this.uri)?.byteLength ?? 0; }
    get name() { return this.uri.split('/').at(-1)!; }
    get parentDirectory() { return { uri: this.uri.slice(0, this.uri.lastIndexOf('/')) }; }
    write(bytes: Uint8Array) { files.set(this.uri, bytes.slice().buffer); }
    delete() { files.delete(this.uri); }
    async arrayBuffer() { return files.get(this.uri)!; }
  }
  const modules: Record<string, unknown> = {
    './model': model,
    './photo-permissions': { ensurePhotoLibraryPermission: async () => { state.permissions++; if (state.permissionDenied) throw new Error('permission denied'); } },
    './storage-images': { readStorageImage: async (_entry: unknown, _signal: unknown, mode: string) => { state.storageModes.push(mode); return { bytes: png, mimeType: 'image/png' }; } },
    'expo-crypto': { randomUUID: () => '123' },
    'expo-file-system': { File, Paths: { cache: { uri: 'file:///cache/' } } },
    'expo-image': { Image: { loadAsync: async () => {
      if (state.decodeFails) throw new Error('invalid image');
      return { width: 960, height: 540, scale: 2, release: () => { state.released++; } };
    } } },
    'expo-image-picker': { launchImageLibraryAsync: async () => {
      state.pickCalls++;
      return state.canceled ? { canceled: true } : { canceled: false, assets: [{ uri: 'file:///gallery/user-photo.png', width: 1920, height: 1080, fileName: 'user-photo.png' }] };
    } },
  };
  const output = ts.transpileModule(readFileSync(new URL('../../features/key-mapping/screenshot-sources.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  runInNewContext(output, { exports, Uint8Array, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  return { ...exports, files, state };
}
const entry = { name: 'Screenshot.png', path: 'Images/Screenshot.png', isDir: false, size: 8, modified: 1 };
test('Storage images prepare an owned cache copy without asking for device-library permissions', async () => {
  const f = fixture(); const selected = await f.prepareStorageScreenshot(entry, undefined, 'local');
  assert.equal(f.state.permissions, 0); assert.equal(f.state.pickCalls, 0); assert.deepEqual(f.state.storageModes, ['local']);
  assert.equal(selected.width, 1920); assert.equal(selected.height, 1080); assert.equal(selected.origin, 'storage'); assert.equal(f.state.released, 1);
  assert.ok(f.files.has(selected.uri)); f.releaseStorageScreenshot(selected.uri); assert.equal(f.files.has(selected.uri), false);
  assert.ok(f.files.has('file:///gallery/user-photo.png'));
});
test('device-library selection checks permission before opening the picker and infers the returned image type', async () => {
  const f = fixture(); const selected = await f.pickDeviceScreenshot();
  assert.equal(f.state.permissions, 1); assert.equal(f.state.pickCalls, 1); assert.equal(selected.mimeType, 'image/png'); assert.equal(selected.origin, 'device');
  f.releaseStorageScreenshot(selected.uri); assert.ok(f.files.has(selected.uri));
});
test('denied permissions do not open the device library; cancellation does not replace the selected screenshot', async () => {
  const f = fixture(); f.state.permissionDenied = true;
  await assert.rejects(() => f.pickDeviceScreenshot(), /permission denied/); assert.equal(f.state.pickCalls, 0);
  f.state.permissionDenied = false; f.state.canceled = true; assert.equal(await f.pickDeviceScreenshot(), null);
  assert.equal(f.files.size, 1);
});
test('failed decoding and canceled Storage requests do not leave temporary files', async () => {
  const f = fixture(); f.state.decodeFails = true;
  await assert.rejects(() => f.prepareStorageScreenshot(entry), /invalid image/); assert.equal(f.files.size, 1);
  f.state.decodeFails = false;
  const controller = new AbortController(); controller.abort();
  await assert.rejects(() => f.prepareStorageScreenshot(entry, controller.signal), /hủy/); assert.equal(f.files.size, 1);
});
test('cache cleanup never deletes a device photo or another feature’s cache file', () => {
  const f = fixture(); f.files.set('file:///cache/other-feature.png', png); f.files.set('file:///gallery/mapping-source-user.png', png);
  for (const uri of [...f.files.keys()]) f.releaseStorageScreenshot(uri);
  assert.equal(f.files.size, 3);
});
