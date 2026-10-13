// Chạy: node --experimental-strip-types --test src/lib/__tests__/format-steam-news.test.ts
import assert from 'node:assert/strict';
import test from 'node:test';

import { cleanSteamText, extractSteamImage } from '../../features/library/format.ts';

test('loại bỏ lỗi [img src=" dở dang từ patch notes của Steam', () => {
  const raw1 = 'HZ Patch Notes 1.1 0.3\n[img src=" back with another patch for the Experimental branch, mainly focused on bug fixes ..';
  const cleaned1 = cleanSteamText(raw1);
  assert.equal(cleaned1, 'HZ Patch Notes 1.1 0.3\nback with another patch for the Experimental branch, mainly focused on bug fixes ..');
  assert.ok(!cleaned1.includes('[img'));
  assert.ok(!cleaned1.includes('src="'));

  const raw2 = '[img src="';
  assert.equal(cleanSteamText(raw2), '');
});

test('loại bỏ clan image placeholder và thẻ bbcode/html ảnh', () => {
  const raw = '[img src="{STEAM_CLAN_IMAGE}/12345/abc.png"] Survivors!\nNew build out now.';
  const cleaned = cleanSteamText(raw);
  assert.equal(cleaned, 'Survivors!\nNew build out now.');

  const rawBb = '[img]https://clan.akamai.steamstatic.com/images/123/x.jpg[/img] Update details';
  assert.equal(cleanSteamText(rawBb), 'Update details');

  const rawHtml = '<img src="https://example.com/pic.jpg" alt="pic" /> Hello world';
  assert.equal(cleanSteamText(rawHtml), 'Hello world');
});

test('trích xuất URL ảnh nếu có trong bài tin', () => {
  const withClan = 'Thông báo mới [img src="{STEAM_CLAN_IMAGE}/41443654/b7384.png"] chi tiết';
  assert.equal(extractSteamImage(withClan), 'https://clan.akamai.steamstatic.com/images/41443654/b7384.png');

  const withWeb = '<img src="https://example.com/banner.jpg" /> tin mới';
  assert.equal(extractSteamImage(withWeb), 'https://example.com/banner.jpg');

  const withoutImg = 'Không có ảnh nào ở đây';
  assert.equal(extractSteamImage(withoutImg), null);
});
