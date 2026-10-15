import assert from 'node:assert/strict';
import { test } from 'node:test';
import { BackdropPreloader, nearbyBackdropUrls } from '../backdrop-preloader.ts';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('preloads only nearby cards, closest first, without duplicate requests', () => {
  assert.deepEqual(nearbyBackdropUrls(['a', 'b', 'c', 'd', 'e'], 2), ['d', 'b', 'e', 'a']);
  assert.deepEqual(nearbyBackdropUrls(['a', 'b', 'b', null], 0), ['b']);
});

test('fast navigation replaces queued work and limits concurrent downloads to two', async () => {
  const started: string[] = [];
  const pending = new Map<string, (ready: boolean) => void>();
  const loader = new BackdropPreloader((url) => {
    started.push(url);
    return new Promise((resolve) => pending.set(url, resolve));
  });
  const cancelOld = loader.schedule(['a', 'b', 'c', 'd']);
  assert.deepEqual(started, ['a', 'b']);
  const cancelNew = loader.schedule(['e', 'f']);
  cancelOld(); // An outgoing tab must not cancel the new tab's queue.
  pending.get('a')!(true);
  await flush();
  assert.deepEqual(started, ['a', 'b', 'e']);
  cancelNew();
  pending.get('b')!(true);
  pending.get('e')!(true);
  await flush();
  assert.deepEqual(started, ['a', 'b', 'e']);
});

test('revisiting cards reuses preloads and backs off failed downloads', async () => {
  let now = 1;
  const started: string[] = [];
  const loader = new BackdropPreloader(async (url) => {
    started.push(url);
    if (url === 'missing') throw new Error('404');
    return true;
  }, () => now);
  loader.schedule(['a', 'missing', 'a']);
  await flush();
  loader.schedule(['a', 'missing']);
  await flush();
  assert.deepEqual(started, ['a', 'missing']);
  now += 30_001;
  loader.schedule(['a', 'missing']);
  await flush();
  assert.deepEqual(started, ['a', 'missing', 'missing']);
});
