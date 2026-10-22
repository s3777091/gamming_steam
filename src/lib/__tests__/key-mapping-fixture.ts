import type { Binding, MappingProfile, PadState, Step } from '../../features/key-mapping/model.ts';

export const OWNER = '11111111-1111-4111-8111-111111111111';
export const PROFILE_ID = '22222222-2222-4222-8222-222222222222';
export const neutral: PadState = { buttons: 0, lt: 0, rt: 0, lx: 0, ly: 0, rx: 0, ry: 0 };
export const point = { x: 0.75, y: 0.82 };
export const tap: Step = { type: 'tap', point, durationMs: 2 };
export function binding(overrides: Partial<Binding> = {}): Binding {
  return { id: 'a', name: 'Jump', controls: ['a'], point, steps: [tap], repeat: 1, physicalHold: false, ...overrides };
}
export function profile(bindings = [binding()]): MappingProfile {
  return { id: PROFILE_ID, user_id: OWNER, game_id: 'steam-123', game_title: 'Game', name: 'My profile', description: '', screenshot_path: `${OWNER}/${PROFILE_ID}/image.png`, screenshot: { width: 1920, height: 1080 }, bindings, settings: { markerOpacity: 0.85 }, schema_version: 1, created_at: '2026-10-22T00:00:00.000Z', updated_at: '2026-10-22T00:00:00.000Z' };
}
export const sleep = (ms = 20) => new Promise<void>(resolve => setTimeout(resolve, ms));
export async function until(predicate: () => boolean) {
  const end = Date.now() + 2000;
  while (!predicate() && Date.now() < end) await sleep(10);
  if (!predicate()) throw new Error('Expected mapping events did not arrive.');
}
