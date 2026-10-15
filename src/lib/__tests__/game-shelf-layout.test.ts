import assert from 'node:assert/strict';
import { test } from 'node:test';
import { shelfItemLayout } from '../game-shelf-layout.ts';

const metrics = { idleWidth: 88, activeWidth: 288, gap: 12, dividerWidth: 1.5, padding: 10 };

test('virtual cell offsets remain contiguous as selection crosses the divider', () => {
  for (const selected of [0, 1, 99, 100, 101, 499]) {
    let expectedOffset = metrics.padding;
    for (let index = 0; index < 500; index++) {
      const cell = shelfItemLayout(index, selected, 100, metrics);
      assert.equal(cell.offset, expectedOffset);
      expectedOffset += cell.length;
    }
    assert.equal(expectedOffset, metrics.padding + 500 * 100 + 200 + 13.5);
  }
});

test('the first uninstalled card includes its leading divider', () => {
  const cell = shelfItemLayout(3, 3, 3, metrics);
  assert.equal(cell.offset, 310);
  assert.equal(cell.length, 313.5);
  assert.equal(cell.offset + metrics.dividerWidth + metrics.gap, 323.5);
});

test('a shelf containing just one group has no phantom divider space', () => {
  assert.deepEqual(shelfItemLayout(0, 0, null, metrics), { index: 0, offset: 10, length: 300 });
  assert.deepEqual(shelfItemLayout(1, 0, null, metrics), { index: 1, offset: 310, length: 100 });
});
