import { Image, type ImageProps } from 'expo-image';
import { useEffect, useState } from 'react';

import { IMAGE_PROXY_URL } from '@/lib/config';
import { proxiedImageUrl } from '@/lib/image-proxy';

/**
 * expo-image với cache đĩa: ảnh Steam không phải tải lại mỗi lần mở kệ game.
 *
 * CDN Steam bị chặn ở Việt Nam nên ảnh Steam được tải qua proxy ảnh (xem
 * lib/image-proxy). Nếu proxy hỏng thì thử lại URL gốc một lần — ngoài Việt Nam
 * URL gốc vẫn tải được — rồi mới báo lỗi cho nơi gọi.
 */
export function Img({ source, onError, ...rest }: ImageProps) {
  const original = typeof source === 'string'
    ? source
    : source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source && typeof source.uri === 'string'
      ? source.uri
      : null;
  const proxied = original ? proxiedImageUrl(original, IMAGE_PROXY_URL) : null;
  const usesProxy = Boolean(original && proxied && proxied !== original);
  const [direct, setDirect] = useState(false);
  useEffect(() => setDirect(false), [original]);

  let effective = source;
  if (usesProxy && !direct && proxied) {
    effective = typeof source === 'string' ? proxied : { ...(source as object), uri: proxied };
  }

  return (
    <Image
      cachePolicy="memory-disk"
      transition={220}
      {...rest}
      source={effective}
      onError={(event) => {
        if (usesProxy && !direct) { setDirect(true); return; }
        onError?.(event);
      }}
    />
  );
}
