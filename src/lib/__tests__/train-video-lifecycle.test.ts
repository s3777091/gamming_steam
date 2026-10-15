import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { OPENING_DISSOLVE_TIME, OPENING_FINISH_TIME } from '../loading-sequence.ts';

const componentSource = readFileSync(new URL('../../features/stream/TrainVideo.tsx', import.meta.url), 'utf8');

function mount(opening: boolean, playing = true, volume = 0.5) {
  let released = false;
  const calls: string[] = [];
  const effects: (() => void | (() => void))[] = [];
  const listeners = new Map<string, (event: unknown) => void>();
  const callbacks: string[] = [];
  const player = {
    loop: false, muted: false, volume: 1, audioMixingMode: 'auto', timeUpdateEventInterval: 0,
    play() { assert.equal(released, false, 'play after native release'); calls.push('play'); },
    pause() { assert.equal(released, false, 'pause after native release'); calls.push('pause'); },
    release() { assert.equal(released, false); released = true; calls.push('release'); },
  };
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const modules: Record<string, unknown> = {
    'react': { useState: () => [false, () => {}], useEffect: (effect: typeof effects[number]) => effects.push(effect) },
    'react/jsx-runtime': { jsx, jsxs: jsx },
    'react-native': { View: 'View', StyleSheet: { absoluteFill: {} } },
    'expo': { useEventListener: (_player: unknown, event: string, listener: (event: unknown) => void) => listeners.set(event, listener) },
    'expo-image': { Image: 'Image' },
    'expo-video': {
      VideoView: 'VideoView',
      useVideoPlayer: (_source: unknown, setup: (value: typeof player) => void) => {
        setup(player);
        // Expo SDK 57 registers release before the component's later effects.
        effects.push(() => () => player.release());
        return player;
      },
    },
    '@/lib/loading-sequence': { OPENING_DISSOLVE_TIME, OPENING_FINISH_TIME },
  };
  const exports: { TrainVideo?: (props: unknown) => unknown } = {};
  const compiled = ts.transpileModule(componentSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX },
  }).outputText;
  runInNewContext(compiled, {
    exports,
    require: (name: string) => {
      if (name.includes('assets/video/')) return name;
      assert.ok(name in modules, `unexpected import: ${name}`);
      return modules[name];
    },
  });
  exports.TrainVideo!({ opening, playing, volume, onDissolve: () => callbacks.push('dissolve'), onEnded: () => callbacks.push('ended') });
  const cleanups = effects.map((effect) => effect()).filter((cleanup): cleanup is () => void => typeof cleanup === 'function');
  return { player, calls, callbacks, listeners, unmount: () => cleanups.forEach((cleanup) => cleanup()) };
}

test('loading video unmount lets Expo release without pausing a released native player', () => {
  const waiting = mount(false);
  assert.deepEqual(waiting.calls, ['play']);
  assert.doesNotThrow(waiting.unmount);
  assert.deepEqual(waiting.calls, ['play', 'release']);
});

test('waiting to opening to game reveal disposes both players without crashing', () => {
  const waiting = mount(false);
  waiting.unmount();
  const opening = mount(true);
  opening.listeners.get('timeUpdate')?.({ currentTime: OPENING_FINISH_TIME });
  assert.deepEqual(opening.callbacks, ['dissolve', 'ended']);
  assert.doesNotThrow(opening.unmount);
  assert.deepEqual(opening.calls, ['play', 'release']);
});

test('backgrounded or failed loading pauses only while the video is still owned', () => {
  const paused = mount(false, false);
  assert.deepEqual(paused.calls, ['pause']);
  assert.doesNotThrow(paused.unmount);
  assert.deepEqual(paused.calls, ['pause', 'release']);
});

test('train audio follows the UI sound volume and mutes at zero', () => {
  const audible = mount(false);
  assert.equal(audible.player.muted, false);
  assert.equal(audible.player.volume, 0.5);
  assert.equal(audible.player.audioMixingMode, 'mixWithOthers');
  const silent = mount(true, true, 0);
  assert.equal(silent.player.muted, true);
});
