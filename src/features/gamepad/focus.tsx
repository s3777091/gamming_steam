// Tiêu điểm điều hướng bằng tay cầm, kiểu giao diện PS5: D-pad / cần trái nhảy
// từng nấc sang phần tử kế tiếp, A bấm, B quay lại. Không có con trỏ tự do.
//
// Mọi `Press` tự đăng ký ở đây. Vị trí được đo (measureInWindow) đúng lúc người
// dùng bấm hướng chứ không theo dõi từng lần layout, nên không tốn gì khi không
// dùng tay cầm. Các lớp phủ (cài đặt, panel, hộp thoại) bọc nội dung trong
// `FocusLayer` để tiêu điểm không lọt ra phần nằm dưới. `FocusScroll` thay
// ScrollView để phần tử được chọn tự cuộn vào khung nhìn.

import {
  createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useMemo, useRef, useSyncExternalStore,
  type ReactNode, type RefObject,
} from 'react';
import {
  ScrollView, View, type NativeScrollEvent, type NativeSyntheticEvent, type ScrollViewProps,
} from 'react-native';

import {
  pickFirst, pickNearest, pickNeighbor, revealDelta, type Candidate, type Direction, type Rect,
} from './spatial';

export type { Direction } from './spatial';

// ---------------------------------------------------------------- kiểu dữ liệu

type ScrollTarget = {
  ref: RefObject<ScrollView | null>;
  horizontal: boolean;
  offset: { current: { x: number; y: number } };
  parent: ScrollTarget | null;
};

type FocusNode = {
  id: number;
  layer: number;
  ref: RefObject<View | null>;
  scroll: ScrollTarget | null;
  press: () => void;
  /** Điều chỉnh giá trị (slider): trả true nếu đã tiêu thụ hướng trái/phải. */
  adjust?: (step: -1 | 1) => boolean;
  isDisabled: () => boolean;
  autoFocus: boolean;
};

// ---------------------------------------------------------------- trạng thái

const nodes = new Map<number, FocusNode>();
const layers: number[] = [];
const layerScrolls = new Map<number, ScrollTarget>();
const lastFocusByLayer = new Map<number, number>();
const listeners = new Set<() => void>();

let nextId = 1;
let focusedId: number | null = null;
let focusedRect: Rect | null = null;
let padActive = false;
let viewport = { width: 1280, height: 800 };
let moving = false;
let queuedDirection: Direction | null = null;
let repickTimer: ReturnType<typeof setTimeout> | undefined;

const REVEAL_PADDING = 24;
const SCROLL_STEP = 180;
const MEASURE_TIMEOUT_MS = 160;
/** Chờ lớp phủ vừa mở xong animation trượt vào rồi mới đo và chọn ô đầu tiên. */
const LAYER_SETTLE_MS = 340;

function notify() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function currentLayer(): number {
  return layers.length ? layers[layers.length - 1] : 0;
}

function setFocused(id: number | null, rect: Rect | null) {
  focusedId = id;
  focusedRect = rect;
  notify();
}

function setActive(active: boolean) {
  if (padActive === active) return;
  padActive = active;
  notify();
}

// ---------------------------------------------------------------- đo đạc

function measureHost(host: unknown): Promise<Rect | null> {
  return new Promise((resolve) => {
    const target = host as { measureInWindow?: (callback: (x: number, y: number, w: number, h: number) => void) => void } | null;
    if (!target?.measureInWindow) { resolve(null); return; }
    const timer = setTimeout(() => resolve(null), MEASURE_TIMEOUT_MS);
    target.measureInWindow((x, y, w, h) => {
      clearTimeout(timer);
      resolve(Number.isFinite(x) && Number.isFinite(y) && w > 0 && h > 0 ? { x, y, w, h } : null);
    });
  });
}

function measureNode(node: FocusNode): Promise<Rect | null> {
  return measureHost(node.ref.current);
}

function measureScroll(target: ScrollTarget): Promise<Rect | null> {
  const view = target.ref.current;
  return measureHost(view?.getNativeScrollRef?.() ?? view);
}

