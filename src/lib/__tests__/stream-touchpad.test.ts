import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    const mocks: Record<string, string> = {
      'react-native': 'export const PanResponder={create:(handlers)=>({panHandlers:handlers})};export const Dimensions={get:()=>({width:1000,height:500})};export const PixelRatio={get:()=>1};',
      'jetsona-input': 'export const getDisplayInfo=()=>null;',
      '@/lib/input-settings': 'export const DEFAULT_INPUT_SETTINGS={invertScroll:false,scrollSensitivity:1};',
      '@/lib/moonlight-native': 'export const NativeMouseButton={LEFT:1,RIGHT:3};',
    };
    if (mocks[specifier]) return { url: `data:text/javascript,${encodeURIComponent(mocks[specifier])}`, shortCircuit: true };
    if (specifier.startsWith('@/lib/')) {
      return nextResolve(new URL(`../${specifier.slice('@/lib/'.length)}.ts`, import.meta.url).href, context);
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return nextResolve(`${specifier}.ts`, context);
    return nextResolve(specifier, context);
  },
});
const { StreamTouchpad } = await import('../../features/stream/StreamTouchpad.ts');
hooks.deregister();

function fixture() {
  const calls: unknown[][] = [];
  const client = {
    sendMousePosition: (...args: unknown[]) => calls.push(['move', ...args]),
    sendMouseButton: (...args: unknown[]) => calls.push(['button', ...args]),
    sendScroll: (...args: unknown[]) => calls.push(['scroll', ...args]),
  };
  const touchpad = new StreamTouchpad();
  const context = {
    live: true, videoSize: { width: 1920, height: 960 }, stage: { width: 1000, height: 500 },
    getClient: () => client as never,
    getSettings: () => ({ invertScroll: false, scrollSensitivity: 1 }) as never,
  };
  touchpad.update(context);
  type Handler = (...args: unknown[]) => unknown;
  const handlers = touchpad.panHandlers as unknown as Record<string, Handler>;
  const point = (x: number, y: number, fingers = 1) => ({
    nativeEvent: { locationX: x, locationY: y, touches: Array.from({ length: fingers }, () => ({ locationX: x, locationY: y })) },
  });
  return { calls, client, touchpad, context, handlers, point };
}

test('one-finger and two-finger taps map to left/right clicks at the correct video position', () => {
  for (const fingers of [1, 2]) {
    const f = fixture();
    f.handlers.onPanResponderGrant(f.point(500, 250, fingers), { numberActiveTouches: fingers });
    f.handlers.onPanResponderRelease();
    assert.deepEqual(f.calls, [['move', 0.5, 0.5, true], ['button', true, fingers === 1 ? 1 : 3], ['button', false, fingers === 1 ? 1 : 3]]);
  }
});

test('drag sends exactly one press and releases on termination or loss of a live stream', () => {
  for (const terminate of [true, false]) {
    const f = fixture();
    f.handlers.onPanResponderGrant(f.point(100, 100), { numberActiveTouches: 1 });
    f.handlers.onPanResponderMove(f.point(150, 100), { numberActiveTouches: 1 });
    f.handlers.onPanResponderMove(f.point(200, 100), { numberActiveTouches: 1 });
    if (terminate) f.handlers.onPanResponderTerminate();
    else f.touchpad.update({ ...f.context, live: false });
    f.touchpad.release();
    assert.deepEqual(f.calls.filter((call) => call[0] === 'button'), [['button', true, 1], ['button', false, 1]]);
  }
});

test('two-finger scrolling reads current sensitivity and inversion without generating a click', () => {
  const f = fixture();
  f.handlers.onPanResponderGrant(f.point(100, 100, 2), { numberActiveTouches: 2 });
  f.handlers.onPanResponderMove(f.point(100, 120, 2), { numberActiveTouches: 2 });
  f.touchpad.update({ ...f.context, getSettings: () => ({ invertScroll: true, scrollSensitivity: 2 }) as never });
  f.handlers.onPanResponderMove(f.point(100, 140, 2), { numberActiveTouches: 2 });
  f.handlers.onPanResponderRelease();
  assert.deepEqual(f.calls, [['scroll', 0, -60], ['scroll', 0, 120]]);
});

test('updating screen geometry keeps the handlers stable and uses the new touch coordinates', () => {
  const f = fixture();
  const handlers = f.touchpad.panHandlers;
  f.touchpad.update({ ...f.context, stage: { width: 2000, height: 1000 } });
  f.handlers.onPanResponderGrant(f.point(1000, 500), { numberActiveTouches: 1 });
  f.handlers.onPanResponderRelease();
  assert.equal(f.touchpad.panHandlers, handlers);
  assert.deepEqual(f.calls[0], ['move', 0.5, 0.5, true]);
});

test('replacing a connection releases a drag on its original client', () => {
  const f = fixture();
  f.handlers.onPanResponderGrant(f.point(100, 100), { numberActiveTouches: 1 });
  f.handlers.onPanResponderMove(f.point(150, 100), { numberActiveTouches: 1 });
  f.touchpad.update({ ...f.context, getClient: () => null });
  assert.deepEqual(f.calls.filter((call) => call[0] === 'button'), [['button', true, 1], ['button', false, 1]]);
});

test('VDD touch coordinates follow the un-stretched video when the viewport differs slightly', () => {
  const f = fixture();
  f.touchpad.update({ ...f.context, videoSize: { width: 2560, height: 1440 }, allowStretch: false });
  const videoWidth = 500 * 2560 / 1440;
  const left = (1000 - videoWidth) / 2;
  f.handlers.onPanResponderGrant(f.point(left + videoWidth * 0.25, 125), { numberActiveTouches: 1 });
  f.handlers.onPanResponderRelease();
  assert.ok(Math.abs(Number(f.calls[0][1]) - 0.25) < 1e-10);
  assert.equal(f.calls[0][2], 0.25);
});
