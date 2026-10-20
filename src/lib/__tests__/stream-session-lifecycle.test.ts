import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}
async function until(check: () => boolean) {
  for (let turn = 0; turn < 30; turn++) {
    if (check()) return;
    await new Promise(setImmediate);
  }
  assert.ok(check(), 'session did not reach the expected state');
}

const local = {
  ok: true, width: 1920, height: 1080, displayMode: 'virtual', displayState: 'local',
  canSwitchResolution: true, captureTargetStale: false, displays: 1, watchdogReady: true, restoreVerified: true,
  modes: [{ width: 2560, height: 1440, refreshRates: [60, 120] }],
  current: [{ width: 1920, height: 1080, refreshHz: 100 }],
};

// Run the real hook, parser, readiness checks and setup lock. React, cloud and
// native/network boundaries are controlled so late claims can be reproduced.
function fixture() {
  const events: string[] = [];
  const callbacks: Record<string, (...args: any[]) => void>[] = [];
  const handles = [] as Record<string, unknown>[];
  let state: unknown[] = [];
  let effects: (() => void | (() => void))[] = [];
  let index = 0;
  let claimCount = 0;
  const control = {
    display: () => Promise.resolve(new Response(JSON.stringify(local))),
    claim: () => Promise.resolve({ sessionId: `cloud-${claimCount}`, setupToken: 'setup', generation: 1 }),
    release: () => Promise.resolve(),
  };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: {}, error: null }) };
  const cloud = { auth: { getSession: async () => ({ data: { session: { access_token: 'test' } } }) }, from: () => query };
  const modules: Record<string, unknown> = {
    react: {
      useState: (value: unknown) => {
        const slot = index++;
        const current = state;
        current[slot] = value;
        return [value, (next: unknown) => { current[slot] = typeof next === 'function' ? next(current[slot]) : next; }];
      },
      useEffect: (effect: typeof effects[number]) => { effects.push(effect); },
      useLayoutEffect: (effect: () => void) => effect(),
      useCallback: (callback: unknown) => callback,
      useRef: (current: unknown) => ({ current }),
    },
    'react-native': { AppState: { addEventListener: () => ({ remove() {} }) } },
    'jetsona-input': { setStreamFrameRate() {}, startSpeakerRoute() {}, stopSpeakerRoute() {} },
    '@/lib/client-device': { ensureClientDeviceId: async () => 'device' },
    '@/lib/detect-region': { detectRegion: async () => 'vn' },
    '@/lib/display-refresh': { displayRefreshHz: async () => 120 },
    '@/lib/friendly': { describeError: (error: unknown) => error instanceof Error ? error.message : String(error) },
    '@/lib/loading-themes': { DEFAULT_LOADING_THEME_ID: 'deep_space' },
    '@/lib/moonlight-native': {
      fetchMoonlightTarget: async () => ({ hostId: 1, appId: 1 }),
      NativeMoonlightClient: class {
        constructor(...args: unknown[]) { callbacks.push(args[5] as typeof callbacks[number]); }
        start() { events.push('start'); }
        stop() { events.push('stop'); }
      },
    },
    '@/lib/pc-api': {
      PC_ROUTES: { display: '/display' },
      pcFetchJson: async () => {
        const response = await control.display();
        if (!response.ok) throw new Error('display unavailable');
        return response.json();
      },
    },
    '@/lib/realtime-channels': {},
    '@/lib/session-lease': {
      claimLease: () => { claimCount++; events.push('claim'); return control.claim(); },
      heartbeatLeaseRpc: async () => true,
      postSessionClaim: async () => { events.push('host-claim'); return { ok: true }; },
      postSessionRelease: (handle: Record<string, unknown>) => { events.push('release'); handles.push(handle); return control.release(); },
      releaseLeaseRpc: async () => {}, postSessionBeat: async () => 200, watchSessionReleased: () => () => {},
    },
    '@/lib/setup-token': { createStreamSetupToken: () => 'setup' },
    '@/lib/input-settings': { DEFAULT_INPUT_SETTINGS: {}, loadInputSettings: async () => ({}), subscribeInputSettings: () => () => {} },
    '@/lib/stream-device': { detectStreamDeviceClass: () => 'large' },
    '@/lib/stream-network': { fetchDeviceNetworkMeasurement: async () => null },
    '@/lib/stream-settings': {
      STREAM_SETTINGS_TABLE: { large: 'stream_settings' }, fetchStreamSettingsDefaults: async () => null,
      completeSettings: () => ({ loading_theme: 'deep_space' }),
      resolveMoonlightSettings: () => ({ fps: 120, videoSizeCustom: { width: 2560, height: 1440 }, videoCodec: 'h264' }),
    },
    '@/lib/stream-settings-events': { subscribeStreamSettings: () => () => {} },
    '@/lib/supabase': { createClient: () => cloud },
  };
  function load(path: string): any {
    if (modules[path]) return modules[path];
    const file = resolve('src/lib', `${path.slice('@/lib/'.length)}.ts`);
    return compile(file, path);
  }
  function compile(file: string, key: string): any {
    const exports = {};
    modules[key] = exports;
    const compiled = ts.transpileModule(readFileSync(file, 'utf8'), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
    }).outputText;
    runInNewContext(compiled, { exports, require: load, setTimeout, clearTimeout, setInterval: () => 1, clearInterval() {}, Error });
    return exports;
  }
  const { useStreamSession } = compile(resolve('src/features/stream/useStreamSession.ts'), 'hook');
  function SessionMount() {
    state = []; effects = []; index = 0;
    useStreamSession({ userId: 'user', attempt: 0, onBackground() {} });
    const mountedState = state;
    const cleanup = effects.map(effect => effect()).filter((value): value is () => void => typeof value === 'function');
    return { get phase() { return mountedState[0]; }, unmount: () => cleanup.forEach(stop => stop()) };
  }
  return { mount: SessionMount, control, events, callbacks, handles };
}

