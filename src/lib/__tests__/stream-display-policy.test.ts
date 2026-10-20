import assert from 'node:assert/strict';
import { registerHooks } from 'node:module';
import test from 'node:test';

import { autoFrameRate, panelResolution, preferredRefreshHz } from '../stream-display-policy.ts';

// Only hardware and unrelated loading artwork are replaced; exercise the real
// resolver, geometry, cloud-default merge and native display reader together.
const hardware = `
  export const getDisplayInfo = () => ({
    widthPx: 1600, heightPx: 2560, refreshRate: 60,
    supportedRefreshRates: [60, 90, 120],
  });
  export const Dimensions = { get: () => ({ width: 400, height: 640 }) };
  export const PixelRatio = { get: () => 2 };
`;
const hooks = registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === 'react-native' || specifier === 'jetsona-input') {
      return { url: `data:text/javascript,${encodeURIComponent(hardware)}`, shortCircuit: true };
    }
    if (specifier === './loading-themes') {
      return {
        url: 'data:text/javascript,export const DEFAULT_LOADING_THEME_ID="deep_space";export const isLoadingThemeId=(v)=>v==="deep_space";',
        shortCircuit: true,
      };
    }
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      return nextResolve(`${specifier}.ts`, context);
    }
    return nextResolve(specifier, context);
  },
});
const { completeSettings, clientDisplayGeometry, fetchStreamSettingsDefaults, resolveMoonlightSettings } = await import('../stream-settings.ts');
const { displayRefreshHz } = await import('../display-refresh.ts');
const { applyStreamHostPolicy, applyStreamTargetTransportPolicy, streamHostReadinessIssue } = await import('../stream-host-policy.ts');
const { assertVirtualDisplayStream, parseHostDisplay } = await import('../stream-display.ts');
hooks.deregister();

test('Auto sees 120 Hz capability while the panel is idling at 60 Hz', async () => {
  assert.equal(await displayRefreshHz(), 120);
  assert.equal(autoFrameRate(preferredRefreshHz(60, [60, 119.88])), 120);
});

test('native pixel dimensions take precedence over scaled layout dimensions', () => {
  assert.deepEqual(clientDisplayGeometry(), { width: 2560, height: 1600 });
});

test('compact tablet in phone storage class gets full 2560x1600 at 144 FPS', () => {
  const stream = resolveMoonlightSettings(completeSettings('user'), { bandwidthMbps: 200 }, null, 144, { width: 2560, height: 1600 }, 'phone');
  assert.deepEqual(stream.videoSizeCustom, { width: 2560, height: 1600 });
  assert.equal(stream.fps, 144);
  assert.ok(stream.bitrate > 38_000);
});

test('between-tier tablet is not downscaled before being enlarged on the client', () => {
  assert.equal(panelResolution(2732), '1800p');
  const stream = resolveMoonlightSettings(completeSettings('user'), null, null, 120, { width: 2732, height: 2048 }, 'large');
  assert.deepEqual(stream.videoSizeCustom, { width: 2732, height: 2048 });
  assert.equal(stream.fps, 120);
});

test('weak measured network lowers automatic FPS/bitrate and preserves desktop geometry', () => {
  const stream = resolveMoonlightSettings(completeSettings('user'), { bandwidthMbps: 20 }, null, 120, { width: 2560, height: 1600 }, 'phone');
  assert.deepEqual(stream.videoSizeCustom, { width: 2560, height: 1600 });
  assert.equal(stream.fps, 60);
  assert.ok(stream.bitrate <= 16_000);
});

test('host modes still constrain the actual capture resolution', () => {
  const stream = resolveMoonlightSettings(completeSettings('user'), null, {
    width: 1920, height: 1080, canSwitchResolution: true,
    modes: [{ width: 1920, height: 1080 }, { width: 2560, height: 1600 }],
  }, 120, { width: 2560, height: 1600 }, 'phone');
  assert.deepEqual(stream.videoSizeCustom, { width: 2560, height: 1600 });
});

// Modes \\.\DISPLAY1 on the home PC actually reports (Samsung 1920x1080 panel).
const HOME_PC_MODES = [
  { width: 1280, height: 800 }, { width: 1440, height: 900 }, { width: 1600, height: 900 },
  { width: 1600, height: 1024 }, { width: 1680, height: 1050 }, { width: 1920, height: 1080 },
];
const TABLET = { width: 2800, height: 1752 };
const homePc = (modes: { width: number; height: number }[]) => applyStreamHostPolicy({
  width: 1920, height: 1080, canSwitchResolution: true, modes,
}, 'pc');

