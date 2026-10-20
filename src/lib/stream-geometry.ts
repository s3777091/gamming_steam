import { Dimensions, PixelRatio } from 'react-native';
import { getDisplayInfo } from 'jetsona-input';
import { virtualDisplayGeometry } from './stream-display';

/** Physical pixels of the surface a session is played on. */
export type DisplayGeometry = { width: number; height: number };

/**
 * Một mode Windows chịu đặt. `refreshRates` là các tần số quét (Hz) của đúng
 * độ phân giải ấy; agent cũ không gửi trường này, nên thiếu nghĩa là "không
 * biết", không phải "không có".
 */
export type HostDisplayMode = DisplayGeometry & { refreshRates?: number[] };

/** What the agent on the Windows machine reports about the captured desktop. */
export type HostDisplay = DisplayGeometry & {
  canSwitchResolution?: boolean;
  modes?: HostDisplayMode[];
  /** Sunshine still points at a display identifier that no longer exists. */
  captureTargetStale?: boolean;
  /** Number of Windows displays seen by the capture-session agent. */
  displays?: number;
  displayMode?: 'physical' | 'virtual';
  displayState?: 'local' | 'streaming' | 'recovery';
  watchdogReady?: boolean;
  restoreVerified?: boolean;
  /** Live CCD targets, separate from the parked VDD's advertised capabilities. */
  current?: (DisplayGeometry & { refreshHz: number })[];
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
    const native = getDisplayInfo();
    if (native && native.widthPx > 0 && native.heightPx > 0) {
      return displayGeometryForCssPixels(native.widthPx, native.heightPx);
    }
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
 * Bao nhiêu chi tiết thật một mode mang được tới màn người xem.
 *
 * Mode được vẽ kiểu contain vào màn xem; mỗi trục chỉ tính tới số pixel mà
 * khung contain ấy hiển thị được 1:1. Mode nhỏ hơn màn thì bị phóng to, nên chỉ
 * mang đúng số pixel của chính nó; mode lớn hơn khung thì phần dư bị thu nhỏ
 * mất. Viền đen của mode lệch tỉ lệ đã nằm sẵn trong phép tính: khung contain
 * thấp hơn màn thì trục dọc bị cắt theo đó.
 */
function deliveredPixels(mode: DisplayGeometry, viewer: DisplayGeometry): number {
  const scale = Math.min(viewer.width / mode.width, viewer.height / mode.height);
  return Math.min(mode.width, mode.width * scale) * Math.min(mode.height, mode.height * scale);
}

/**
 * Lệch tỉ lệ được chấp nhận khi mode ấy mang tới nhiều chi tiết hơn ít nhất ngần
 * này lần.
 *
 * Khớp tỉ lệ vẫn là mặc định, nhưng không được phép thắng bằng mọi giá. Màn
 * Samsung ở nhà chỉ có một mode 16:10 là 1680x1050; tablet 2800x1752 nhận mode
 * ấy thì phải tự phóng to 1,67 lần mỗi trục, mờ thấy rõ. Khi DSR mở ra 2560x1440
 * hay 2880x1620, một khung 16:9 có viền mỏng (phần lớn được `stream-fit` giãn
 * lấp) mang gấp đôi chi tiết. 1.3 đủ cao để 1920x1080 (chỉ hơn 1680x1050 khoảng
 * 18% trên tablet này) và 1920x1080 so với 1600x1200 cho iPad 4:3 (~8%) không
 * đổi lấy viền đen.
 */
const SHARPER_MODE_GAIN = 1.3;

/**
 * Pick the literal frame Sunshine should request for one horizontal quality
 * tier. A mode reported by Windows is returned verbatim; rounding 1680x1050 to
 * 1680x1052 is enough to make Windows reject the switch.
 */
export function streamGeometryForTier(
  tierWidth: number,
  display: DisplayGeometry = clientDisplayGeometry(),
  host?: HostDisplay | null,
  auto = false,
): DisplayGeometry {
  if (host) {
    if (host.displayMode === 'virtual') return virtualDisplayGeometry(host, tierWidth, display, auto);
    // A floor is explicit hardware policy. `/display` reports the mode at this
    // instant, which may be the temporary mode requested by another/previous
    // stream; treating host.width as a floor creates a resolution ratchet.
    const floor = floorWidthsFor(host);
    const cap = Math.max(tierWidth, floor.hard);
    const matching = hostModeMatchingViewer(host, display, cap, floor.aspect);
    const nearest = hostModeNearestViewer(host, display, cap, floor.hard);
    if (matching && nearest
      && deliveredPixels(nearest, display) >= deliveredPixels(matching, display) * SHARPER_MODE_GAIN) {
      return nearest;
    }
    if (matching) return matching;
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

/** Dưới mức này là số rác (0/1 Hz là "mặc định phần cứng"), không phải tần số thật. */
const MIN_HOST_REFRESH_HZ = 24;

/**
 * Tần số quét cao nhất máy chủ chạy được ở đúng khung hình sẽ xin — `null` khi
 * không biết (agent cũ, không có mode trùng, hoặc mode không kèm tần số).
 *
 * Sunshine bắt hình theo nhịp desktop. Màn Samsung ở nhà chỉ lên tới 100 Hz ở
 * mọi mode, nên xin 120 fps thì nó vẫn bắt 100 khung/giây rồi mã hoá thành 120:
 * cứ năm khung lại lặp một, nhịp trình lệch đều đặn và tốn bit cho khung thừa.
 * Chỉ tra mode TRÙNG KHÍT khung hình, vì tần số của 1920x1080 không nói gì về
 * 1680x1050 — Windows kê tần số theo từng độ phân giải.
 */
export function hostRefreshCeiling(
  host: HostDisplay | null | undefined,
  frame: DisplayGeometry,
): number | null {
  const mode = host?.modes?.find((candidate) => displayGeometriesMatch(candidate, frame));
  const rates = (mode?.refreshRates ?? []).filter(
    (rate) => Number.isFinite(rate) && rate >= MIN_HOST_REFRESH_HZ,
  );
  return rates.length ? Math.max(...rates) : null;
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
