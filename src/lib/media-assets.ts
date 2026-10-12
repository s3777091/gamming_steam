// Media dùng chung với web nằm ở bucket công khai `ui-media` của Supabase
// Storage. Cùng manifest với web (src/lib/media-assets.json là bản sao của
// scripts/media-assets.json) nên mỗi file có đúng một URL kèm sha256: file đổi
// thì URL đổi, cache của thiết bị tự bỏ bản cũ.

import manifest from './media-assets.json';
import { backendUrl } from './config';

type MediaAsset = { path: string; sha256: string; contentType: string };

const assets = manifest.assets as MediaAsset[];
const assetByPublicPath = new Map(assets.map((asset) => [`/${asset.path}`, asset]));
const MEDIA_STORAGE_PREFIX = `/storage/v1/object/public/${manifest.storage.bucket}`;

export function versionedMediaUrl(publicPath: string): string {
  const normalizedPath = publicPath.startsWith('/') ? publicPath : `/${publicPath}`;
  const asset = assetByPublicPath.get(normalizedPath);
  if (!asset) throw new Error(`Media asset is missing from the manifest: ${normalizedPath}`);
  return backendUrl(`${MEDIA_STORAGE_PREFIX}${normalizedPath}?v=${asset.sha256}`);
}
