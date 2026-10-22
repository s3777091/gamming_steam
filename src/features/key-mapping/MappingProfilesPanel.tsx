import { router } from 'expo-router';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { addListener } from 'jetsona-input';
import { useSignedInUser } from '@/features/auth';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { PC_ROUTES, pcFetchJson } from '@/lib/pc-api';
import { useTheme } from '@/theme';
import { T } from '@/ui/Text';
import { MappingButton, MappingStatus, mappingStyles } from './MappingUi';
import type { MappingProfile } from './model';
import { mappingRepository } from './service';
import type { useMappingRuntime } from './useMappingRuntime';

export type MappingSession = ReturnType<typeof useMappingRuntime>;
export function MappingProfilesPanel({ open, gameId, mapping, onNotice, onClose }: { open: boolean; gameId: string | null; mapping: MappingSession; onNotice: (message: string) => void; onClose: () => void }) {
  const { userId } = useSignedInUser();
  const { colors } = useTheme();
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCandidate, setSelected] = useState<MappingProfile | null>(null);
  const selected = mapping.active?.id === selectedCandidate?.id ? selectedCandidate : null;
  const [focus, setFocus] = useState(0);
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
    void Promise.resolve().then(() => { if (alive && open) { setSelected(null); setFocus(0); void load(); } });
    return () => { alive = false; generation.current += 1; };
  }, [load, open]);
  const select = async (profile: MappingProfile) => {
    if (busyRef.current) return;
    playUiSound('select');
    if (mapping.active?.id === profile.id) { setSelected(profile); setFocus(0); return; }
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
  const state = useRef({ profiles, focus, selected, select, disable, edit, onClose });
  useLayoutEffect(() => { state.current = { profiles, focus, selected, select, disable, edit, onClose }; });
  useEffect(() => {
    if (!open) return;
    return addListener('onGamepadButton', event => {
      if (!event.down) return;
      const current = state.current;
      if (event.button === 'b') { if (current.selected) setSelected(null); else current.onClose(); playUiSound('back'); }
      if (event.button === 'up' || event.button === 'down') { setFocus(f => Math.max(0, Math.min(current.selected ? 1 : current.profiles.length - 1, f + (event.button === 'up' ? -1 : 1)))); playUiSound('navigate'); }
      if (event.button === 'a') { if (current.selected) { if (current.focus === 0) current.disable(); else current.edit(); } else if (current.profiles[current.focus]) void current.select(current.profiles[current.focus]); }
    });
  }, [open]);
  return <View style={{ gap: 10 }}>
    <MappingStatus loading={loading || busy} error={error} />
    {selected ? <><T size={14} weight="bold">{selected.name} · Đang bật</T><View style={mappingStyles.row}><MappingButton active={focus === 0} onPress={disable}>Tắt mapping</MappingButton><MappingButton active={focus === 1} onPress={edit}>Chỉnh sửa mapping</MappingButton></View></> : <>
      <T size={11} color={colors.text3}>Chọn profile cho game đang chạy. Chọn lại profile đang bật để tắt hoặc chỉnh sửa.</T>
      <ScrollView style={{ maxHeight: 230 }} contentContainerStyle={{ gap: 8 }}>
        {profiles.map((p, i) => <MappingButton key={p.id} disabled={busy || p.game_id !== gameId} active={focus === i} onPress={() => void select(p)}>{p.name} · {p.game_title}{mapping.active?.id === p.id ? ' · Đang bật' : ' · Chưa bật'}</MappingButton>)}
        {!loading && !profiles.length ? <T size={12}>Chưa có profile. Tạo tại Cài đặt → Thiết lập nút.</T> : null}
      </ScrollView>
      <MappingButton disabled={busy} onPress={() => void load()}>Tải lại</MappingButton>
      {mapping.active ? <MappingButton onPress={() => { mapping.cancel(); onNotice('Đã hủy macro đang chạy.'); }}>Hủy macro đang chạy</MappingButton> : null}
    </>}
  </View>;
}
