import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

test('device hook recovers missed startup and foreground events and removes listeners', () => {
  const states: any[] = [];
  const effects: (() => (() => void))[] = [];
  const listeners = new Map<string, Function>();
  let connected: any[] = [];
  let onAppState: (state: string) => void = () => {};
  let removedAppState = false;
  const device = { id: 'input:1', nativeId: 1, name: 'Controller', kind: 'controller',
    bluetooth: false, battery: -1, rumble: false, transport: 'unknown' };
  const modules: Record<string, any> = {
    react: {
      useState: (initial: Function) => {
        const slot = states.length;
        states.push(initial());
        return [states[slot], (value: unknown) => { states[slot] = value; }];
      },
      useEffect: (effect: typeof effects[number]) => effects.push(effect),
      useCallback: (callback: Function) => callback,
    },
    'react-native': {
      Platform: { OS: 'ios' }, PermissionsAndroid: {},
      AppState: { addEventListener: (_: string, listener: typeof onAppState) => {
        onAppState = listener;
        return { remove: () => { removedAppState = true; } };
      } },
    },
    'jetsona-input': {
      getDevices: () => connected,
      getBluetooth: () => ({ supported: true, stateKnown: false }),
      addListener: (name: string, listener: Function) => {
        listeners.set(name, listener);
        return () => listeners.delete(name);
      },
    },
  };
  const source = readFileSync(new URL('../../features/devices/useInputDevices.ts', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
  const exports: any = {};
  runInNewContext(output, { exports, require: (name: string) => {
    assert.ok(name in modules, name);
    return modules[name];
  } });
  exports.useInputDevices();
  assert.equal(states[0].length, 0);
  // Connect after render but before subscriptions exist.
  connected = [device];
  const cleanup = effects[0]();
  assert.equal(states[0][0].name, 'Controller');
  assert.equal(states[0][0].battery, null);
  // A disconnect while backgrounded need not deliver a JS event.
  connected = [];
  onAppState('background');
  assert.equal(states[0].length, 1);
  onAppState('active');
  assert.equal(states[0].length, 0);
  listeners.get('onDevicesChanged')!({ devices: [device] });
  assert.equal(states[0].length, 1);
  cleanup();
  assert.equal(listeners.size, 0);
  assert.equal(removedAppState, true);
});
