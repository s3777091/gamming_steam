// app_mobile nằm bên trong repo Next.js (jetsona-ui-hybrid) nên Metro không được
// lấy gói từ node_modules của thư mục cha — ở đó là react 19.0.0 của web, khác
// bản của app, và hai bản react trong một bundle là lỗi hook khó dò.
//
// Vẫn giữ tra cứu theo cấp (gói lồng nhau như expo-router/node_modules/@expo/...
// cần nó); chỉ chặn riêng cây node_modules của thư mục cha.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

const parentNodeModules = path.resolve(__dirname, '..', 'node_modules');
const escaped = parentNodeModules.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const existing = config.resolver.blockList;
config.resolver.blockList = [
  ...(Array.isArray(existing) ? existing : existing ? [existing] : []),
  new RegExp(`${escaped}[\\\\/].*`),
];

module.exports = config;
