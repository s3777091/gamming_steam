import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { addListener } from 'jetsona-input';
import { useSignedInUser } from '@/features/auth';
import { FocusScroll } from '@/features/gamepad/focus';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { T } from '@/ui/Text';
import { MappingButton, MappingStatus, mappingStyles } from './MappingUi';
import type { MappingProfile } from './model';
import { mappingRepository } from './service';
import type { useMappingRuntime } from './useMappingRuntime';

export type MappingSession = ReturnType<typeof useMappingRuntime>;
/**
 * Danh sách profile trong popover Thiết lập nút. Tay cầm đi giữa các nút qua lớp
 * tiêu điểm của popover (menu Guide chuyển D-pad / A vào đó); panel chỉ nghe B để
 * lùi từ màn profile đang bật về danh sách. `reloadToken` tăng = tải lại danh sách
 * (nút tải lại nằm cạnh nút đóng trên tiêu đề popover).
 */
export function MappingProfilesPanel({ open, gameId, mapping, reloadToken = 0, onNotice, onClose }: { open: boolean; gameId: string | null; mapping: MappingSession; reloadToken?: number; onNotice: (message: string) => void; onClose: () => void }) {
  const { userId } = useSignedInUser();
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelected] = useState<MappingProfile | null>(null);
  const selected = mapping.active?.id === selectedCandidate?.id ? selectedCandidate : null;
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const generation = useRef(0);
  const session = useRef({ mapping, gameId, open, userId });
  useLayoutEffect(() => { session.current = { mapping, gameId, open, userId }; }, [mapping, gameId, open, userId]);
  const load = useCallback(async () => {
    const gen = ++generation.current;
    setLoading(true); setError(null);
    try { const rows = await mappingRepository().list(userId, true); if (gen === generation.current) setProfiles(rows); }
    catch (e) { if (gen === generation.current) setError((e as Error).message); }
    finally { if (gen === generation.current) setLoading(false); }
  }, [userId]);
  useEffect(() => {
    let alive = true;
    void Promise.resolve().then(() => { if (alive && open) { setSelected(null); void load(); } });
    return () => { alive = false; generation.current += 1; };
  }, [load, open]);
  const reloadSeen = useRef(reloadToken);
  useEffect(() => {
    if (reloadSeen.current === reloadToken) return;
    reloadSeen.current = reloadToken;
    if (open) void Promise.resolve().then(load);
  }, [load, open, reloadToken]);
  const select = async (profile: MappingProfile) => {
    if (busyRef.current) return;
    playUiSound('select');
    if (mapping.active?.id === profile.id) { setSelected(profile); return; }
    busyRef.current = true; setBusy(true); setError(null);
    const gen = generation.current;
    onNotice(`Đang thiết lập thao tác mapping nút: ${profile.name}`);
    try {
      const fresh = await mappingRepository().load(userId, profile.id);
      await mappingRepository().screenshotUrl(fresh);
      const runtime = await pcFetchJson<{ ok?: boolean; games?: { id: string; active: boolean }[] }>(PC_ROUTES.gameRuntime, 'Không xác minh được game.');
      const current = session.current;
      if (gen !== generation.current || !current.open || current.userId !== userId) return;
      if (runtime.games?.find(g => g.active)?.id !== fresh.game_id || current.gameId !== fresh.game_id) throw new Error('Profile không thuộc game đang chơi.');
      current.mapping.activate(fresh); onNotice(`Đã kích hoạt mapping: ${fresh.name}`); playUiSound('confirm');
    } catch (e) { if (gen === generation.current) { setError((e as Error).message); onNotice((e as Error).message); } }
    finally { busyRef.current = false; setBusy(false); }
  };
  const disable = () => { mapping.disable(); setSelected(null); onNotice('Đã tắt mapping và hủy các thao tác chờ.'); };
  const edit = () => { if (selected) { mapping.disable(); router.push({ pathname: '/button-mapping-editor', params: { profileId: selected.id } }); } };
  const state = useRef({ selected, onClose });
  useLayoutEffect(() => { state.current = { selected, onClose }; });
  useEffect(() => {
    if (!open) return;
    return addListener('onGamepadButton', event => {
      if (!event.down || event.button !== 'b') return;
      const current = state.current;
      if (current.selected) setSelected(null); else current.onClose();
      playUiSound('back');
    });
  }, [open]);
  return <View style={{ gap: 10 }}>
    <MappingStatus loading={loading || busy} error={error} />
    {selected ? <><T size={14} weight="bold">{selected.name} · Đang bật</T><View style={mappingStyles.row}><MappingButton autoFocus onPress={disable}>Tắt mapping</MappingButton><MappingButton onPress={edit}>Chỉnh sửa mapping</MappingButton></View></> : <>
      <FocusScroll style={{ maxHeight: 230 }} contentContainerStyle={{ gap: 8 }}>
        {profiles.map((p, i) => <MappingButton key={p.id} autoFocus={i === 0} disabled={busy || p.game_id !== gameId} active={mapping.active?.id === p.id} onPress={() => void select(p)}>{p.name} · {p.game_title}{mapping.active?.id === p.id ? ' · Đang bật' : ' · Chưa bật'}</MappingButton>)}
      </FocusScroll>
      {mapping.active ? <MappingButton onPress={() => { mapping.cancel(); onNotice('Đã hủy macro đang chạy.'); }}>Hủy macro đang chạy</MappingButton> : null}
    </>}
  </View>;
}