test('16:10 tablet keeps the only 16:10 mode when the PC has nothing much sharper', () => {
  const stream = resolveMoonlightSettings(completeSettings('user'), null, homePc(HOME_PC_MODES), 120, TABLET, 'large');
  assert.deepEqual(stream.videoSizeCustom, { width: 1680, height: 1050 });
});

test('DSR modes beat a much smaller aspect-matched mode on a high-DPI tablet', () => {
  const dsr178 = homePc([...HOME_PC_MODES, { width: 2560, height: 1440 }]);
  assert.deepEqual(
    resolveMoonlightSettings(completeSettings('user'), null, dsr178, 120, TABLET, 'large').videoSizeCustom,
    { width: 2560, height: 1440 },
  );
  const dsr225 = homePc([...HOME_PC_MODES, { width: 2560, height: 1440 }, { width: 2880, height: 1620 }]);
  assert.deepEqual(
    resolveMoonlightSettings(completeSettings('user'), null, dsr225, 120, TABLET, 'large').videoSizeCustom,
    { width: 2880, height: 1620 },
  );
});

// Same panel with the refresh rates EnumDisplaySettings reports: 100 Hz is the
// ceiling at every size, there is no 120/144.
const HOME_PC_MODES_HZ = HOME_PC_MODES.map((mode) => ({ ...mode, refreshRates: [59, 60, 100] }));

test('Auto FPS on a 120 Hz tablet follows the 100 Hz home PC instead of asking for 120', () => {
  const stream = resolveMoonlightSettings(completeSettings('user'), null, homePc(HOME_PC_MODES_HZ), 120, TABLET, 'large');
  assert.deepEqual(stream.videoSizeCustom, { width: 1680, height: 1050 });
  assert.equal(stream.fps, 100);
});

test('a measured link that can feed it keeps the off-tier 100 FPS instead of dropping to 90', () => {
  const stream = resolveMoonlightSettings(completeSettings('user'), { bandwidthMbps: 200 }, homePc(HOME_PC_MODES_HZ), 120, TABLET, 'large');
  assert.equal(stream.fps, 100);
  const weak = resolveMoonlightSettings(completeSettings('user'), { bandwidthMbps: 20 }, homePc(HOME_PC_MODES_HZ), 120, TABLET, 'large');
  assert.equal(weak.fps, 60);
});

test('the refresh ceiling comes from the chosen mode, not from the fastest mode on the list', () => {
  const host = homePc([
    { width: 1680, height: 1050, refreshRates: [60, 75] },
    { width: 1920, height: 1080, refreshRates: [60, 144] },
  ]);
  const stream = resolveMoonlightSettings(completeSettings('user'), null, host, 120, TABLET, 'large');
  assert.deepEqual(stream.videoSizeCustom, { width: 1680, height: 1050 });
  assert.equal(stream.fps, 75);
});

test('a host without refresh info, or with a faster mode, leaves Auto FPS on the viewer refresh', () => {
  assert.equal(resolveMoonlightSettings(completeSettings('user'), null, homePc(HOME_PC_MODES), 120, TABLET, 'large').fps, 120);
  const fast = homePc(HOME_PC_MODES.map((mode) => ({ ...mode, refreshRates: [60, 144] })));
  assert.equal(resolveMoonlightSettings(completeSettings('user'), null, fast, 120, TABLET, 'large').fps, 120);
  const junk = homePc(HOME_PC_MODES.map((mode) => ({ ...mode, refreshRates: [0, 1, NaN] })));
  assert.equal(resolveMoonlightSettings(completeSettings('user'), null, junk, 120, TABLET, 'large').fps, 120);
});

test('an explicit FPS choice is not capped by the host refresh rate', () => {
  const settings = completeSettings('user', { frame_rate: 120 });
  assert.equal(resolveMoonlightSettings(settings, null, homePc(HOME_PC_MODES_HZ), 120, TABLET, 'large').fps, 120);
});

test('a 4:3 viewer still prefers the VM 4:3 mode over a slightly larger 16:9 one', () => {
  const vm = applyStreamHostPolicy({
    width: 1920, height: 1080, canSwitchResolution: true,
    modes: [{ width: 1600, height: 1200 }, { width: 1920, height: 1080 }],
  }, 'vm');
  const stream = resolveMoonlightSettings(completeSettings('user'), null, vm, 120, { width: 2048, height: 1536 }, 'large');
  assert.deepEqual(stream.videoSizeCustom, { width: 1600, height: 1200 });
});

