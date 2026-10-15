import assert from 'node:assert/strict';
import { test } from 'node:test';
import { LOADING_READY_HOLD_MS, reduceLoadingSequence } from '../loading-sequence.ts';

test('long loading cannot be ended by video events or an expired hold', () => {
  let stage = reduceLoadingSequence('loading', 'blocked');
  for (let cycle = 0; cycle < 20; cycle += 1) {
    stage = reduceLoadingSequence(stage, 'settled');
    stage = reduceLoadingSequence(stage, 'dissolve');
    stage = reduceLoadingSequence(stage, 'ended');
  }
  assert.equal(stage, 'loading');
});

test('readiness holds for two seconds before the opening and game reveal', () => {
  assert.equal(LOADING_READY_HOLD_MS, 2_000);
  const ready = reduceLoadingSequence('loading', 'ready');
  assert.equal(ready, 'settling');
  assert.equal(reduceLoadingSequence(ready, 'dissolve'), 'settling');
  assert.equal(reduceLoadingSequence(ready, 'ended'), 'settling');
  const opening = reduceLoadingSequence(ready, 'settled');
  assert.equal(opening, 'opening');
  const revealing = reduceLoadingSequence(opening, 'dissolve');
  assert.equal(revealing, 'revealing');
  assert.equal(reduceLoadingSequence(revealing, 'ended'), 'finished');
});

test('lost readiness or retry cancels every stage and ignores late video completion', () => {
  for (const stage of ['settling', 'opening', 'revealing', 'finished'] as const) {
    const reset = reduceLoadingSequence(stage, 'blocked');
    assert.equal(reset, 'loading');
    assert.equal(reduceLoadingSequence(reset, 'ended'), 'loading');
    assert.equal(reduceLoadingSequence(reset, 'ready'), 'settling');
  }
});

test('video failure can finish an opening but cannot bypass loading or the hold', () => {
  assert.equal(reduceLoadingSequence('opening', 'ended'), 'finished');
  assert.equal(reduceLoadingSequence('settling', 'ended'), 'settling');
  assert.equal(reduceLoadingSequence('loading', 'ended'), 'loading');
  assert.equal(reduceLoadingSequence('finished', 'ready'), 'finished');
});

test('reconnecting a running game skips the door opening and goes straight to the stream', () => {
  assert.equal(reduceLoadingSequence('loading', 'readyDirect'), 'finished');
  assert.equal(reduceLoadingSequence('settling', 'readyDirect'), 'finished');
  assert.equal(reduceLoadingSequence('opening', 'readyDirect'), 'opening');
  assert.equal(reduceLoadingSequence(reduceLoadingSequence('finished', 'blocked'), 'readyDirect'), 'finished');
});
