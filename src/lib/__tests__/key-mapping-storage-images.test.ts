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
const entry = { name: 'Game image.png', path: 'Images/Game image.png', isDir: false, size: 8, modified: 1 };
function fixture() {
  const calls: { path: string; init: RequestInit }[] = [];
  const state = { status: 200, ok: true, nodes: [] as unknown[], bytes: png, length: '8', reads: 0 };
  const modules: Record<string, unknown> = {
    './model': model,
    '@/lib/api': { apiRequest: async (path: string, init: RequestInit, read: Function) => {
      calls.push({ path, init });
      return read({ status: state.status, ok: state.status >= 200 && state.status < 300, headers: { get: () => state.length },
        json: async () => ({ ok: state.ok, nodes: state.nodes, error: state.ok ? undefined : 'Storage offline' }),
        arrayBuffer: async () => { state.reads++; return state.bytes; } });
    } },
  };
  const source = readFileSync(new URL('../../features/key-mapping/storage-images.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  runInNewContext(output, { exports, Uint8Array, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  return { ...exports, calls, state };
}
test('Storage browsing uses existing authenticated routes, preserves the selected backend, and filters immediate images/folders', async () => {
  const f = fixture();
  f.state.nodes = [entry, { ...entry, name: 'Folder', path: 'Images/Folder', isDir: true }, { ...entry, name: 'video.mp4' }, { ...entry, path: 'Other/image.png' }, { ...entry, path: 'Images/../secret.png' }, { ...entry, path: 'Images/Folder/deeper.png' }];
  const controller = new AbortController();
  for (const mode of ['cloud', 'local']) {
    const rows = await f.listStorageImages('Images', controller.signal, mode);
    assert.deepEqual(Array.from(rows, (r: any) => r.path), ['Images/Folder', entry.path]);
    const request = f.calls.at(-1)!; assert.match(request.path, new RegExp(`mode=${mode}`)); assert.equal(request.init.signal, controller.signal);
  }
});
test('Storage path traversal is rejected and missing folders remain empty', async () => {
  const f = fixture();
  await assert.rejects(() => f.listStorageImages('../private'));
  assert.equal(f.calls.length, 0);
  f.state.status = 404; assert.equal((await f.listStorageImages('Images')).length, 0);
});
test('Storage offline errors are surfaced for retry or selecting another source', async () => {
  const f = fixture(); f.state.ok = false;
  await assert.rejects(() => f.listStorageImages('Images'), /Storage offline/);
});
test('download verifies binary image data even when the Storage endpoint returns an octet-stream', async () => {
  const f = fixture(); const result = await f.readStorageImage(entry, undefined, 'cloud');
  assert.equal(result.mimeType, 'image/png'); assert.equal(result.bytes, png);
  assert.match(f.calls[0].path, /mode=cloud/); assert.match(f.calls[0].path, /Images%2FGame%20image.png/);
  f.state.bytes = new TextEncoder().encode('<html>error</html>').buffer;
  await assert.rejects(() => f.readStorageImage(entry), /PNG, JPEG/);
});
test('oversized files are refused before their body is downloaded', async () => {
  const f = fixture();
  await assert.rejects(() => f.readStorageImage({ ...entry, size: model.MAX_IMAGE_BYTES + 1 })); assert.equal(f.calls.length, 0);
  f.state.length = String(model.MAX_IMAGE_BYTES + 1);
  await assert.rejects(() => f.readStorageImage(entry), /10 MB/); assert.equal(f.state.reads, 0);
});
