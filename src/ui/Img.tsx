import { Image, type ImageProps } from 'expo-image';
import { useMemo, useState } from 'react';

import { IMAGE_PROXY_URL } from '@/lib/config';
import { proxiedImageUrl } from '@/lib/image-proxy';

/** Also resolves for cached images whose display callback may arrive early. */
export function prefetchImage(url: string): Promise<boolean> {
  return Image.prefetch(proxiedImageUrl(url, IMAGE_PROXY_URL), { cachePolicy: 'memory-disk' }).catch(() => false);
}

/**
 * expo-image với cache đĩa: ảnh Steam không phải tải lại mỗi lần mở kệ game.
 *
 * CDN Steam bị chặn ở Việt Nam nên ảnh Steam được tải qua proxy ảnh (xem
 * lib/image-proxy). Nếu proxy hỏng thì thử lại URL gốc một lần — ngoài Việt Nam
 * URL gốc vẫn tải được — rồi mới báo lỗi cho nơi gọi.
 */
type ImgProps = ImageProps & { retryDirect?: boolean };

export function Img({ source, onError, retryDirect = true, ...rest }: ImgProps) {
  const original = typeof source === 'string'
    ? source
    : source && typeof source === 'object' && !Array.isArray(source) && 'uri' in source && typeof source.uri === 'string'
      ? source.uri
      : null;
  const proxied = original ? proxiedImageUrl(original, IMAGE_PROXY_URL) : null;
  const usesProxy = Boolean(original && proxied && proxied !== original);
  // Associate fallback with its source so a new image never inherits a failed
  // proxy attempt or triggers an extra render just to reset it.
  const [directUrl, setDirectUrl] = useState<string | null>(null);
  const direct = original !== null && directUrl === original;

  const effective = useMemo(() => {
    if (!usesProxy || direct || !proxied) return source;
    return typeof source === 'string' ? proxied : { ...(source as object), uri: proxied };
  }, [direct, proxied, source, usesProxy]);

  return (
    <Image
      cachePolicy="memory-disk"
      transition={220}
      {...rest}
      source={effective}
      onError={(event) => {
        if (retryDirect && usesProxy && !direct) { setDirectUrl(original); return; }
        onError?.(event);
      }}
    />
  );
}
