import assert from 'node:assert/strict';
import { test } from 'node:test';

import { GAME_BOOST_META, GAME_BOOST_MODES, parseGameBoostMode } from '../game-booster.ts';

test('unknown or missing stored values fall back to auto', () => {
  assert.equal(parseGameBoostMode(null), 'auto');
  assert.equal(parseGameBoostMode('turbo'), 'auto');
  for (const mode of GAME_BOOST_MODES) assert.equal(parseGameBoostMode(mode), mode);
});

test('each lower mode only does a subset of the mode above it', () => {
  const { high, balanced, low } = GAME_BOOST_META;
  for (const action of balanced.actions) assert.ok(high.actions.includes(action), action);
  for (const action of low.actions) assert.ok(balanced.actions.includes(action), action);
  assert.ok(!balanced.actions.includes('powerPlan'));
  assert.ok(!balanced.actions.includes('closeApps'));
});
