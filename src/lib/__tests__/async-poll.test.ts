import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startAsyncPoll } from '../async-poll.ts';

const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

test('new progress snapshots still wait for the next scheduled poll', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const snapshots: { progress: number }[] = [];
  const stop = startAsyncPoll(async () => {
    snapshots.push({ progress: snapshots.length + 1 });
  }, () => 2500);
  t.after(stop);
  await flush();
  assert.equal(snapshots.length, 1);
  for (let count = 1; count < 5; count++) {
    t.mock.timers.tick(2499);
    await flush();
    assert.equal(snapshots.length, count);
    t.mock.timers.tick(1);
    await flush();
    assert.equal(snapshots.length, count + 1);
  }
});

test('slow requests never overlap and stopping aborts the pending request', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let count = 0;
  let requestSignal: AbortSignal | undefined;
  let finish!: () => void;
  const stop = startAsyncPoll((signal) => {
    count++;
    requestSignal = signal;
    return new Promise<void>((resolve) => { finish = resolve; });
  }, () => 100);
  t.after(stop);
  t.mock.timers.tick(10_000);
  assert.equal(count, 1);
  stop();
  assert.equal(requestSignal?.aborted, true);
  finish();
  await flush();
  t.mock.timers.tick(10_000);
  assert.equal(count, 1);
});

test('failures retry and the next delay follows current activity', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let count = 0;
  let delay = 2500;
  const stop = startAsyncPoll(async () => {
    count++;
    if (count === 1) throw new Error('offline');
    delay = 8000;
  }, () => delay);
  t.after(stop);
  await flush();
  t.mock.timers.tick(2500);
  await flush();
  assert.equal(count, 2);
  t.mock.timers.tick(7999);
  await flush();
  assert.equal(count, 2);
  t.mock.timers.tick(1);
  await flush();
  assert.equal(count, 3);
});

test('stopping during the scheduled wait prevents further requests', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  let count = 0;
  const stop = startAsyncPoll(async () => { count++; }, () => 100);
  await flush();
  stop();
  t.mock.timers.tick(1000);
  await flush();
  assert.equal(count, 1);
});