function intersectsViewport(rect: Rect): boolean {
  return rect.x < viewport.width && rect.y < viewport.height && rect.x + rect.w > 0 && rect.y + rect.h > 0;
}

async function measureLayer(layer: number): Promise<Array<Candidate<FocusNode>>> {
  const pool = Array.from(nodes.values()).filter((node) => node.layer === layer && !node.isDisabled());
  const rects = await Promise.all(pool.map(measureNode));
  const result: Array<Candidate<FocusNode>> = [];
  pool.forEach((node, index) => {
    const rect = rects[index];
    // Phần tử nằm trong ScrollView được phép ở ngoài màn hình (sẽ cuộn tới).
    if (rect && (node.scroll || intersectsViewport(rect))) result.push({ item: node, rect });
  });
  return result;
}

// ---------------------------------------------------------------- cuộn

function scrollTargetBy(target: ScrollTarget, delta: number, animated: boolean) {
  if (!delta) return;
  const view = target.ref.current;
  if (!view) return;
  const offset = target.offset.current;
  if (target.horizontal) view.scrollTo({ x: Math.max(0, offset.x + delta), y: 0, animated });
  else view.scrollTo({ x: 0, y: Math.max(0, offset.y + delta), animated });
}

/** Cuộn từng ScrollView bao quanh `node` sao cho nó nằm trọn trong khung nhìn. */
async function reveal(node: FocusNode, rect: Rect | null) {
  let target = node.scroll;
  if (!target) return;
  const nodeRect = rect ?? await measureNode(node);
  if (!nodeRect) return;
  while (target) {
    const box = await measureScroll(target);
    if (box) {
      const delta = revealDelta(nodeRect, box, target.horizontal ? 'x' : 'y', REVEAL_PADDING);
      scrollTargetBy(target, delta, true);
    }
    target = target.parent;
  }
}

function scrollLayer(direction: Direction): boolean {
  const target = layerScrolls.get(currentLayer());
  if (!target) return false;
  if (direction === 'up' || direction === 'down') {
    if (target.horizontal) return false;
    scrollTargetBy(target, direction === 'down' ? SCROLL_STEP : -SCROLL_STEP, true);
    return true;
  }
  if (!target.horizontal) return false;
  scrollTargetBy(target, direction === 'right' ? SCROLL_STEP : -SCROLL_STEP, true);
  return true;
}

/** Cần phải: cuộn ScrollView dọc của ô đang chọn (hoặc của lớp trên cùng). */
export function scrollFocused(dx: number, dy: number): void {
  const node = focusedId === null ? null : nodes.get(focusedId) ?? null;
  let target: ScrollTarget | null = node?.scroll ?? null;
  const wantsVertical = Math.abs(dy) >= Math.abs(dx);
  while (target && target.horizontal === wantsVertical) target = target.parent;
  if (!target) {
    const layerTarget = layerScrolls.get(currentLayer());
    if (layerTarget && layerTarget.horizontal === !wantsVertical) target = layerTarget;
  }
  if (!target) return;
  scrollTargetBy(target, target.horizontal ? dx : dy, false);
}

// ---------------------------------------------------------------- điều hướng

function focusNode(node: FocusNode, rect: Rect) {
  lastFocusByLayer.set(node.layer, node.id);
  setFocused(node.id, rect);
  void reveal(node, rect);
}

function pickDefault(items: Array<Candidate<FocusNode>>): FocusNode | null {
  const layer = items[0]?.item.layer;
  const remembered = layer === undefined ? undefined : lastFocusByLayer.get(layer);
  const previous = remembered === undefined ? undefined : items.find((entry) => entry.item.id === remembered);
  if (previous) return previous.item;
  const preferred = items.filter((entry) => entry.item.autoFocus);
  return pickFirst(preferred.length ? preferred : items);
}

