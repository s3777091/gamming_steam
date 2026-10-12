import { Dimensions, PixelRatio } from 'react-native';

/** Physical pixels of the surface a session is played on. */
export type DisplayGeometry = { width: number; height: number };

/** What the agent on the Windows machine reports about the captured desktop. */
export type HostDisplay = DisplayGeometry & {
  canSwitchResolution?: boolean;
  modes?: DisplayGeometry[];
  /** Sunshine still points at a display identifier that no longer exists. */
  captureTargetStale?: boolean;
  /** Number of Windows displays seen by the capture-session agent. */
  displays?: number;
  /** Trusted hardware policy; never infer this from the current streamed mode. */
  resolutionFloorWidth?: number;
  /** Lower floor allowed only when a mode exactly matches the viewer's shape. */
  aspectResolutionFloorWidth?: number;
};

export const FALLBACK_DISPLAY: DisplayGeometry = { width: 1920, height: 1080 };
const MIN_ASPECT = 1.2;
const MAX_ASPECT = 3.6;
const MIN_STREAM_WIDTH = 640;
const MAX_STREAM_HEIGHT = 2160;

/** Convert a rendered CSS box to real pixels, always in landscape order. */
export function displayGeometryForCssPixels(
  cssWidth: number,
  cssHeight: number,
  pixelRatio = 1,
): DisplayGeometry {
  const ratio = Number.isFinite(pixelRatio) && pixelRatio > 0 ? pixelRatio : 1;
  let width = Math.round(cssWidth * ratio);
  let height = Math.round(cssHeight * ratio);
  if (height > width) [width, height] = [height, width];
  if (!(width > 0) || !(height > 0)) return FALLBACK_DISPLAY;
  return { width, height };
}

/**
 * Pixels of the screen the session is played on, in landscape order.
 *
 * Native has no browser chrome to subtract: the app draws edge to edge in
 * immersive mode, so the physical screen IS the surface. `Dimensions` reports
 * dp, `PixelRatio` converts them back to the real panel pixels.
 */
export function clientDisplayGeometry(): DisplayGeometry {
  try {
    const screen = Dimensions.get('screen');
    return displayGeometryForCssPixels(screen.width, screen.height, PixelRatio.get());
  } catch {
    return FALLBACK_DISPLAY;
  }
}


/** Width divided by height, clamped to shapes real displays use. */
export function clientAspectRatio(display: DisplayGeometry = clientDisplayGeometry()): number {
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, display.width / display.height));
}

/** Two aspect ratios are visually the same below roughly half a percent. */
export function aspectsMatch(a: DisplayGeometry, b: DisplayGeometry): boolean {
  return Math.abs(a.width / a.height - b.width / b.height) < 0.009;
}

/** Exact rendered-pixel equality; equal aspect ratio alone is not enough. */
export function displayGeometriesMatch(a: DisplayGeometry, b: DisplayGeometry): boolean {
  return a.width === b.width && a.height === b.height;
}

const snapToBlock = (value: number) => Math.max(4, Math.round(value / 4) * 4);

/**
 * Bao nhiêu bề ngang được phép đánh đổi để lấy ĐÚNG TỈ LỆ của người xem.
 *
 * Sàn phần cứng là con số tuyệt đối cho nhánh "không khớp được tỉ lệ" — ở đó
 * thu nhỏ desktop chẳng đổi lại được gì. Nhưng áp đúng con số ấy lên cả nhánh
 * KHỚP TỈ LỆ thì màn hình này không còn lối ra: cả hai mươi mode của nó chỉ có
 * MỘT mode 16:10 là 1680x1050, và 1680 < 1920 nên nó bị lọc mất. Mọi người xem
 * 16:10 rơi thẳng xuống 1920x1080, tức viền đen nướng sẵn trên và dưới khung
 * hình — đúng thứ cả file này tồn tại để tránh.
 *
 * 0.85 đặt ngưỡng ngay dưới 1680/1920 = 0.875 và ngay trên 1600/1920 = 0.833:
 * đổi tỉ lệ được phép tốn tối đa 15% bề ngang, còn tụt sâu hơn thế (1440x900,
 * 1280x800) thì viền đen vẫn rẻ hơn là bắt người ngồi tại máy nhìn một desktop
 * bé đi thấy rõ.
 */
const ASPECT_MATCH_FLOOR_SCALE = 0.85;

/**
 * Sàn cứng (chính sách phần cứng) và sàn mềm dành riêng cho nhánh khớp tỉ lệ.
 */
function floorWidthsFor(host: HostDisplay): { hard: number; aspect: number } {
  const hard = Number.isFinite(host.resolutionFloorWidth)
    ? Math.max(0, host.resolutionFloorWidth ?? 0)
    : 0;
  const explicitAspect = host.aspectResolutionFloorWidth;
  const aspect = Number.isFinite(explicitAspect)
    ? Math.max(0, explicitAspect ?? 0)
    : Math.round(hard * ASPECT_MATCH_FLOOR_SCALE);
  return { hard, aspect };
}