test('region limits continue to apply to Auto', () => {
  const stream = resolveMoonlightSettings(completeSettings('user', { region: 'cn' }), null, null, 144, { width: 2560, height: 1600 }, 'phone');
  assert.equal(stream.fps, 60);
  assert.equal(stream.videoSizeCustom.width, 1920);
});

test('unknown and unusual display rates keep a usable supported frame rate', () => {
  assert.equal(preferredRefreshHz(null, [NaN, -1, Infinity]), null);
  assert.equal(autoFrameRate(null), 60);
  assert.equal(autoFrameRate(60), 60);
  assert.equal(autoFrameRate(90), 90);
  assert.equal(autoFrameRate(165), 144);
  assert.equal(autoFrameRate(180), 144);
});

test('cloud desktop defaults become device Auto; explicit saved choices still win', async () => {
  const cloud = { profile: 'quality', resolution: '4k', frame_rate: 60, bitrate_mode: 'fixed', bitrate_mbps: 70, dynamic_resolution: false };
  const query = { select: () => query, eq: () => query, maybeSingle: async () => ({ data: cloud, error: null }) };
  const defaults = await fetchStreamSettingsDefaults({ from: () => query } as never, 'large');
  const automatic = completeSettings('user', null, defaults);
  assert.equal(automatic.profile, 'auto');
  assert.equal(automatic.resolution, 'auto');
  assert.equal(automatic.frame_rate, null);
  assert.equal(automatic.bitrate_mbps, null);
  assert.equal(automatic.dynamic_resolution, true);
  assert.equal(automatic.hdr, 'off');
  const explicit = completeSettings('user', { resolution: '1080p', frame_rate: 90 }, defaults);
  const stream = resolveMoonlightSettings(explicit, null, null, 120, { width: 2560, height: 1600 }, 'phone');
  assert.equal(stream.fps, 90);
  assert.equal(stream.videoSizeCustom.width, 1920);
});

test('missing or unavailable cloud defaults still produce a complete device Auto configuration', async () => {
  for (const result of [{ data: null, error: null }, { data: null, error: { message: 'offline' } }]) {
    const query = { select: () => query, eq: () => query, maybeSingle: async () => result };
    const defaults = await fetchStreamSettingsDefaults({ from: () => query } as never, 'phone');
    const settings = completeSettings('user', null, defaults);
    assert.equal(settings.resolution, 'auto');
    assert.equal(settings.frame_rate, null);
    assert.equal(settings.codec, 'auto');
    assert.equal(settings.hdr, 'off');
  }
});

const VIRTUAL_PC = {
  ok: true, width: 1920, height: 1080, displayMode: 'virtual', displayState: 'local',
  canSwitchResolution: true, captureTargetStale: false, displays: 1, watchdogReady: true, restoreVerified: true,
  current: [{ width: 1920, height: 1080, refreshHz: 100 }],
  modes: [
    { width: 1920, height: 1080, refreshRates: [60, 100] },
    { width: 2560, height: 1440, refreshRates: [60, 90, 120] },
    { width: 2560, height: 1600, refreshRates: [60, 120] },
    { width: 2732, height: 2048, refreshRates: [60, 120] },
  ],
};
const vdd = (value = VIRTUAL_PC) => applyStreamHostPolicy(parseHostDisplay(value), 'pc')!;

test('mobile requests 1440p/120 on VDD independently of the physical 1080p/100 baseline', () => {
  const host = vdd();
  assert.equal(host.resolutionFloorWidth, 0);
  assert.equal(streamHostReadinessIssue(host, 'pc'), null);
  const stream = resolveMoonlightSettings(completeSettings('user', { resolution: '1440p', frame_rate: 120 }), null, host, 120, { width: 2560, height: 1440 });
  assert.deepEqual(stream.videoSizeCustom, { width: 2560, height: 1440 });
  assert.equal(stream.fps, 120);
});

test('VDD fills 16:10 and between-tier 4:3 panels using their real supported pixel modes', () => {
  for (const panel of [{ width: 2560, height: 1600 }, { width: 2732, height: 2048 }]) {
    const stream = resolveMoonlightSettings(completeSettings('user'), null, vdd(), 120, panel);
    assert.deepEqual(stream.videoSizeCustom, panel);
    assert.equal(stream.fps, 120);
  }
});

