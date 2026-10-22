import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { OWNER, profile } from './key-mapping-fixture.ts';
import type { MappingProfile } from '../../features/key-mapping/model.ts';

const hooks = registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context); } });
const { MappingRepository, MAPPING_BUCKET } = await import('../../features/key-mapping/repository.ts');
hooks.deregister();
const image = { bytes: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]).buffer, mime: 'image/png' };

function fixture() {
  const rows = new Map<string, MappingProfile>(); const objects = new Map<string, unknown>();
  const state = { owner: OWNER, dbError: false, commitThenError: false, selectError: false, selectErrorCode: null as string | null, storageError: false, cleanupError: false, queries: 0, time: 0 };
  const calls: unknown[][] = [];
  const client = {
    auth: { getSession: async () => ({ data: { session: { user: { id: state.owner } } }, error: null }) },
    from(table: string) {
      assert.equal(table, 'key_mapping_profiles');
      state.queries++;
      let action = 'select'; let payload: MappingProfile; const filters = new Map<string, unknown>();
      const query = {
        select: (_columns: string) => query,
        eq: (key: string, value: unknown) => { filters.set(key, value); return query; },
        order: () => query,
        insert: (value: MappingProfile) => { action = 'insert'; payload = value; return query; },
        update: (value: MappingProfile) => { action = 'update'; payload = value; return query; },
        delete: () => { action = 'delete'; return query; },
        single: async () => execute(true),
        then: (resolve: Function, reject: Function) => Promise.resolve(execute(false)).then(resolve as never, reject as never),
      };
      function execute(single: boolean) {
        calls.push([action, Object.fromEntries(filters)]);
        if (action === 'select' && state.selectErrorCode) return { data: null, error: { code: state.selectErrorCode, message: "Could not find the table 'public.key_mapping_profiles' in the schema cache" } };
        if ((action === 'select' && state.selectError) || (action !== 'select' && state.dbError)) return { data: null, error: { message: 'database offline' } };
        let selected = [...rows.values()].filter(row => row.user_id === state.owner && [...filters].every(([key, value]) => (row as any)[key] === value));
        if (action === 'insert' || (action === 'update' && selected.length)) {
          if (payload.user_id !== state.owner || (action === 'insert' && rows.has(payload.id))) return { data: null, error: { message: 'RLS or duplicate identity' } };
          const row = { ...payload, created_at: selected[0]?.created_at ?? profile().created_at, updated_at: `2026-10-22T00:00:${String(++state.time).padStart(2, '0')}.000Z` };
          rows.set(row.id, row); selected = [row];
        }
        if (action === 'delete') selected.forEach(row => rows.delete(row.id));
        if (state.commitThenError && action !== 'select') return { data: null, error: { message: 'response lost' } };
        if (single && !selected.length) return { data: null, error: { code: 'PGRST116', message: 'no rows' } };
        return { data: single ? selected[0] : selected, error: null };
      }
      return query;
    },
    storage: { from(bucket: string) {
      assert.equal(bucket, MAPPING_BUCKET);
      return {
        upload: async (path: string, bytes: ArrayBuffer, options: unknown) => { calls.push(['upload', path, options]); if (state.storageError) return { error: { message: 'upload failed' } }; objects.set(path, bytes); return { error: null }; },
        remove: async (paths: string[]) => { calls.push(['remove', paths]); if (state.cleanupError) return { error: { message: 'remove failed' } }; paths.forEach(path => objects.delete(path)); return { error: null }; },
        createSignedUrl: async (path: string) => objects.has(path) ? { data: { signedUrl: `https://private.invalid/${path}?token=secret` }, error: null } : { data: null, error: { message: 'missing image' } },
        copy: async (source: string, path: string) => { if (!objects.has(source)) return { error: { message: 'missing source' } }; objects.set(path, objects.get(source)); return { error: null }; },
      };
    } },
  };
  const repository = new MappingRepository(client as never);
  return { rows, objects, state, calls, repository };
}

