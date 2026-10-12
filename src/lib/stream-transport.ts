import type { DisplayGeometry } from './stream-geometry';

export type StreamTransportConfig = {
  bitrate: number;
  fps: number;
  videoFrameQueueSize: number;
  videoSize: '720p' | '1080p' | '1440p' | '4k' | 'custom';
  videoSizeCustom: DisplayGeometry;
  videoCodec: 'auto' | 'av1' | 'h265' | 'h264';
  hdr: boolean;
  canvasVsync: boolean;
};

export type SurfaceReconcileDecision = 'unchanged' | 'record' | 'restart';

/** Every setting encoded into the Moonlight iframe URL. */
export function sameStreamTransport(
  a: StreamTransportConfig,
  b: StreamTransportConfig,
): boolean {
  return a.bitrate === b.bitrate
    && a.fps === b.fps
    && a.videoFrameQueueSize === b.videoFrameQueueSize
    && a.videoSize === b.videoSize
    && a.videoSizeCustom.width === b.videoSizeCustom.width
    && a.videoSizeCustom.height === b.videoSizeCustom.height
    && a.videoCodec === b.videoCodec
    && a.hdr === b.hdr
    && a.canvasVsync === b.canvasVsync;
}

/**
 * Decide whether a stable surface resize needs a fresh Moonlight transport.
 * `record` consumes harmless browser-chrome animations without reconnecting.
 */
export function decideSurfaceReconcile(
  previous: DisplayGeometry | null,
  next: DisplayGeometry,
  current: StreamTransportConfig | null,
  resolved: StreamTransportConfig | null,
): SurfaceReconcileDecision {
  if (!previous || (previous.width === next.width && previous.height === next.height)) {
    return 'unchanged';
  }
  if (!current || !resolved || sameStreamTransport(current, resolved)) return 'record';
  return 'restart';
}

export function buildStreamUrl(
  hostId: number,
  appId: number,
  config: StreamTransportConfig | null,
  pathPrefix: '/pc' | '/vm',
): string {
  const query = new URLSearchParams({ hostId: String(hostId), appId: String(appId) });
  // Keep the explicit direct URL for patched Moonlight clients.
  query.set('iceMode', 'direct');
  if (config) {
    query.set('bitrate', String(config.bitrate));
    query.set('fps', String(config.fps));
    query.set('hdr', String(config.hdr));
    query.set('videoSize', config.videoSize);
    query.set('videoSizeCustom.width', String(config.videoSizeCustom.width));
    query.set('videoSizeCustom.height', String(config.videoSizeCustom.height));
    query.set('videoCodec', config.videoCodec);
    query.set('canvasVsync', String(config.canvasVsync));
    query.set('videoFrameQueueSize', String(config.videoFrameQueueSize));
  }
  // VM needs the same-origin bootstrap which overlays this exact config before
  // Moonlight reads mlSettings. PC keeps using Moonlight's stock stream page.
  const page = pathPrefix === '/vm' ? '/api/vm/stream' : `${pathPrefix}/stream.html`;
  return `${page}?${query.toString()}`;
}
