import type { DisplayGeometry, HostDisplay, HostDisplayMode } from './stream-geometry';

const record = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;

function geometry(value: unknown): DisplayGeometry | null {
  const data = record(value);
  if (!data || typeof data.width !== 'number' || typeof data.height !== 'number'
    || !Number.isInteger(data.width) || !Number.isInteger(data.height)
    || data.width < 640 || data.height < 480 || data.width > 16384 || data.height > 16384) return null;
  return { width: data.width, height: data.height };
}

const validRate = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value) && value >= 24 && value <= 1000;

/** A missing field from an older agent remains unknown, never verified. */
export function parseHostDisplay(value: unknown): HostDisplay | null {
  const data = record(value);
  const size = geometry(value);
  if (!data || data.ok !== true || !size) return null;
  const modes = new Map<string, HostDisplayMode>();
  if (Array.isArray(data.modes)) for (const raw of data.modes) {
    const mode = geometry(raw);
    const item = record(raw);
    if (!mode || !item) continue;
    const key = `${mode.width}x${mode.height}`;
    const rates = Array.isArray(item.refreshRates) ? item.refreshRates.filter(validRate) : [];
    const previous = modes.get(key)?.refreshRates ?? [];
    const refreshRates = [...new Set([...previous, ...rates])].sort((a, b) => a - b);
    modes.set(key, { ...mode, ...(refreshRates.length ? { refreshRates } : {}) });
  }
  const current = Array.isArray(data.current) ? data.current.flatMap(raw => {
    const size = geometry(raw);
    const item = record(raw);
    return size && item && validRate(item.refreshHz) ? [{ ...size, refreshHz: item.refreshHz }] : [];
  }) : undefined;
  return {
    ...size,
    modes: data.modes === undefined ? undefined : [...modes.values()],
    canSwitchResolution: data.canSwitchResolution === true,
    captureTargetStale: typeof data.captureTargetStale === 'boolean' ? data.captureTargetStale : undefined,
    displays: typeof data.displays === 'number' && Number.isInteger(data.displays) && data.displays >= 0 ? data.displays : undefined,
    displayMode: data.displayMode === 'virtual' ? 'virtual' : data.displayMode === 'physical' ? 'physical' : undefined,
    displayState: data.displayState === 'local' || data.displayState === 'streaming' || data.displayState === 'recovery' ? data.displayState : undefined,
    watchdogReady: typeof data.watchdogReady === 'boolean' ? data.watchdogReady : undefined,
    restoreVerified: typeof data.restoreVerified === 'boolean' ? data.restoreVerified : undefined,
    current: Array.isArray(data.current) && current?.length === data.current.length ? current : undefined,
  };
}

/**
 * No nearest-mode fallback: it can add borders or change an explicit choice.
 * Auto may step down to a smaller mode of the same shape — a phone panel such
 * as 2796×1290 rarely has its own VDD mode, but 2340×1080 keeps it border-free.
 */
export function virtualDisplayGeometry(host: HostDisplay, width: number, viewer: DisplayGeometry, auto = false): DisplayGeometry {
  const height = width * viewer.height / viewer.width;
  const modes = host.canSwitchResolution ? host.modes ?? [] : [];
  const exact = modes.find(mode => mode.width === width && Math.abs(mode.height - height) <= 2);
  const sameShape = auto ? modes.filter(mode => mode.width <= width
    && Math.abs(mode.width / mode.height - viewer.width / viewer.height) < 0.009) : [];
  const mode = exact ?? sameShape.reduce<HostDisplayMode | undefined>((best, mode) => !best || mode.width > best.width ? mode : best, undefined);
  if (!mode) throw new Error(`Màn hình ảo chưa có mode ${width}×${Math.round(height)} hoặc mode nhỏ hơn đúng tỷ lệ thiết bị nhận. Hãy thêm mode này vào driver màn hình ảo trên PC rồi chạy lại setup.`);
  return { width: mode.width, height: mode.height };
}

export function frameRateForDisplay(host: HostDisplay | null | undefined, size: DisplayGeometry, requested: number, manual: boolean): number {
  if (host?.displayMode !== 'virtual') return requested;
  const rates = host.modes?.find(mode => mode.width === size.width && mode.height === size.height)?.refreshRates ?? [];
  if (rates.includes(requested)) return requested;
  if (!manual) {
    // Auto may reduce FPS, but only to a rate this exact pixel mode supports.
    const supported = rates.filter(rate => Number.isInteger(rate) && validRate(rate) && rate <= requested);
    if (supported.length) return Math.max(...supported);
  }
  throw new Error(`Màn hình ảo chưa hỗ trợ ${size.width}×${size.height} ở ${requested} Hz. Phiên chưa được mở.`);
}

/** Check the applied Windows mode before exposing the stream or launching games. */
export function assertVirtualDisplayStream(host: HostDisplay | null, size: DisplayGeometry, hz: number): void {
  const actual = host?.current?.[0];
  if (host?.displayMode !== 'virtual' || host.displayState !== 'streaming' || host.displays !== 1
    || host.captureTargetStale !== false || host.watchdogReady !== true || host.current?.length !== 1
    || !actual || !validRate(actual.refreshHz) || actual.width !== size.width || actual.height !== size.height || Math.abs(actual.refreshHz - hz) > 0.15) {
    throw new Error(`PC chưa xác nhận chỉ màn hình ảo ${size.width}×${size.height}/${hz} Hz hoạt động. Phiên đã dừng.`);
  }
}
