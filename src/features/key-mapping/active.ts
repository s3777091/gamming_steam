import { useSyncExternalStore } from 'react';
import type { MappingProfile } from './model';

let current: MappingProfile | null = null;
const listeners = new Set<() => void>();
let stop: (() => void) | null = null;
export function publishActiveMapping(profile: MappingProfile | null, disable?: () => void) {
  current = profile; stop = disable ?? null; listeners.forEach(fn => fn());
}
export function disableActiveMapping(id?: string) { if (!id || current?.id === id) stop?.(); }
export function useActiveMapping() {
  return useSyncExternalStore((fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; }, () => current, () => null);
}
