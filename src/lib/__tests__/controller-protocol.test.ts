// Đối chiếu bộ mã hoá gói tay cầm với đúng cách streamer của moonlight-web v2.10
// đọc chúng (streamer/src/transport/mod.rs, ByteBuffer big-endian).
// Chạy: node --experimental-strip-types --test src/lib/__tests__/controller-protocol.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import {
  decodeControllerMessage, encodeControllerAdd, encodeControllerRemove, encodeControllerState,
} from '../controller-protocol.ts';

test('add: 8 byte [0][slot][buttons u32 BE][caps u16 BE]', () => {
  assert.deepEqual(Array.from(encodeControllerAdd(2, 0x0000_F7FF, 1)), [0, 2, 0, 0, 0xF7, 0xFF, 0, 1]);
});

test('remove: [1][slot]', () => {
  assert.deepEqual(Array.from(encodeControllerRemove(3)), [1, 3]);
});

test('state: nút A + cò + cần, Y đảo dấu', () => {
  const bytes = encodeControllerState({ buttons: 0x1000 | 0x0001, lt: 1, rt: 0.5, lx: 1, ly: -1, rx: -1, ry: 1 });
  const view = new DataView(bytes.buffer);
  assert.equal(bytes.length, 15);
  assert.equal(view.getUint8(0), 0);
  assert.equal(view.getUint32(1), 0x1001);
  assert.equal(view.getUint8(5), 255);
  assert.equal(view.getUint8(6), 128);
  assert.equal(view.getInt16(7), 32767); // lx
  assert.equal(view.getInt16(9), 32767); // ly = -(-1) = lên
  assert.equal(view.getInt16(11), -32767); // rx
  assert.equal(view.getInt16(13), -32767); // ry = -(1) = xuống
});

test('state: giá trị vượt biên bị kẹp, nút không âm', () => {
  const bytes = encodeControllerState({ buttons: -1, lt: 5, rt: -3, lx: 9, ly: 0, rx: 0, ry: 0 });
  const view = new DataView(bytes.buffer);
  assert.equal(view.getUint32(1), 0xFFFF_FFFF);
  assert.equal(view.getUint8(5), 255);
  assert.equal(view.getUint8(6), 0);
  assert.equal(view.getInt16(7), 32767);
});

test('rumble: giải mã hai động cơ và hai cò', () => {
  const motor = new Uint8Array([0, 1, 0xFF, 0xFF, 0x00, 0x00]).buffer;
  assert.deepEqual(decodeControllerMessage(motor), { slot: 1, low: 1, high: 0 });
  const trigger = new Uint8Array([1, 0, 0x00, 0x00, 0xFF, 0xFF]).buffer;
  assert.deepEqual(decodeControllerMessage(trigger), { slot: 0, low: 0, high: 0, triggerLeft: 0, triggerRight: 1 });
  assert.equal(decodeControllerMessage(new Uint8Array([0, 1]).buffer), null);
});
