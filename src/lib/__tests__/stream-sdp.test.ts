// Chạy: node --experimental-strip-types --test src/lib/__tests__/stream-sdp.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { optimizeSdpForUltraSmooth } from '../stream-sdp.ts';

const SAMPLE_SDP = [
  'v=0',
  'o=- 123456789 2 IN IP4 127.0.0.1',
  's=-',
  't=0 0',
  'm=audio 9 UDP/TLS/RTP/SAVPF 111',
  'c=IN IP4 0.0.0.0',
  'a=rtpmap:111 opus/48000/2',
  'a=fmtp:111 minptime=10',
  'm=video 9 UDP/TLS/RTP/SAVPF 96 97',
  'c=IN IP4 0.0.0.0',
  'a=rtpmap:96 H264/90000',
  'a=fmtp:96 level-asymmetry-allowed=1;packetization-mode=1;profile-level-id=42e01f',
  'a=rtpmap:97 H264/90000',
  'a=fmtp:97 level-asymmetry-allowed=1;packetization-mode=0;profile-level-id=42e01f',
].join('\r\n');

test('chèn trần băng thông b=AS và b=TIAS dưới m=video', () => {
  const result = optimizeSdpForUltraSmooth(SAMPLE_SDP, { bitrateKbps: 20000, fps: 60 });
  assert.ok(result.includes('b=AS:25000'), 'Phải có b=AS:25000 (1.25x của 20000)');
  assert.ok(result.includes('b=TIAS:25000000'), 'Phải có b=TIAS:25000000');
});

test('chèn x-google-min-bitrate, start-bitrate và max-bitrate vào fmtp video', () => {
  const result = optimizeSdpForUltraSmooth(SAMPLE_SDP, { bitrateKbps: 20000, fps: 60 });
  assert.ok(result.includes('x-google-min-bitrate=11000'), 'Sàn bitrate 55% của 20000 = 11000');
  assert.ok(result.includes('x-google-start-bitrate=19000'), 'Start bitrate 95% = 19000');
  assert.ok(result.includes('x-google-max-bitrate=25000'), 'Max bitrate 125% = 25000');
  assert.ok(result.includes('max-fr=60'), 'Phải có max-fr=60');
});

test('bật useinbandfec=1 cho audio opus để chống giật tiếng', () => {
  const result = optimizeSdpForUltraSmooth(SAMPLE_SDP, { bitrateKbps: 20000, fps: 60 });
  assert.ok(result.includes('a=fmtp:111 minptime=10;useinbandfec=1'), 'Audio phải kích hoạt useinbandfec=1');
});

test('không nhân bản tham số nếu đã có', () => {
  const alreadyOptimized = optimizeSdpForUltraSmooth(SAMPLE_SDP, { bitrateKbps: 20000, fps: 60 });
  const twice = optimizeSdpForUltraSmooth(alreadyOptimized, { bitrateKbps: 20000, fps: 60 });
  const matches = twice.match(/x-google-min-bitrate/g);
  assert.equal(matches?.length, 2, 'Mỗi video PT (96, 97) chỉ có đúng 1 lần tham số');
});

test('xử lý an toàn khi sdp rỗng hoặc bitrate không hợp lệ', () => {
  assert.equal(optimizeSdpForUltraSmooth('', { bitrateKbps: 20000 }), '');
  assert.equal(optimizeSdpForUltraSmooth(SAMPLE_SDP, { bitrateKbps: 0 }), SAMPLE_SDP);
});