test('an unsafe VDD is rejected before any cloud claim or native connection', async () => {
  const f = fixture();
  f.control.display = async () => new Response(JSON.stringify({ ...local, watchdogReady: false }));
  const session = f.mount();
  await until(() => session.phase === 'error');
  assert.deepEqual(f.events, []);
  session.unmount();
});

test('an unavailable display probe cannot silently open a physical fallback session', async () => {
  const f = fixture();
  f.control.display = async () => new Response('{}', { status: 503 });
  const session = f.mount();
  await until(() => session.phase === 'error');
  assert.deepEqual(f.events, []);
  session.unmount();
});

test('mobile waits for a fresh applied mode before allowing the game-launch gate to open', async () => {
  const f = fixture();
  const session = f.mount();
  await until(() => f.events.includes('start'));
  const probe = deferred<Response>();
  f.control.display = () => probe.promise;
  f.callbacks[0].onStream('video');
  assert.equal(session.phase, 'connecting');
  probe.resolve(new Response(JSON.stringify({ ...local, displayState: 'streaming', current: [{ width: 2560, height: 1440, refreshHz: 120 }] })));
  await until(() => session.phase === 'live');
  // Decoding a different frame must close media and release the same lease.
  f.callbacks[0].onVideoDimensions({ width: 1920, height: 1080 });
  assert.equal(session.phase, 'error');
  assert.ok(f.events.indexOf('stop') < f.events.indexOf('release'));
  session.unmount();
});

test('wrong applied Hz and an unavailable verification endpoint both stop the stream', async () => {
  for (const response of [
    new Response(JSON.stringify({ ...local, displayState: 'streaming', current: [{ width: 2560, height: 1440, refreshHz: 100 }] })),
    new Response('{}', { status: 503 }),
  ]) {
    const f = fixture();
    const session = f.mount();
    await until(() => f.events.includes('start'));
    f.control.display = async () => response;
    f.callbacks[0].onStream('video');
    await until(() => session.phase === 'error');
    assert.deepEqual(f.events.slice(-2), ['stop', 'release']);
    session.unmount();
  }
});

test('unmount during a cloud claim releases its late lease before retry can claim the PC', async () => {
  const f = fixture();
  const claim = deferred<{ sessionId: string; setupToken: string; generation: number }>();
  const release = deferred<void>();
  f.control.claim = () => claim.promise;
  f.control.release = () => release.promise;
  const first = f.mount();
  await until(() => f.events.includes('claim'));
  first.unmount();
  const second = f.mount();
  claim.resolve({ sessionId: 'late-cloud', setupToken: 'late-setup', generation: 7 });
  await until(() => f.events.includes('release'));
  assert.equal(f.events.filter(event => event === 'claim').length, 1);
  assert.equal(f.handles[0].cloudSessionId, 'late-cloud');
  assert.equal(f.handles[0].setupGeneration, 7);
  f.control.claim = async () => ({ sessionId: 'next-cloud', setupToken: 'next-setup', generation: 8 });
  release.resolve();
  await until(() => f.events.filter(event => event === 'claim').length === 2);
  second.unmount();
  await until(() => f.handles.length === 2);
});
