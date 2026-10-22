import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { useSignedInUser } from '@/features/auth';
import { usePcLibrary } from '@/features/library/usePcLibrary';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { T } from '@/ui/Text';
import { useActiveMapping, disableActiveMapping } from './active';
import { MappingButton, MappingCard, MappingStatus, mappingStyles } from './MappingUi';
import type { MappingProfile } from './model';
import { mappingRepository } from './service';

export function MappingLibrary() {
  const { userId } = useSignedInUser();
  const { colors } = useTheme();
  const library = usePcLibrary();
  const active = useActiveMapping();
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setProfiles(await mappingRepository().list(userId, true)); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, [userId]);
  useFocusEffect(useCallback(() => { let alive = true; void Promise.resolve().then(() => { if (alive) void load(); }); return () => { alive = false; }; }, [load]));
  const mutate = async (task: () => Promise<string | null>) => {
    setBusy(true); setError(null);
    try { const warning = await task(); await load(); if (warning) setError(warning); playUiSound('confirm'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  return <View style={{ gap: 12 }}>
    <T size={20} weight="bold">Thiết lập nút</T>
    <T size={12} color={colors.text3}>Chọn game, tải ảnh toàn màn hình rồi đặt các nút lên ảnh. Start / Select dành cho GuideMenu.</T>
    <MappingStatus loading={loading} error={error} />
    <MappingButton disabled={busy} onPress={() => void load()}>Tải lại profile</MappingButton>
    <MappingStatus loading={library.loading} error={library.error} />
    {library.error ? <MappingButton onPress={() => void library.reload(true)}>Tải lại thư viện game</MappingButton> : null}
    {!library.loading && !library.games.length ? <T size={12}>Chưa có game. Kết nối PC để tải thư viện hiện có.</T> : null}
    {library.games.map(game => {
      const saved = profiles.filter(p => p.game_id === game.id);
      return <MappingCard key={game.id}>
        <View style={mappingStyles.row}>
          {game.artworkUrl ? <Img source={{ uri: game.artworkUrl }} style={{ width: 60, height: 45, borderRadius: 8 }} contentFit="cover" /> : null}
          <View style={{ flex: 1 }}><T weight="bold" size={14}>{game.title}</T><T size={11} color={colors.text3}>{saved.length} profile{active?.game_id === game.id ? ' · Đang hoạt động' : ''}</T></View>
          <MappingButton onPress={() => router.push({ pathname: '/button-mapping-editor', params: { gameId: game.id, gameTitle: game.title } })}>Tạo mới</MappingButton>
        </View>
        {saved.map(profile => <View key={profile.id} style={mappingStyles.row}>
          <T size={12} style={{ flex: 1 }}>{profile.name}{active?.id === profile.id ? ' · Đang bật' : ''}</T>
          <MappingButton disabled={busy} onPress={() => { disableActiveMapping(profile.id); router.push({ pathname: '/button-mapping-editor', params: { profileId: profile.id } }); }}>Sửa / đổi tên</MappingButton>
          <MappingButton disabled={busy} onPress={() => void mutate(async () => (await mappingRepository().duplicate(profile, Crypto.randomUUID(), Crypto.randomUUID())).warning)}>Nhân bản</MappingButton>
          <MappingButton danger disabled={busy} onPress={() => Alert.alert('Xóa profile?', profile.name, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => void mutate(async () => { disableActiveMapping(profile.id); return mappingRepository().delete(profile); }) }])}>Xóa</MappingButton>
        </View>)}
      </MappingCard>;
    })}
    {/* Saved profiles remain editable even if a game is no longer in the PC library. */}
    {profiles.filter(p => !library.games.some(g => g.id === p.game_id)).map(p => <MappingCard key={p.id}>
      <T size={13}>{p.game_title} · {p.name}</T>
      <MappingButton onPress={() => { disableActiveMapping(p.id); router.push({ pathname: '/button-mapping-editor', params: { profileId: p.id } }); }}>Mở profile đã lưu</MappingButton>
      <MappingButton danger disabled={busy} onPress={() => Alert.alert('Xóa profile?', p.name, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => void mutate(async () => { disableActiveMapping(p.id); return mappingRepository().delete(p); }) }])}>Xóa profile</MappingButton>
    </MappingCard>)}
  </View>;
}

export function MappingLibraryScreen() {
  const { colors } = useTheme();
  return <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ padding: 24, gap: 16 }}><MappingButton onPress={() => router.back()}>Quay lại</MappingButton><MappingLibrary /></ScrollView>;
}