async function runMove(direction: Direction) {
  const items = await measureLayer(currentLayer());
  if (!items.length) return;
  const current = focusedId === null ? undefined : items.find((entry) => entry.item.id === focusedId);

  // Lần bấm đầu sau khi chạm màn hình hoặc mở lớp mới: hiện tiêu điểm, chưa di chuyển.
  if (!padActive || !current) {
    setActive(true);
    if (current) return;
    const first = pickDefault(items);
    const rect = first ? items.find((entry) => entry.item === first)!.rect : null;
    if (first && rect) focusNode(first, rect);
    return;
  }

  if (current.item.adjust && (direction === 'left' || direction === 'right')) {
    if (current.item.adjust(direction === 'right' ? 1 : -1)) return;
  }

  const next = pickNeighbor(current.rect, items.filter((entry) => entry.item !== current.item), direction);
  if (!next) {
    scrollLayer(direction);
    return;
  }
  const rect = items.find((entry) => entry.item === next)!.rect;
  focusNode(next, rect);
}

/** D-pad / cần trái. Các lần bấm dồn lại chỉ giữ lần mới nhất khi đang đo. */
export function moveFocus(direction: Direction): void {
  if (moving) { queuedDirection = direction; return; }
  moving = true;
  void runMove(direction)
    .catch(() => {})
    .finally(() => {
      moving = false;
      const queued = queuedDirection;
      queuedDirection = null;
      if (queued) moveFocus(queued);
    });
}

/** A: bấm ô đang chọn. Chưa có tiêu điểm thì chỉ hiện tiêu điểm lên. */
export function activateFocus(): boolean {
  const node = focusedId === null ? undefined : nodes.get(focusedId);
  if (!padActive || !node || node.isDisabled()) {
    moveFocus('down');
    return false;
  }
  node.press();
  return true;
}

/** Người dùng chạm màn hình: ẩn viền tiêu điểm cho tới lần bấm D-pad kế tiếp. */
export function deactivateFocus(): void {
  setActive(false);
}

export function isFocusActive(): boolean {
  return padActive;
}

export function setFocusViewport(width: number, height: number): void {
  viewport = { width, height };
}

/** Chọn ô mặc định của lớp trên cùng (sau khi mở lớp phủ hoặc đóng lớp phủ). */
async function focusLayerDefault() {
  const items = await measureLayer(currentLayer());
  if (!items.length) { setFocused(null, null); return; }
  const first = pickDefault(items);
  const rect = first ? items.find((entry) => entry.item === first)!.rect : null;
  if (first && rect) focusNode(first, rect);
}

/** Ô đang được chọn biến mất (đóng menu, đổi tab): nhảy sang ô gần nó nhất. */
function scheduleRepick() {
  clearTimeout(repickTimer);
  repickTimer = setTimeout(async () => {
    if (focusedId !== null && nodes.has(focusedId)) return;
    const origin = focusedRect;
    if (!padActive) { setFocused(null, null); return; }
    const items = await measureLayer(currentLayer());
    if (focusedId !== null && nodes.has(focusedId)) return;
    const next = origin
      ? pickNearest({ x: origin.x + origin.w / 2, y: origin.y + origin.h / 2 }, items)
      : pickFirst(items);
    const rect = next ? items.find((entry) => entry.item === next)!.rect : null;
    if (next && rect) focusNode(next, rect); else setFocused(null, null);
  }, 90);
}

// ---------------------------------------------------------------- React

const LayerContext = createContext(0);
const ScrollContext = createContext<ScrollTarget | null>(null);

/**
 * Lớp tiêu điểm: chỉ phần tử bên trong lớp trên cùng điều hướng được. Bọc nội
 * dung của mọi lớp phủ chiếm cả màn hình (cài đặt, panel, hộp thoại).
 */