test('VDD refuses missing size, shape and manually requested Hz instead of falling back', () => {
  const settings = completeSettings('user', { resolution: '1440p', frame_rate: 120 });
  assert.throws(() => resolveMoonlightSettings(settings, null, vdd(), 120, { width: 2560, height: 1800 }), /tỷ lệ/);
  assert.throws(() => resolveMoonlightSettings({ ...settings, resolution: '4k' }, null, vdd(), 120, { width: 3840, height: 2160 }), /3840/);
  assert.throws(() => resolveMoonlightSettings({ ...settings, frame_rate: 144 }, null, vdd(), 144, { width: 2560, height: 1440 }), /144 Hz/);
});

test('Auto only chooses a refresh rate supported at the selected VDD resolution', () => {
  const host = vdd({ ...VIRTUAL_PC, modes: [{ width: 2560, height: 1440, refreshRates: [60, 90, 120] }] });
  const stream = resolveMoonlightSettings(completeSettings('user'), { bandwidthMbps: 45 }, host, 120, { width: 2560, height: 1440 });
  assert.ok([60, 90, 120].includes(stream.fps));
  assert.equal(resolveMoonlightSettings(completeSettings('user'), null, host, 144, { width: 2560, height: 1440 }).fps, 120);
  const slow = { ...host, modes: [{ width: 2560, height: 1440, refreshRates: [60, 100] }] };
  assert.equal(resolveMoonlightSettings(completeSettings('user'), null, slow, 120, { width: 2560, height: 1440 }).fps, 100);
});

test('VDD readiness rejects missing watchdog, restore proof, topology and Hz capabilities', () => {
  for (const changes of [
    { watchdogReady: false }, { restoreVerified: false }, { displayState: undefined },
    { displayState: 'recovery' }, { captureTargetStale: undefined }, { displays: 2 },
    { canSwitchResolution: false }, { modes: [{ width: 2560, height: 1440 }] },
  ]) {
    assert.ok(streamHostReadinessIssue(vdd({ ...VIRTUAL_PC, ...changes } as typeof VIRTUAL_PC), 'pc'), JSON.stringify(changes));
  }
  assert.equal(streamHostReadinessIssue(vdd({ ...VIRTUAL_PC, displayState: 'streaming', restoreVerified: false }), 'pc'), null);
  assert.equal(streamHostReadinessIssue(homePc(HOME_PC_MODES), 'pc'), null);
  assert.equal(streamHostReadinessIssue(null, 'pc'), 'display-unavailable');
});

test('mobile parser preserves validated VDD metadata without coercing success flags or invalid modes', () => {
  assert.equal(parseHostDisplay({ ...VIRTUAL_PC, width: Infinity }), null);
  assert.equal(parseHostDisplay({ ...VIRTUAL_PC, width: '1920' }), null);
  const parsed = parseHostDisplay({
    ...VIRTUAL_PC, canSwitchResolution: 'false', captureTargetStale: 'false', displays: '1', watchdogReady: 'true',
    modes: [null, {}, { width: Infinity, height: 1080 },
      { width: 2560, height: 1440, refreshRates: [120, 60, 0, 1, NaN, '144', 120] },
      { width: 2560, height: 1440, refreshRates: [90] }],
  })!;
  assert.equal(parsed.canSwitchResolution, false);
  assert.equal(parsed.captureTargetStale, undefined);
  assert.equal(parsed.displays, undefined);
  assert.equal(parsed.watchdogReady, undefined);
  assert.deepEqual(parsed.modes, [{ width: 2560, height: 1440, refreshRates: [60, 90, 120] }]);
});

test('applied VDD must be the single active target at the exact requested size and Hz', () => {
  const size = { width: 2560, height: 1440 };
  const active = { ...vdd(), displayState: 'streaming' as const, current: [{ ...size, refreshHz: 119.88 }] };
  assert.doesNotThrow(() => assertVirtualDisplayStream(active, size, 120));
  for (const changes of [
    { displayState: 'local' as const }, { current: undefined }, { displays: 2 }, { watchdogReady: false },
    { current: [{ width: 1920, height: 1080, refreshHz: 120 }] },
    { current: [{ ...size, refreshHz: 100 }] },
    { current: [{ ...size, refreshHz: 120 }, { ...size, refreshHz: 120 }] },
  ]) assert.throws(() => assertVirtualDisplayStream({ ...active, ...changes }, size, 120));
});

for (const target of ['pc', 'vm'] as const) {
  for (const codec of ['auto', 'av1', 'hevc', 'h264'] as const) {
    test(`native ${target} preserves ${codec} for device capability negotiation`, () => {
      const transport = resolveMoonlightSettings({ ...completeSettings('user'), codec }, null, null, 60);
      assert.equal(applyStreamTargetTransportPolicy(transport, target).videoCodec, codec === 'hevc' ? 'h265' : codec);
    });
  }
}
