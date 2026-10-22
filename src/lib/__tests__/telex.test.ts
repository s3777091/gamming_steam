// Chạy: node --experimental-strip-types --test src/lib/__tests__/telex.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { applyTelex, diffWord } from '../telex.ts';

const type = (keys: string) => Array.from(keys).reduce((word, key) => applyTelex(word, key), '');

test('gõ các từ thông dụng', () => {
  assert.equal(type('tieengs'), 'tiếng');
  assert.equal(type('vieetj'), 'việt');
  assert.equal(type('dduwowcj'), 'được');
  assert.equal(type('nguwowif'), 'người');
  assert.equal(type('xin'), 'xin');
  assert.equal(type('chaof'), 'chào');
  assert.equal(type('hoaf'), 'hòa');
  assert.equal(type('hoafn'), 'hoàn');
  assert.equal(type('quas'), 'quá');
  assert.equal(type('gif'), 'gì');
  assert.equal(type('giaf'), 'già');
  assert.equal(type('thuowng'), 'thương');
  assert.equal(type('w'), 'ư');
});

test('giữ chữ hoa và cho đặt dấu ở cuối từ', () => {
  assert.equal(type('Vieetj'), 'Việt');
  assert.equal(type('DDaau'), 'Đâu');
  assert.equal(type('vietej'), 'việt');
});

test('gõ lặp lại thì hoàn tác', () => {
  assert.equal(type('aaa'), 'aa');
  assert.equal(type('ass'), 'as');
  assert.equal(type('ddd'), 'dd');
  assert.equal(type('asz'), 'a');
});

test('diffWord chỉ gửi phần thay đổi', () => {
  assert.equal(JSON.stringify(diffWord('viet', 'việt')), JSON.stringify({ erase: 2, insert: 'ệt' }));
  assert.equal(JSON.stringify(diffWord('vie', 'vie')), JSON.stringify({ erase: 0, insert: '' }));
  assert.equal(JSON.stringify(diffWord('xi', 'xin')), JSON.stringify({ erase: 0, insert: 'n' }));
});
