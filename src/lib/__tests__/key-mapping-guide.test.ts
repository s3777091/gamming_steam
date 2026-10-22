import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { registerHooks } from 'node:module';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import { binding, neutral, point, profile, OWNER } from './key-mapping-fixture.ts';

const hooks = registerHooks({ resolve(specifier, context, next) { return next(specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier) ? `${specifier}.ts` : specifier, context); } });
const { MappingRuntime } = await import('../../features/key-mapping/runtime.ts');
hooks.deregister();
type Node = { type: unknown; props: Record<string, any>; children: unknown[] };
function fixture() {
  const slots: any[] = []; let cursor = 0;
  const pending: { index: number; effect: Function }[] = [];
  const callbacks = new Map<string, Function>(); const notices: string[] = []; const routes: unknown[] = [];
  const same = (a?: unknown[], b?: unknown[]) => Boolean(a && b && a.length === b.length && a.every((v, i) => Object.is(v, b[i])));
  const react = {
    createElement: (type: unknown, props: object, ...children: unknown[]): Node => ({ type, props: props ?? {}, children: children.flat(Infinity) }),
    useState(initial: unknown) { const index = cursor++; if (!slots[index]) slots[index] = { value: typeof initial === 'function' ? (initial as Function)() : initial }; return [slots[index].value, (next: unknown) => { slots[index].value = typeof next === 'function' ? (next as Function)(slots[index].value) : next; }]; },
    useRef(value: unknown) { const index = cursor++; slots[index] ??= { current: value }; return slots[index]; },
    useCallback(fn: Function, deps: unknown[]) { const index = cursor++; if (!same(slots[index]?.deps, deps)) slots[index] = { value: fn, deps }; return slots[index].value; },
    useEffect(effect: Function, deps?: unknown[]) { const index = cursor++; if (!same(slots[index]?.deps, deps)) { slots[index]?.cleanup?.(); slots[index] = { deps }; pending.push({ index, effect }); } },
    useLayoutEffect(effect: Function, deps?: unknown[]) { react.useEffect(effect, deps); },
  };
  let gameId = 'steam-123'; let loadFails = false;
  const p = profile([binding({ physicalHold: true, steps: [{ type: 'hold', point, durationMs: 1000 }] })]);
  const packets: unknown[][] = [];
  const engine = new MappingRuntime({ sendMousePosition: (...args) => packets.push(['position', ...args]), sendMouseButton: (...args) => packets.push(['button', ...args]) });
  const mapping = { get active() { return engine.activeProfile; }, activate: (profile: any) => engine.activate(profile, gameId, p.screenshot), disable: () => engine.disable(), cancel: () => engine.cancel() };
  const modules: Record<string, unknown> = {
    react, 'expo-router': { router: { push: (route: unknown) => routes.push(route) } },
    'react-native': { ScrollView: 'ScrollView', View: 'View' },
    'jetsona-input': { addListener: (event: string, fn: Function) => { callbacks.set(event, fn); return () => callbacks.delete(event); } },
    '@/features/auth': { useSignedInUser: () => ({ userId: OWNER }) },
    '@/features/gamepad/focus': { FocusScroll: 'ScrollView' },
    '@/features/sound/UiSoundProvider': { playUiSound() {} },
    '@/lib/pc-api': { PC_ROUTES: { gameRuntime: '/games/runtime' }, pcFetchJson: async () => ({ games: [{ id: gameId, active: true }] }) },
    '@/ui/Text': { T: 'Text' },
    './MappingUi': { MappingButton: 'Button', MappingStatus: 'Status', mappingStyles: { row: {} } },
    './service': { mappingRepository: () => ({ list: async () => { if (loadFails) throw new Error('Supabase unavailable'); return [p]; }, load: async () => p, screenshotUrl: async () => 'private-image' }) },
  };
  const source = readFileSync(new URL('../../features/key-mapping/MappingProfilesPanel.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.React, jsxFactory: 'React.createElement' } }).outputText;
  const exports: any = {};
  runInNewContext(output, { exports, React: react, console, Promise, require: (name: string) => { assert.ok(name in modules, name); return modules[name]; } });
  let open = true; let reloadToken = 0; let tree: Node;
  function render() {
    cursor = 0;
    tree = exports.MappingProfilesPanel({ open, gameId, mapping, reloadToken, onNotice: (notice: string) => notices.push(notice), onClose: () => { open = false; } });
    for (const { index, effect } of pending.splice(0)) slots[index].cleanup = effect();
    return tree;
  }
  const all = (node: unknown): Node[] => !node || typeof node !== 'object' || !('children' in node) ? [] : [node as Node, ...(node as Node).children.flatMap(all)];
  const buttons = () => all(tree).filter(node => node.type === 'Button');
  const label = (button: Node) => button.children.filter(c => typeof c === 'string').join('');
  const click = (text: string) => { const node = buttons().find(b => label(b).includes(text)); assert.ok(node, text); assert.ok(!node.props.disabled, text); return node.props.onPress(); };
  const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); render(); };
  return { render, click, buttons, label, flush, engine, packets, notices, routes, press: (button: string) => callbacks.get('onGamepadButton')?.({ button, down: true }), reload: () => { reloadToken += 1; render(); }, mismatch: () => { gameId = 'another-game'; }, failLoad: () => { loadFails = true; }, errors: () => all(tree).filter(n => n.type === 'Status').map(n => n.props.error).filter(Boolean), cleanup: () => { engine.disable(); slots.forEach(slot => slot?.cleanup?.()); } };
}

test('GuideMenu loads profiles, activates the selection, and offers exactly Disable/Edit for an active profile', async () => {
  const f = fixture(); f.render(); await f.flush();
  f.click('My profile'); await f.flush();
  assert.equal(f.engine.activeProfile?.id, profile().id); assert.match(f.notices.at(-1)!, /Đã kích hoạt/);
  f.click('My profile'); f.render();
  assert.deepEqual(f.buttons().map(f.label), ['Tắt mapping', 'Chỉnh sửa mapping']);
  f.engine.process(1, { ...neutral, buttons: 0x1000 });
  f.click('Tắt mapping'); f.render();
  assert.equal(f.engine.activeProfile, null);
  assert.deepEqual(f.packets.at(-1), ['button', false, 1]);
  f.cleanup();
});
test('editing from the active popup stops execution and opens the saved profile identity', async () => {
  const f = fixture(); f.render(); await f.flush(); f.click('My profile'); await f.flush(); f.click('My profile'); f.render();
  f.engine.process(1, { ...neutral, buttons: 0x1000 });
  f.click('Chỉnh sửa mapping');
  assert.equal(f.engine.activeProfile, null); assert.deepEqual(f.packets.at(-1), ['button', false, 1]);
  assert.equal((f.routes[0] as any).params.profileId, profile().id); assert.equal((f.routes[0] as any).pathname, '/button-mapping-editor');
  f.cleanup();
});
test('mismatched games and Supabase errors never produce a successful activation', async () => {
  const f = fixture(); f.render(); await f.flush(); f.mismatch(); f.click('My profile'); await f.flush();
  assert.equal(f.engine.activeProfile, null); assert.ok(f.notices.every(message => !message.includes('Đã kích hoạt')));
  f.failLoad(); f.reload(); await f.flush(); assert.deepEqual(f.errors(), ['Supabase unavailable']);
  f.cleanup();
});