test('save uploads binary data, waits for Supabase, then lists and loads the same profile', async () => {
  const f = fixture();
  const saved = await f.repository.save(profile(), null, image, 'image');
  assert.equal(saved.profile.id, profile().id); assert.equal(saved.warning, null);
  assert.equal(f.objects.size, 1); assert.equal(f.rows.size, 1);
  assert.deepEqual((await f.repository.list(OWNER)).map(p => p.id), [profile().id]);
  const count = f.state.queries; await f.repository.list(OWNER); assert.equal(f.state.queries, count);
  assert.match(await f.repository.screenshotUrl(saved.profile), /token=secret/);
  assert.equal((await f.repository.load(OWNER, saved.profile.id)).name, profile().name);
});
test('rename preserves identity and stale-device edits fail without overwriting', async () => {
  const f = fixture(); const old = (await f.repository.save(profile(), null, image, 'first')).profile;
  const next = (await f.repository.save({ ...old, name: 'Renamed' }, old)).profile;
  assert.equal(next.id, old.id); assert.equal(next.name, 'Renamed'); assert.equal(f.objects.size, 1);
  await assert.rejects(() => f.repository.save({ ...old, name: 'Stale' }, old), /thiết bị khác/);
  assert.equal(f.rows.get(old.id)?.name, 'Renamed');
});
test('missing mapping schema reports server setup, invalidates cached rows and recovers after migration', async () => {
  for (const code of ['PGRST205', '42P01']) {
    const f = fixture();
    await f.repository.save(profile(), null, image, 'first');
    await f.repository.list(OWNER);
    f.state.selectErrorCode = code;
    await assert.rejects(() => f.repository.list(OWNER, true), /chưa sẵn sàng trên máy chủ/);
    // A failed refresh must not silently serve the old successful cache.
    await assert.rejects(() => f.repository.list(OWNER), /cập nhật dịch vụ rồi tải lại profile/);
    f.state.selectErrorCode = null;
    assert.equal((await f.repository.list(OWNER))[0].id, profile().id);
  }
});
test('unrelated load failures retain their diagnostic instead of claiming setup is missing', async () => {
  const f = fixture(); f.state.selectError = true;
  await assert.rejects(() => f.repository.list(OWNER), /Không tải được mapping: database offline/);
});
test('replacement removes the old screenshot only after the row is saved', async () => {
  const f = fixture(); const old = (await f.repository.save(profile(), null, image, 'first')).profile;
  const next = await f.repository.save(old, old, image, 'second');
  assert.equal(f.objects.has(old.screenshot_path), false); assert.equal(f.objects.has(next.profile.screenshot_path), true);
  const actions = f.calls.map(c => c[0]); assert.ok(actions.lastIndexOf('update') < actions.lastIndexOf('remove'));
});
test('failed upload never writes a database row; failed save compensates the upload', async () => {
  const f = fixture(); f.state.storageError = true;
  await assert.rejects(() => f.repository.save(profile(), null, image, 'first'), /tải ảnh/); assert.equal(f.rows.size, 0);
  f.state.storageError = false; f.state.dbError = true;
  await assert.rejects(() => f.repository.save(profile(), null, image, 'second'), /lưu được/); assert.equal(f.objects.size, 0);
});
test('ambiguous committed save never deletes a screenshot referenced by a profile', async () => {
  const f = fixture(); f.state.commitThenError = true;
  await assert.rejects(() => f.repository.save(profile(), null, image, 'first'), /response lost/);
  assert.equal(f.rows.size, 1); assert.equal(f.objects.size, 1); assert.equal(f.calls.some(c => c[0] === 'remove'), false);
});
test('unknown commit status retains the image, and surfaces the recovery action', async () => {
  const f = fixture(); f.state.dbError = true; f.state.selectError = true;
  await assert.rejects(() => f.repository.save(profile(), null, image, 'first'), /ảnh được giữ lại/); assert.equal(f.objects.size, 1);
});
test('private screenshot failures, invalid types and changed authentication are surfaced', async () => {
  const f = fixture(); await assert.rejects(() => f.repository.screenshotUrl(profile()), /Ảnh không còn/);
  await assert.rejects(() => f.repository.save(profile(), null, { ...image, mime: 'text/html' }, 'bad'), /10 MB/);
  f.state.owner = 'another-user';
  await assert.rejects(() => f.repository.list(OWNER), /đăng nhập/);
  await assert.rejects(() => f.repository.save(profile(), null, image, 'bad'), /đăng nhập/);
  assert.equal(f.objects.size, 0);
});
test('deletion removes the profile and its private object', async () => {
  const f = fixture(); const saved = (await f.repository.save(profile(), null, image, 'first')).profile;
  assert.equal(await f.repository.delete(saved), null); assert.equal(f.rows.size, 0); assert.equal(f.objects.size, 0);
});
test('duplication gives the row and screenshot their own identities', async () => {
  const f = fixture(); const saved = (await f.repository.save(profile(), null, image, 'first')).profile;
  const copied = await f.repository.duplicate(saved, '33333333-3333-4333-8333-333333333333', 'copy');
  assert.notEqual(copied.profile.id, saved.id); assert.notEqual(copied.profile.screenshot_path, saved.screenshot_path);
  assert.equal(f.rows.size, 2); assert.equal(f.objects.size, 2);
  await f.repository.delete(saved); assert.equal(f.objects.has(copied.profile.screenshot_path), true);
});
test('cleanup failures are explicit and do not masquerade as a failed database commit', async () => {
  const f = fixture(); const saved = (await f.repository.save(profile(), null, image, 'first')).profile;
  f.state.cleanupError = true;
  const result = await f.repository.save(saved, saved, image, 'second');
  assert.match(result.warning!, /ảnh cũ/); assert.equal(f.rows.get(saved.id)?.screenshot_path, result.profile.screenshot_path);
});
