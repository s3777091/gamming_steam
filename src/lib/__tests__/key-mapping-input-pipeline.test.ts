import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import * as controllerProtocol from '../controller-protocol.ts';
import { neutral, point, profile, binding, until } from './key-mapping-fixture.ts';

const hooks = registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context); } });
const { createMappingSink, MappingRuntime } = await import('../../features/key-mapping/runtime.ts');
hooks.deregister();
function loadModule(path: string, modules: Record<string, unknown>, globals: Record<string, unknown> = {}) {
  const output = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports: any = {};
  runInNewContext(output, { exports, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; }, console, Uint8Array, DataView, Map, Set, Date, setTimeout, clearTimeout, setInterval, clearInterval, ...globals });
  return exports;
}
function fixture() {
  const packets: { label: string; bytes: Uint8Array }[] = [];
  const moonlight = loadModule('../moonlight-native.ts', {
    'react-native-webrtc': {}, '@/lib/api': {}, '@/lib/controller-protocol': controllerProtocol,
    '@/lib/config': {}, '@/lib/ice-config': {}, '@/lib/stream-sdp': {},
  });
  // Run real packet encoding and real channel dispatch without a peer connection.
  const client = Object.create(moonlight.NativeMoonlightClient.prototype);
  client.channels = new Map(['MOUSE_RELIABLE', 'CONTROLLERS', 'CONTROLLER0'].map(label => [label, { readyState: 'open', send: (bytes: Uint8Array) => packets.push({ label, bytes }) }]));
  client.pendingPackets = new Map();
  client.inputReady = true; client.stopped = false;
  const engine = new MappingRuntime(createMappingSink(client));
  engine.activate(profile(), profile().game_id, profile().screenshot);
  const callbacks = new Map<string, Function>(); const effects: Function[] = []; const intervalCallbacks: Function[] = []; const delayed: Function[] = [];
  const devices = [{ nativeId: 7, kind: 'controller', bluetooth: true, rumble: false }];
  let onGuide: (() => void) | undefined; let guideCount = 0;
  const bridge = loadModule('../../features/stream/useInputBridge.ts', {
    react: { useRef: (value: unknown) => ({ current: value }), useEffect: (fn: Function) => effects.push(fn) },
    'jetsona-input': { addListener: (event: string, fn: Function) => { callbacks.set(event, fn); return () => callbacks.delete(event); }, getDevices: () => devices, setPointerCapture() {}, stopRumble() {}, rumble() {} },
    '@/features/devices/useInputDevices': { useInputDevices: () => ({ devices }), toLocal: (value: unknown) => value },
    '@/features/gamepad/captureMode': { useCaptureMode() {} },
    '@/features/gamepad/guideButton': { GUIDE_BUTTON: 0x20, listenGuideButton: (fn: () => void) => { onGuide = fn; return () => { onGuide = undefined; }; } },
    '@/features/settings/keycodes': { webCodeForKeyCode: () => null, vkForWebCode: () => null },
    '@/lib/input-settings': { applyDeadzone: (value: number) => value },
  }, {
    setTimeout: (fn: Function) => { delayed.push(fn); return delayed.length; },
    setInterval: (fn: Function) => { intervalCallbacks.push(fn); return intervalCallbacks.length; },
    clearInterval() {},
  });
  bridge.useInputBridge({ client, inputReady: true, live: true, guideOpen: false, mapping: engine,
    settingsRef: { current: { controllerLayout: 'xbox', triggerDeadzone: 0, leftDeadzone: 0, rightDeadzone: 0 } },
    onGuide: () => { guideCount++; }, onShortcut() {} });
  const cleanup = effects.map(fn => fn()).filter(fn => typeof fn === 'function');
  const emit = (buttons: number) => callbacks.get('onGamepadState')!({ ...neutral, deviceId: 7, buttons });
  return { client, engine, packets, emit, intervalCallbacks, delayed, guide: () => onGuide?.(), guideCount: () => guideCount, cleanup: () => { engine.disable(); cleanup.forEach(fn => fn()); } };
}

test('physical gamepad event executes mapping over the existing reliable mouse channel and preserves unassigned B', async () => {
  const f = fixture();
  f.emit(0x3000);
  await until(() => f.packets.filter(p => p.label === 'MOUSE_RELIABLE').length === 3);
  const mouse = f.packets.filter(p => p.label === 'MOUSE_RELIABLE');
  const position = new DataView(mouse[0].bytes.buffer);
  assert.equal(position.getUint8(0), 1); assert.equal(position.getInt16(1), Math.round(0.75 * 4096)); assert.equal(position.getInt16(3), Math.round(0.82 * 4096));
  assert.deepEqual(Array.from(mouse[1].bytes), [2, 1, 1]); assert.deepEqual(Array.from(mouse[2].bytes), [2, 0, 1]);
  for (const resend of [...f.delayed, ...f.intervalCallbacks]) resend();
  for (const p of f.packets.filter(p => p.label === 'CONTROLLER0').slice(1)) assert.equal(new DataView(p.bytes.buffer).getUint32(1), 0x2000);
  f.engine.disable(); f.emit(0x3000);
  assert.equal(new DataView(f.packets.filter(p => p.label === 'CONTROLLER0').at(-1)!.bytes.buffer).getUint32(1), 0x3000);
  f.cleanup();
});
test('Start + Select remains reserved and cancels a held mapped mouse state before opening GuideMenu', () => {
  const f = fixture(); const p = profile([binding({ physicalHold: true, steps: [{ type: 'hold', point, durationMs: 2000 }] })]);
  f.engine.activate(p, p.game_id, p.screenshot); f.emit(0x1000); f.emit(0x1030); f.guide();
  assert.equal(f.guideCount(), 1);
  assert.deepEqual(f.packets.filter(p => p.label === 'MOUSE_RELIABLE').map(p => Array.from(p.bytes)).slice(-1)[0], [2, 0, 1]);
  const lastPad = f.packets.filter(p => p.label === 'CONTROLLER0').at(-1)!;
  assert.equal(new DataView(lastPad.bytes.buffer).getUint32(1) & 0x30, 0);
  f.cleanup();
});
test('a dropped channel cannot queue a delayed mapping click for a later reconnection', async () => {
  const f = fixture();
  const p = profile([binding({ steps: [{ type: 'wait', durationMs: 10 }, { type: 'tap', point, durationMs: 2 }] })]);
  f.engine.activate(p, p.game_id, p.screenshot);
  f.emit(0x1000); f.client.channels.get('MOUSE_RELIABLE').readyState = 'closed';
  await until(() => !f.engine.activeProfile);
  assert.equal(f.client.pendingPackets.size, 0);
  assert.equal(f.packets.filter(p => p.label === 'MOUSE_RELIABLE').length, 0);
  f.cleanup();
});