export function FocusLayer({ children }: { children: ReactNode }) {
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = nextId++;
  const id = idRef.current;

  useEffect(() => {
    layers.push(id);
    let settle: ReturnType<typeof setTimeout> | undefined;
    if (padActive) {
      setFocused(null, null);
      settle = setTimeout(() => void focusLayerDefault(), LAYER_SETTLE_MS);
    }
    return () => {
      clearTimeout(settle);
      const index = layers.lastIndexOf(id);
      if (index >= 0) layers.splice(index, 1);
      layerScrolls.delete(id);
      lastFocusByLayer.delete(id);
      if (padActive) {
        const below = lastFocusByLayer.get(currentLayer());
        if (below !== undefined && nodes.has(below)) {
          setFocused(below, null);
          void measureNode(nodes.get(below)!).then((rect) => { if (focusedId === below) focusedRect = rect; });
        } else {
          setFocused(null, null);
          void focusLayerDefault();
        }
      }
    };
  }, [id]);

  return (
    <LayerContext.Provider value={id}>
      <ScrollContext.Provider value={null}>{children}</ScrollContext.Provider>
    </LayerContext.Provider>
  );
}

type FocusableOptions = {
  ref: RefObject<View | null>;
  onPress: () => void;
  disabled?: boolean;
  enabled?: boolean;
  autoFocus?: boolean;
  adjust?: (step: -1 | 1) => boolean;
};

/** Đăng ký một phần tử điều hướng được; trả về true khi nó đang là ô được chọn. */
export function useFocusable({ ref, onPress, disabled = false, enabled = true, autoFocus = false, adjust }: FocusableOptions): boolean {
  const layer = useContext(LayerContext);
  const scroll = useContext(ScrollContext);
  const idRef = useRef(0);
  if (!idRef.current) idRef.current = nextId++;
  const id = idRef.current;

  const latest = useRef({ onPress, disabled, adjust });
  latest.current = { onPress, disabled, adjust };

  useEffect(() => {
    if (!enabled) return;
    const node: FocusNode = {
      id, layer, ref, scroll, autoFocus,
      press: () => latest.current.onPress(),
      adjust: (step) => latest.current.adjust?.(step) ?? false,
      isDisabled: () => latest.current.disabled,
    };
    nodes.set(id, node);
    return () => {
      nodes.delete(id);
      if (focusedId === id) scheduleRepick();
    };
  }, [autoFocus, enabled, id, layer, ref, scroll]);

  return useSyncExternalStore(
    subscribe,
    () => padActive && focusedId === id,
    () => false,
  );
}

/** ScrollView biết cuộn tới ô đang được chọn. Dùng thay cho ScrollView ở mọi nơi có nút bên trong. */
export const FocusScroll = forwardRef<ScrollView, ScrollViewProps>(function FocusScroll({ onScroll, scrollEventThrottle, horizontal, ...rest }, forwarded) {
  const ref = useRef<ScrollView>(null);
  const offset = useRef({ x: 0, y: 0 });
  const parent = useContext(ScrollContext);
  const layer = useContext(LayerContext);
  useImperativeHandle(forwarded, () => ref.current as ScrollView, []);

  const target = useMemo<ScrollTarget>(
    () => ({ ref, horizontal: Boolean(horizontal), offset, parent }),
    [horizontal, parent],
  );

  // ScrollView dọc ngoài cùng của lớp là nơi cần phải / D-pad cuộn khi hết ô để nhảy.
  useEffect(() => {
    if (parent || horizontal || layerScrolls.has(layer)) return;
    layerScrolls.set(layer, target);
    return () => { if (layerScrolls.get(layer) === target) layerScrolls.delete(layer); };
  }, [horizontal, layer, parent, target]);

  const handleScroll = useCallback((event: NativeSyntheticEvent<NativeScrollEvent>) => {
    offset.current = { x: event.nativeEvent.contentOffset.x, y: event.nativeEvent.contentOffset.y };
    onScroll?.(event);
  }, [onScroll]);

  return (
    <ScrollContext.Provider value={target}>
      <ScrollView {...rest} ref={ref} horizontal={horizontal} onScroll={handleScroll} scrollEventThrottle={scrollEventThrottle ?? 16} />
    </ScrollContext.Provider>
  );
});
