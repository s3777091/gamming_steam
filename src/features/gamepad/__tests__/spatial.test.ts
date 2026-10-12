// Chạy: node --experimental-strip-types --test src/features/gamepad/__tests__/spatial.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { pickFirst, pickNearest, pickNeighbor, revealDelta, type Candidate, type Rect } from '../spatial.ts';

const box = (x: number, y: number, w = 100, h = 60): Rect => ({ x, y, w, h });
const named = (name: string, rect: Rect): Candidate<string> => ({ item: name, rect });

// Lưới 3x2:  a b c
//            d e f
const grid = [
  named('a', box(0, 0)), named('b', box(120, 0)), named('c', box(240, 0)),
  named('d', box(0, 80)), named('e', box(120, 80)), named('f', box(240, 80)),
];
const at = (name: string) => grid.find((cell) => cell.item === name)!.rect;
const others = (name: string) => grid.filter((cell) => cell.item !== name);

test('đi theo hàng và cột của lưới', () => {
  assert.equal(pickNeighbor(at('a'), others('a'), 'right'), 'b');
  assert.equal(pickNeighbor(at('e'), others('e'), 'right'), 'f');
  assert.equal(pickNeighbor(at('e'), others('e'), 'left'), 'd');
  assert.equal(pickNeighbor(at('b'), others('b'), 'down'), 'e');
  assert.equal(pickNeighbor(at('f'), others('f'), 'up'), 'c');
});

test('ở rìa thì không có ô kế tiếp', () => {
  assert.equal(pickNeighbor(at('a'), others('a'), 'left'), null);
  assert.equal(pickNeighbor(at('a'), others('a'), 'up'), null);
  assert.equal(pickNeighbor(at('f'), others('f'), 'right'), null);
  assert.equal(pickNeighbor(at('f'), others('f'), 'down'), null);
});

test('ưu tiên đi thẳng hàng hơn nhảy chéo sang ô gần hơn một chút', () => {
  const from = box(0, 100);
  const straight = named('straight', box(400, 100));
  const diagonal = named('diagonal', box(150, 300));
  assert.equal(pickNeighbor(from, [diagonal, straight], 'right'), 'straight');
});

test('thẻ lớn chồng lên nhiều ô: đi xuống vẫn chọn ô nằm dưới', () => {
  const hero = box(0, 0, 300, 100);
  const below = [named('left', box(0, 120)), named('right', box(200, 120))];
  assert.equal(pickNeighbor(hero, below, 'down'), 'left');
});

test('pickNearest chọn ô gần điểm nhất', () => {
  assert.equal(pickNearest({ x: 250, y: 90 }, grid), 'f');
  assert.equal(pickNearest({ x: 10, y: 10 }, grid), 'a');
});

test('pickFirst chọn ô trên cùng bên trái', () => {
  assert.equal(pickFirst([...grid].reverse()), 'a');
});

test('revealDelta: không cuộn khi đã nằm trong khung', () => {
  assert.equal(revealDelta(box(100, 100), box(0, 0, 400, 400), 'x', 16), 0);
});

test('revealDelta: cuộn tới khi ô nằm ngoài mép phải / mép trái', () => {
  assert.equal(revealDelta(box(380, 0), box(0, 0, 400, 400), 'x', 16), 380 + 100 - 400 + 16);
  assert.equal(revealDelta(box(-50, 0), box(0, 0, 400, 400), 'x', 16), -50 - 16);
});

test('revealDelta: phần tử lớn hơn khung thì căn đầu', () => {
  assert.equal(revealDelta(box(0, 500, 100, 900), box(0, 0, 400, 400), 'y', 16), 500 - 16);
});
