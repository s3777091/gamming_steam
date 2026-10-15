import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TimedCache } from '../timed-cache.ts';

test('revisiting a search keeps it cached while older results are evicted', () => {
  const cache = new TimedCache<string, number>(2, 1000);
  cache.set('portal', 1);
  cache.set('half life', 2);
  assert.equal(cache.get('portal'), 1);
  cache.set('doom', 3);
  assert.equal(cache.get('half life'), undefined);
  assert.equal(cache.get('portal'), 1);
  assert.equal(cache.get('doom'), 3);
});

test('expired search results are fetched again without extending expiry on reads', () => {
  let now = 0;
  const cache = new TimedCache<string, number>(2, 100, () => now);
  cache.set('portal', 1);
  now = 99;
  assert.equal(cache.get('portal'), 1);
  now = 100;
  assert.equal(cache.get('portal'), undefined);
});

test('refreshing a key replaces its result and renews its expiry', () => {
  let now = 0;
  const cache = new TimedCache<string, number>(1, 100, () => now);
  cache.set('portal', 1);
  now = 90;
  cache.set('portal', 2);
  now = 100;
  assert.equal(cache.get('portal'), 2);
  now = 190;
  assert.equal(cache.get('portal'), undefined);
});

test('resource refresh deadlines do not extend TTL and track replacements and eviction', () => {
  let now = 0;
  const cache = new TimedCache<number, string>(1, 60_000, () => now);
  assert.equal(cache.remainingMs(1), 0);
  cache.set(1, 'achievements');
  now = 20_000;
  assert.equal(cache.remainingMs(1), 40_000);
  assert.equal(cache.get(1), 'achievements');
  now = 60_000;
  assert.equal(cache.remainingMs(1), 0);
  assert.equal(cache.get(1), undefined);
  cache.set(1, 'refreshed achievements');
  now = 70_000;
  assert.equal(cache.remainingMs(1), 50_000);
  cache.set(2, 'another game');
  assert.equal(cache.remainingMs(1), 0);
});
