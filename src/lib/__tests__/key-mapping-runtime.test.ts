import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { binding, neutral, point, profile, sleep, tap, until } from './key-mapping-fixture.ts';

const hooks = registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) return next(`${specifier}.ts`, context);
  return next(specifier, context);
} });
const { MappingRuntime } = await import('../../features/key-mapping/runtime.ts');
const { canvasPoint, geometryCompatible, pressedControls, stripMappedInputs, validateProfile } = await import('../../features/key-mapping/model.ts');
hooks.deregister();

function fixture(random = () => 0.5) {
  const events: unknown[][] = []; const errors: Error[] = [];
  const engine = new MappingRuntime({ sendMousePosition: (...args) => { events.push(['position', ...args]); }, sendMouseButton: (...args) => { events.push(['button', ...args]); } }, error => errors.push(error), random);
  engine.activate(profile(), 'steam-123', { width: 1280, height: 720 });
  const press = (buttons = 0x1000, device = 1) => engine.process(device, { ...neutral, buttons });
  const release = (device = 1) => engine.process(device, neutral);
  const buttons = () => events.filter(e => e[0] === 'button');
  return { engine, events, errors, press, release, buttons };
}

test('tap reaches the existing mouse sink, strips only assigned controls, and debounces held input', async () => {
  const f = fixture();
  f.press(); f.press(); await sleep();
  assert.deepEqual(f.events, [['position', 0.75, 0.82, true], ['button', true, 1], ['button', false, 1]]);
  assert.deepEqual(f.engine.filter({ ...neutral, buttons: 0x3000 }), { ...neutral, buttons: 0x2000 });
  f.engine.disable(); assert.deepEqual(f.engine.filter({ ...neutral, buttons: 0x3000 }), { ...neutral, buttons: 0x3000 });
});
test('profile switching and disabling cancel delays without late clicks', async () => {
  for (const switching of [false, true]) {
    const f = fixture(); const p = profile([binding({ steps: [{ type: 'wait', durationMs: 30 }, tap] })]);
    f.engine.activate(p, p.game_id, p.screenshot); f.press();
    if (switching) f.engine.activate(profile(), p.game_id, p.screenshot); else f.engine.disable();
    await sleep(50); assert.deepEqual(f.events, []); f.engine.disable();
  }
});
test('physical hold releases synchronously on button-up and disable, without duplicate releases', async () => {
  for (const disable of [false, true]) {
    const f = fixture(); const p = profile([binding({ physicalHold: true, steps: [{ type: 'hold', point, durationMs: 1000 }] })]);
    f.engine.activate(p, p.game_id, p.screenshot); f.press();
    assert.deepEqual(f.buttons(), [['button', true, 1]]);
    if (disable) f.engine.disable(); else f.release();
    assert.deepEqual(f.buttons(), [['button', true, 1], ['button', false, 1]]);
    await sleep(); assert.equal(f.buttons().length, 2); f.engine.disable();
  }
});
test('double tap and bounded macro steps preserve ordering', async () => {
  const f = fixture(); const p = profile([binding({ repeat: 2, steps: [{ type: 'double', point, durationMs: 1, intervalMs: 2 }, { type: 'wait', durationMs: 1 }, tap] })]);
  f.engine.activate(p, p.game_id, p.screenshot); f.press(); await until(() => f.buttons().length === 12);
  assert.deepEqual(f.buttons(), Array.from({ length: 6 }, () => [['button', true, 1], ['button', false, 1]]).flat());
  f.engine.disable();
});
test('random delay is selected afresh for each press and never changes coordinates', async () => {
  let randomCalls = 0;
  const f = fixture(() => randomCalls++ % 2 ? 0.9 : 0.1);
  const p = profile([binding({ steps: [{ type: 'random', minMs: 1.5, maxMs: 3.5 }, tap] })]);
  f.engine.activate(p, p.game_id, p.screenshot);
  f.press(); await sleep(); f.release(); f.press(); await sleep();
  assert.equal(randomCalls, 2);
  assert.deepEqual(f.events.filter(e => e[0] === 'position'), [['position', 0.75, 0.82, true], ['position', 0.75, 0.82, true]]);
  f.engine.disable();
});
test('drag moves the held remote pointer to its endpoint and cancellation releases it', async () => {
  for (const cancel of [false, true]) {
    const f = fixture(); const p = profile([binding({ steps: [{ type: 'drag', point, end: { x: 0.1, y: 0.2 }, durationMs: 25, initialHoldMs: 1 }] })]);
    f.engine.activate(p, p.game_id, p.screenshot); f.press();
    if (cancel) f.engine.cancel();
    await sleep(60);
    assert.deepEqual(f.buttons(), [['button', true, 1], ['button', false, 1]]);
    if (!cancel) assert.deepEqual(f.events.filter(e => e[0] === 'position').at(-1), ['position', 0.1, 0.2, true]);
    f.engine.disable();
  }
});
test('longest combo suppresses singles within the chord window and releasing the combo does not trigger a single', async () => {
  const f = fixture(); const p = profile([binding(), binding({ id: 'combo', controls: ['l1', 'a'], steps: [{ ...tap, point: { x: 0.2, y: 0.3 } }] })]);
  f.engine.activate(p, p.game_id, p.screenshot); f.press(); f.press(0x1100);
  await sleep(80); f.press(); await sleep(80);
  assert.deepEqual(f.events.filter(e => e[0] === 'position'), [['position', 0.2, 0.3, true]]); f.engine.disable();
});
test('quick single taps still execute when a combo shares the button', async () => {
  const f = fixture(); const p = profile([binding(), binding({ id: 'combo', controls: ['l1', 'a'] })]);
  f.engine.activate(p, p.game_id, p.screenshot); f.press(); f.release(); await sleep(90);
  assert.equal(f.buttons().length, 2); f.engine.disable();
});
test('menu suspension, controller disconnection, and geometry changes cancel active work', async () => {
  for (const action of ['pause', 'disconnect', 'geometry'] as const) {
    const f = fixture(); const p = profile([binding({ steps: [{ type: 'hold', point, durationMs: 1000 }, tap] })]);
    f.engine.activate(p, p.game_id, p.screenshot); f.press();
    if (action === 'pause') f.engine.setPaused(true);
    if (action === 'disconnect') f.engine.disconnect(1);
    if (action === 'geometry') f.engine.checkGeometry({ width: 1024, height: 768 });
    assert.deepEqual(f.buttons(), [['button', true, 1], ['button', false, 1]]);
    await sleep(); assert.equal(f.buttons().length, 2); f.engine.disable();
  }
});
test('menu-held controls must be released before resuming mapping', async () => {
  const f = fixture(); f.engine.setPaused(true); f.press(); f.engine.setPaused(false); f.press(); await sleep(); assert.equal(f.events.length, 0);
  f.release(); f.press(); await sleep(); assert.equal(f.buttons().length, 2); f.engine.disable();
});
test('one mouse pointer serializes concurrent mappings and cancellation removes queued jobs', async () => {
  const f = fixture(); const p = profile([binding({ steps: [{ type: 'hold', point, durationMs: 1000 }] }), binding({ id: 'b', controls: ['b'] })]);
  f.engine.activate(p, p.game_id, p.screenshot); f.press(); f.press(0x3000);
  assert.equal(f.buttons().length, 1); f.engine.disable(); await sleep(); assert.equal(f.buttons().length, 2);
});
test('validation rejects reserved controls, duplicate triggers, invalid times, bad ranges and unbounded repeats', () => {
  for (const b of [binding({ controls: ['start' as never] }), binding({ repeat: 0 }), binding({ repeat: 21 }), binding({ point: { x: NaN, y: 0 } }), binding({ steps: [{ type: 'random', minMs: 5, maxMs: 1 }] }), binding({ steps: [{ type: 'wait', durationMs: Infinity }] }), binding({ repeat: 20, steps: [{ type: 'hold', point, durationMs: 60_000 }] })]) assert.throws(() => validateProfile(profile([b])));
  assert.throws(() => validateProfile(profile([binding(), binding({ id: 'duplicate' })])));
  const f = fixture(); assert.throws(() => f.engine.activate(profile(), 'another-game', { width: 1920, height: 1080 })); f.engine.disable();
});
test('coordinate conversion rejects letterboxing, accounts for zoom/pan, and detects incompatible geometry', () => {
  assert.equal(canvasPoint(0, 0, { width: 1000, height: 1000 }, { width: 1920, height: 1080 }), null);
  assert.deepEqual(canvasPoint(500, 500, { width: 1000, height: 1000 }, { width: 1920, height: 1080 }), { x: 0.5, y: 0.5 });
  const zoomed = canvasPoint(600, 550, { width: 1000, height: 1000 }, { width: 1920, height: 1080 }, 2, { x: 100, y: 50 })!;
  assert.ok(Math.abs(zoomed.x - 0.5) < 1e-12 && Math.abs(zoomed.y - 0.5) < 1e-12);
  assert.equal(geometryCompatible({ width: 1920, height: 1080 }, { width: 1280, height: 720 }), true);
  assert.equal(geometryCompatible({ width: 1920, height: 1080 }, { width: 1080, height: 1920 }), false);
});
test('native trigger/stick conventions and unassigned directions survive filtering', () => {
  const down = pressedControls({ ...neutral, lt: 0.8, ly: -0.7, rx: 0.9 });
  assert.deepEqual([...down], ['l2', 'ls-up', 'rs-right']);
  assert.equal(stripMappedInputs({ ...neutral, ly: 0.8 }, [binding({ controls: ['ls-up'] })]).ly, 0.8);
  assert.equal(stripMappedInputs({ ...neutral, ly: -0.8 }, [binding({ controls: ['ls-up'] })]).ly, 0);
});
test('queue overload stops mapping and cannot leave queued actions behind', async () => {
  const f = fixture(); const p = profile([binding({ steps: [{ type: 'hold', point, durationMs: 1000 }] })]);
  f.engine.activate(p, p.game_id, p.screenshot);
  for (let device = 1; device <= 34; device++) f.press(0x1000, device);
  assert.equal(f.engine.activeProfile, null); assert.equal(f.errors.length, 1);
  await sleep(); assert.deepEqual(f.buttons(), [['button', true, 1], ['button', false, 1]]);
});
test('failure while releasing remote input stops mapping without an unhandled rejection', async () => {
  const errors: Error[] = [];
  const engine = new MappingRuntime({ sendMousePosition() {}, sendMouseButton(down) { if (!down) throw new Error('channel closed during release'); } }, error => errors.push(error));
  engine.activate(profile(), profile().game_id, profile().screenshot); engine.process(1, { ...neutral, buttons: 0x1000 });
  await until(() => !engine.activeProfile);
  assert.equal(errors.length, 1); assert.match(errors[0].message, /channel closed/);
});
