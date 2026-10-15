import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RefreshingResource } from '../refreshing-resource.ts';

test('fresh cache avoids requests; expiry refreshes while retaining stale content', async () => {
  let now = 0;
  const cache = new RefreshingResource<{ price: number }>(100, () => now);
  let requests = 0;
  const load = async () => ({ price: ++requests * 10 });
  const first = await cache.load(load);
  now = 99;
  assert.equal(await cache.load(load), first);
  assert.equal(requests, 1);
  now = 100;
  const refresh = cache.load(load);
  assert.equal(cache.peek(), first);
  assert.deepEqual(await refresh, { price: 20 });
  assert.equal(cache.remainingMs(), 100);
});

test('concurrent automatic and manual refreshes share a single request', async () => {
  const cache = new RefreshingResource<number>(100);
  let requests = 0;
  const load = async () => ++requests;
  const first = cache.load(load);
  assert.equal(cache.load(load, true), first);
  assert.equal(cache.load(load), first);
  await first;
  assert.equal(requests, 1);
  assert.equal(await cache.load(load, true), 2);
});

test('a failed refresh preserves old data and permits a retry', async () => {
  let now = 0;
  const cache = new RefreshingResource<number>(100, () => now);
  await cache.load(async () => 10);
  now = 100;
  await assert.rejects(cache.load(async () => { throw new Error('offline'); }), /offline/);
  assert.equal(cache.peek(), 10);
  assert.equal(cache.remainingMs(), 0);
  assert.equal(await cache.load(async () => 20), 20);
});

test('TTL begins at successful completion and cache reads never extend it', async () => {
  let now = 0;
  const cache = new RefreshingResource<number>(100, () => now);
  await cache.load(async () => { now = 50; return 1; });
  now = 149;
  assert.equal(await cache.load(async () => 2), 1);
  assert.equal(cache.remainingMs(), 1);
  now = 150;
  assert.equal(await cache.load(async () => 2), 2);
});
