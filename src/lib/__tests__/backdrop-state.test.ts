import assert from 'node:assert/strict';
import { test } from 'node:test';
import { failBackdrop, finishBackdrop, requestBackdrop } from '../backdrop-state.ts';

const arc = finishBackdrop(requestBackdrop(null, 'arc-hero', 'arc-cover'), 'arc-hero');

test('missing Zoo hero removes ARC and tries the Zoo cover', () => {
  const zoo = requestBackdrop(arc, 'zoo-hero', 'zoo-cover');
  assert.equal(zoo.current, 'arc-hero'); // Keep the normal crossfade while loading.
  const fallback = failBackdrop(zoo, 'zoo-hero');
  assert.equal(fallback.current, null);
  assert.equal(fallback.pending, 'zoo-cover');
  assert.equal(finishBackdrop(fallback, 'zoo-cover').current, 'zoo-cover');
});

test('failed cover leaves the default background instead of restoring ARC', () => {
  const zoo = requestBackdrop(arc, 'zoo-hero', 'zoo-cover');
  const empty = failBackdrop(failBackdrop(zoo, 'zoo-hero'), 'zoo-cover');
  assert.equal(empty.current, null);
  assert.equal(empty.pending, null);
  assert.equal(requestBackdrop(empty, 'zoo-hero', 'zoo-cover'), empty);
});

test('missing or duplicate fallback stops after the hero fails', () => {
  for (const fallback of [null, 'zoo-hero']) {
    const empty = failBackdrop(requestBackdrop(arc, 'zoo-hero', fallback), 'zoo-hero');
    assert.equal(empty.current, null);
    assert.equal(empty.pending, null);
  }
});

test('switching games ignores late failure and animation completion from Zoo', () => {
  const zoo = failBackdrop(requestBackdrop(arc, 'zoo-hero', 'zoo-cover'), 'zoo-hero');
  const next = requestBackdrop(zoo, 'next-hero', 'next-cover');
  assert.equal(failBackdrop(next, 'zoo-cover'), next);
  assert.equal(finishBackdrop(next, 'zoo-cover'), next);
  assert.equal(finishBackdrop(next, 'next-hero').current, 'next-hero');
});

test('a new selection can load after all previous artwork failed', () => {
  const empty = failBackdrop(requestBackdrop(arc, 'zoo-hero', null), 'zoo-hero');
  const next = requestBackdrop(empty, 'arc-hero', 'arc-cover');
  assert.equal(next.pending, 'arc-hero');
  assert.equal(finishBackdrop(next, 'arc-hero').current, 'arc-hero');
});

test('the selected cover appears before a slow hero without cancelling its load', () => {
  const zoo = requestBackdrop(arc, 'zoo-hero', 'zoo-cover');
  const preview = finishBackdrop(zoo, 'zoo-cover');
  assert.equal(preview.current, 'zoo-cover');
  assert.equal(preview.pending, 'zoo-hero');
  const hero = finishBackdrop(preview, 'zoo-hero');
  assert.equal(hero.current, 'zoo-hero');
  assert.equal(hero.pending, null);
  assert.equal(finishBackdrop(hero, 'zoo-cover'), hero);
});

test('a missing hero keeps its already visible cover without flashing the default', () => {
  const preview = finishBackdrop(requestBackdrop(arc, 'zoo-hero', 'zoo-cover'), 'zoo-cover');
  const failed = failBackdrop(preview, 'zoo-hero');
  assert.equal(failed.current, 'zoo-cover');
  assert.equal(failed.pending, null);
});

test('failed preview does not interrupt the hero and is not retried after hero failure', () => {
  const zoo = requestBackdrop(arc, 'zoo-hero', 'zoo-cover');
  const failed = failBackdrop(zoo, 'zoo-cover');
  assert.equal(failed.pending, 'zoo-hero');
  assert.equal(failed.current, 'arc-hero');
  const empty = failBackdrop(failed, 'zoo-hero');
  assert.equal(empty.pending, null);
  assert.equal(empty.current, null);
});

test('a cover finishing after another game is selected cannot replace that game', () => {
  const zoo = requestBackdrop(arc, 'zoo-hero', 'zoo-cover');
  const next = requestBackdrop(zoo, 'next-hero', 'next-cover');
  assert.equal(finishBackdrop(next, 'zoo-cover'), next);
});