function hostModeMatchingViewer(
  host: HostDisplay,
  viewer: DisplayGeometry,
  maxWidth = Number.POSITIVE_INFINITY,
  minWidth = 0,
): DisplayGeometry | null {
  if (!host.canSwitchResolution || !host.modes?.length) return null;
  const usable = host.modes.filter(
    (mode) =>
      aspectsMatch(mode, viewer) &&
      mode.height <= MAX_STREAM_HEIGHT &&
      mode.width >= minWidth,
  );
  if (!usable.length) return null;
  const fits = usable.filter((mode) => mode.width <= maxWidth);
  if (!fits.length) return usable.reduce((best, mode) => (mode.width < best.width ? mode : best));
  return fits.reduce((best, mode) => (mode.width > best.width ? mode : best));
}

function hostModeNearestViewer(
  host: HostDisplay,
  viewer: DisplayGeometry,
  maxWidth = Number.POSITIVE_INFINITY,
  minWidth = 0,
): DisplayGeometry | null {
  if (!host.canSwitchResolution || !host.modes?.length) return null;
  const wanted = viewer.width / viewer.height;
  const usable = host.modes.filter(
    (mode) => mode.height <= MAX_STREAM_HEIGHT && mode.width >= minWidth,
  );
  if (!usable.length) return null;

  const nearest = usable.reduce((best, mode) =>
    Math.abs(mode.width / mode.height - wanted) < Math.abs(best.width / best.height - wanted)
      ? mode
      : best,
  );
  const sameShape = usable.filter((mode) => aspectsMatch(mode, nearest));
  const fits = sameShape.filter((mode) => mode.width <= maxWidth);
  if (!fits.length) return sameShape.reduce((best, mode) => (mode.width < best.width ? mode : best));
  return fits.reduce((best, mode) => (mode.width > best.width ? mode : best));
}

/**
 * Pick the literal frame Sunshine should request for one horizontal quality
 * tier. A mode reported by Windows is returned verbatim; rounding 1680x1050 to
 * 1680x1052 is enough to make Windows reject the switch.
 */
export function streamGeometryForTier(
  tierWidth: number,
  display: DisplayGeometry = clientDisplayGeometry(),
  host?: HostDisplay | null,
): DisplayGeometry {
  if (host) {
    // A floor is explicit hardware policy. `/display` reports the mode at this
    // instant, which may be the temporary mode requested by another/previous
    // stream; treating host.width as a floor creates a resolution ratchet.
    const floor = floorWidthsFor(host);
    const cap = Math.max(tierWidth, floor.hard);
    const matching = hostModeMatchingViewer(host, display, cap, floor.aspect);
    if (matching) return matching;
    const nearest = hostModeNearestViewer(host, display, cap, floor.hard);
    if (nearest) return nearest;
    // A non-switchable/single-mode Hyper-V display must be reported honestly.
    return { width: host.width, height: host.height };
  }

  const aspect = clientAspectRatio(display);
  const target = Math.min(tierWidth, display.width);
  let width = snapToBlock(Math.max(MIN_STREAM_WIDTH, target));
  let height = snapToBlock(width / aspect);
  if (height > MAX_STREAM_HEIGHT) {
    height = MAX_STREAM_HEIGHT;
    width = snapToBlock(height * aspect);
  }
  return { width, height };
}

/** True when the host can produce the viewer's shape without letterboxing. */
export function streamWillFillViewer(
  host: HostDisplay | null | undefined,
  viewer: DisplayGeometry = clientDisplayGeometry(),
): boolean {
  if (!host) return true;
  const floor = floorWidthsFor(host);
  return Boolean(hostModeMatchingViewer(host, viewer, Number.POSITIVE_INFINITY, floor.aspect)) ||
    (!host.canSwitchResolution && aspectsMatch(host, viewer));
}

/**
 * Stretch only the axis that would otherwise letterbox a contained video.
 * The resulting pixels cover the viewer exactly, so the full-surface native
 * input coordinates stay aligned with the rendered remote desktop.
 */
export function fullBleedStretch(
  stream: DisplayGeometry,
  viewer: DisplayGeometry,
): { scaleX: number; scaleY: number } {
  if (!(stream.width > 0) || !(stream.height > 0) || !(viewer.width > 0) || !(viewer.height > 0)) {
    return { scaleX: 1, scaleY: 1 };
  }
  const streamAspect = stream.width / stream.height;
  const viewerAspect = viewer.width / viewer.height;
  if (Math.abs(streamAspect - viewerAspect) < 0.0001) return { scaleX: 1, scaleY: 1 };
  return viewerAspect > streamAspect
    ? { scaleX: viewerAspect / streamAspect, scaleY: 1 }
    : { scaleX: 1, scaleY: streamAspect / viewerAspect };
}
