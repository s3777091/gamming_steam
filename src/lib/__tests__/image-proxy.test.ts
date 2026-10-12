// Chạy: node --experimental-strip-types --test src/lib/__tests__/image-proxy.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { isSteamImageHost, proxiedImageUrl } from '../image-proxy.ts';

test('ảnh Steam đi qua proxy, URL gốc được mã hoá nguyên vẹn', () => {
  const source = 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/1174180/library_hero.jpg?t=1';
  assert.equal(
    proxiedImageUrl(source),
    `https://wsrv.nl/?url=${encodeURIComponent(source)}`,
  );
});

test('nhận đủ các host CDN của Steam, không nhận host na ná', () => {
  for (const host of ['cdn.cloudflare.steamstatic.com', 'steamcdn-a.akamaihd.net', 'avatars.steamstatic.com', 'steamcommunity.com']) {
    assert.equal(isSteamImageHost(host), true, host);
  }
  for (const host of ['vn.protexa.cloud', 'notsteamstatic.com', 'steamstatic.com.evil.example']) {
    assert.equal(isSteamImageHost(host), false, host);
  }
});

test('ảnh khác Steam, data: và file: giữ nguyên', () => {
  for (const uri of [
    'https://vn.protexa.cloud/storage/v1/object/public/ui-media/a.jpg',
    'data:image/png;base64,AAAA',
    'file:///data/user/0/cache/a.png',
    'không phải url',
  ]) {
    assert.equal(proxiedImageUrl(uri), uri);
  }
});

test('proxy rỗng thì tắt hẳn', () => {
  const source = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1/header.jpg';
  assert.equal(proxiedImageUrl(source, ''), source);
  assert.equal(proxiedImageUrl(source, null), source);
});

test('proxy tuỳ chỉnh có hoặc không có dấu / cuối đều ghép đúng', () => {
  const source = 'https://cdn.cloudflare.steamstatic.com/steam/apps/1/header.jpg';
  const expected = `https://img.example.com/p/?url=${encodeURIComponent(source)}`;
  assert.equal(proxiedImageUrl(source, 'https://img.example.com/p'), expected);
  assert.equal(proxiedImageUrl(source, 'https://img.example.com/p/'), expected);
});
