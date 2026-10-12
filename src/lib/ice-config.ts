// Cấu hình ICE cho react-native-webrtc. Máy ở nhà chỉ có đường direct (xem
// IceMode trong stream-settings): lọc bỏ mọi URL turn:/turns: khỏi
// Setup.ice_servers, bỏ server rỗng, không đặt iceTransportPolicy — đúng như
// deploy/moonlight-web/patches/moonlight-web-v2.10-ice-transport-mode.patch.

import type { IceMode } from './stream-settings';

export type IceServerLike = {
  urls?: string | string[];
  username?: string;
  credential?: string;
};

function normalizeUrls(server: IceServerLike): IceServerLike {
  const urls = server.urls;
  const list = Array.isArray(urls) ? urls : urls ? [urls] : [];
  return { ...server, urls: list };
}

/** Lọc bỏ mọi URL turn:/turns:. */
export function stripTurnUrls(servers: IceServerLike[]): IceServerLike[] {
  return servers
    .map(normalizeUrls)
    .map((server) => ({
      ...server,
      urls: (server.urls as string[]).filter((url) => !/^turns?:/i.test(url)),
    }))
    .filter((server) => (server.urls as string[]).length > 0);
}

export function buildRtcIceConfig(
  _mode: IceMode,
  servers: IceServerLike[],
): { iceServers: IceServerLike[]; iceTransportPolicy?: 'relay' } {
  return { iceServers: stripTurnUrls(servers) };
}
