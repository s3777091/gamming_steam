import { useCallback, useEffect, useLayoutEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { addListener, getDevices } from 'jetsona-input';
import { useAuth } from '@/features/auth';
import type { NativeMoonlightClient } from '@/lib/moonlight-native';
import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { publishActiveMapping, useActiveMapping } from './active';
import type { Geometry, MappingProfile } from './model';
import { createMappingSink, MappingRuntime } from './runtime';

export function useMappingRuntime({ client, ready, paused, gameId, geometry, onNotice }: {
  client: NativeMoonlightClient | null; ready: boolean; paused: boolean; gameId: string | null; geometry: Geometry; onNotice: (message: string) => void;
}) {
  const auth = useAuth();
  const active = useActiveMapping();
  const engine = useMemo(() => new MappingRuntime(client ? createMappingSink(client) : { sendMousePosition() {}, sendMouseButton() {} }), [client]);
  useLayoutEffect(() => { engine.setErrorHandler(error => { publishActiveMapping(null); onNotice(error.message); }); }, [engine, onNotice]);
  const disable = useCallback(() => { engine.disable(); publishActiveMapping(null); }, [engine]);
  const identity = auth.status === 'signed-in' ? auth.userId : null;
  useLayoutEffect(() => { disable(); return disable; }, [disable, gameId, identity]);
  useLayoutEffect(() => {
    if (!ready || !identity) disable();
    engine.setPaused(paused || !ready);
    engine.checkGeometry(geometry);
  }, [disable, engine, geometry, identity, paused, ready]);
  // Subscribe before the session's passive background handler closes its client,
  // so a held mouse button can be released on the healthy channel first.
  useLayoutEffect(() => {
    const subscription = AppState.addEventListener('change', state => { if (state !== 'active') disable(); });
    let known = new Set(getDevices().filter(d => d.kind === 'controller').map(d => d.nativeId));
    const off = addListener('onDevicesChanged', () => {
      const present = new Set(getDevices().filter(d => d.kind === 'controller').map(d => d.nativeId));
      for (const id of known) if (!present.has(id)) engine.disconnect(id);
      known = present;
    });
    return () => { off(); subscription.remove(); };
  }, [disable, engine]);
  useEffect(() => {
    if (!active || !ready || paused) return;
    let alive = true; let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    const check = async () => {
      try {
        const data = await pcFetchJson<{ ok?: boolean; games?: { id: string; active: boolean }[] }>(PC_ROUTES.gameRuntime, 'Không xác minh được game đang chạy.', undefined, controller.signal);
        if (alive && data.games?.find(g => g.active)?.id !== gameId) { disable(); onNotice('Mapping đã tắt vì game đang chạy thay đổi.'); }
      } catch {
        if (alive) { disable(); onNotice('Mapping đã tắt vì không xác minh được game đang chạy.'); }
      }
      if (alive) timer = setTimeout(check, 3000);
    };
    timer = setTimeout(check, 3000);
    return () => { alive = false; controller.abort(); clearTimeout(timer); };
  }, [active, disable, gameId, onNotice, paused, ready]);
  const activate = useCallback((profile: MappingProfile) => {
    if (!client || !client.isPointerInputReady() || !ready || !identity || profile.user_id !== identity) throw new Error('Phiên stream chưa sẵn sàng.');
    engine.activate(profile, gameId, geometry);
    engine.setPaused(paused);
    publishActiveMapping(engine.activeProfile, disable);
  }, [client, disable, engine, gameId, geometry, identity, paused, ready]);
  return { engine, active, activate, disable, cancel: () => engine.cancel() };
}
