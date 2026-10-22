import * as Crypto from 'expo-crypto';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, TextInput, View } from 'react-native';
import { ArrowDownAZ, ArrowUpAZ, CheckCircle2, ChevronDown, Gamepad2, MoreHorizontal, RefreshCw, Search, X } from 'lucide-react-native';
import { useSignedInUser } from '@/features/auth';
import { usePcLibrary } from '@/features/library/usePcLibrary';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { useActiveMapping, disableActiveMapping } from './active';
import { MappingButton, MappingStatus, mappingColors, mappingStyles } from './MappingUi';
import type { MappingProfile } from './model';
import { mappingRepository } from './service';

export function MappingLibrary({ onClose, embedded = false }: { onClose?: () => void; embedded?: boolean }) {
  const { userId } = useSignedInUser();
  const { s, insets } = useUi();
  const library = usePcLibrary();
  const active = useActiveMapping();
  const [profiles, setProfiles] = useState<MappingProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [profilesLoaded, setProfilesLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState('');
  const [descending, setDescending] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const generation = useRef(0);
  const load = useCallback(async () => {
    const request = ++generation.current;
    setLoading(true); setError(null);
    try { const next = await mappingRepository().list(userId, true); if (request === generation.current) { setProfiles(next); setProfilesLoaded(true); } }
    catch (e) { if (request === generation.current) { setProfilesLoaded(false); setError((e as Error).message); } }
    finally { if (request === generation.current) setLoading(false); }
  }, [userId]);
  useFocusEffect(useCallback(() => { void load(); return () => { generation.current++; }; }, [load]));
  const mutate = async (task: () => Promise<string | null>) => {
    setBusy(true); setError(null);
    try { const warning = await task(); await load(); if (warning) setError(warning); playUiSound('confirm'); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const games = useMemo(() => {
    const rows: { id: string; title: string; artworkUrl: string | null; savedOnly: boolean }[] = library.games.map(game => ({ id: game.id, title: game.title, artworkUrl: game.artworkUrl, savedOnly: false }));
    const known = new Set(rows.map(game => game.id));
    for (const profile of profiles) {
      if (!known.has(profile.game_id)) { known.add(profile.game_id); rows.push({ id: profile.game_id, title: profile.game_title, artworkUrl: null, savedOnly: true }); }
    }
    const query = search.trim().toLocaleLowerCase('vi');
    return rows.filter(game => game.title.toLocaleLowerCase('vi').includes(query))
      .sort((a, b) => (descending ? -1 : 1) * a.title.localeCompare(b.title, 'vi', { sensitivity: 'base' }));
  }, [descending, library.games, profiles, search]);
  const edit = (profile: MappingProfile) => { disableActiveMapping(profile.id); router.push({ pathname: '/button-mapping-editor', params: { profileId: profile.id } }); };
  const syncButton = <MappingButton disabled={busy || loading} label="Tải lại profile" onPress={() => void load()}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>{profilesLoaded && !error ? <CheckCircle2 size={s(13)} color={mappingColors.success} /> : <RefreshCw size={s(13)} color={mappingColors.muted} />}<T size={10} color={mappingColors.muted}>{loading ? 'Đang đồng bộ' : profilesLoaded ? 'Đã đồng bộ' : 'Tải lại'}</T></View>
  </MappingButton>;
  return <View style={{ flex: 1, backgroundColor: embedded ? 'transparent' : mappingColors.bg, paddingHorizontal: s(16), paddingTop: (embedded ? 0 : insets.top) + s(12), gap: s(10) }}>
    {!embedded ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
      <View style={{ flex: 1, gap: s(3) }}><T size={19} weight="bold" color={mappingColors.text}>Thiết lập nút</T><T size={10.5} color={mappingColors.muted}>Tạo và quản lý profile nút cho từng game</T></View>
      {syncButton}
      {onClose ? <MappingButton label="Đóng cài đặt" onPress={onClose}><X size={s(15)} color={mappingColors.text} /></MappingButton> : null}
    </View> : null}
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
      <View style={{ flex: 1, minWidth: 0, minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: s(8), paddingHorizontal: s(10), borderWidth: 1, borderColor: mappingColors.border, borderRadius: s(6), backgroundColor: mappingColors.panel }}>
        <Search size={s(14)} color={mappingColors.muted} />
        <TextInput accessibilityLabel="Tìm game" placeholder="Tìm game..." placeholderTextColor={mappingColors.muted} value={search} onChangeText={setSearch} autoCorrect={false} returnKeyType="search" style={{ flex: 1, minWidth: 0, color: mappingColors.text, fontSize: s(11), paddingVertical: s(8) }} />
        {search ? <Press accessibilityLabel="Xóa tìm kiếm" onPress={() => setSearch('')} style={{ padding: 8 }}><X size={s(12)} color={mappingColors.muted} /></Press> : null}
      </View>
      <MappingButton label={descending ? 'Sắp xếp Z đến A' : 'Sắp xếp A đến Z'} onPress={() => setDescending(value => !value)}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>{descending ? <ArrowUpAZ size={s(14)} color={mappingColors.muted} /> : <ArrowDownAZ size={s(14)} color={mappingColors.muted} />}<T size={10.5} color={mappingColors.text}>{descending ? 'Z → A' : 'A → Z'}</T></View>
      </MappingButton>
      {embedded ? syncButton : null}
    </View>
    <MappingStatus error={error ?? library.error} />
    {library.error ? <MappingButton onPress={() => void library.reload(true)}>Tải lại thư viện game</MappingButton> : null}
    <FlatList data={games} keyExtractor={game => game.id} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}
      contentContainerStyle={{ gap: s(4), paddingBottom: insets.bottom + s(12) }} initialNumToRender={10}
      ListEmptyComponent={<View style={{ paddingVertical: s(30), alignItems: 'center', gap: s(10) }}><MappingStatus loading={library.loading || loading} /><T size={12} color={mappingColors.muted}>{search ? 'Không tìm thấy game phù hợp.' : 'Kết nối PC để tải thư viện game.'}</T></View>}
      renderItem={({ item: game }) => {
        const saved = profiles.filter(p => p.game_id === game.id);
        const open = expanded === game.id;
        return <View style={{ borderRadius: s(12), borderWidth: 1, borderColor: open ? mappingColors.accent : '#282434', backgroundColor: mappingColors.panel }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), padding: s(4) }}>
            <Press accessibilityLabel={`Profile của ${game.title}`} accessibilityState={{ expanded: open }} onPress={() => setExpanded(open ? null : game.id)} pressScale={1}
              style={{ flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: s(12), minHeight: 44 }}>
              <View style={{ width: s(66), height: s(36), borderRadius: s(4), backgroundColor: mappingColors.raised, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
                {game.artworkUrl ? <Img source={{ uri: game.artworkUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <Gamepad2 size={s(20)} color={mappingColors.muted} />}
              </View>
              <View style={{ flex: 1, minWidth: 0, gap: s(4) }}><T weight="semibold" size={11.5} color={mappingColors.text} numberOfLines={1}>{game.title}</T><T size={9} color={active?.game_id === game.id ? mappingColors.success : mappingColors.muted}>{loading ? 'Đang tải profile...' : !profilesLoaded ? 'Chưa tải được profile' : `${saved.length} profile${active?.game_id === game.id ? ' · Đang bật' : ''}${game.savedOnly ? ' · Đã lưu' : ''}`}</T></View>
            </Press>
            <MappingButton label={`Quản lý profile ${game.title}`} onPress={() => setExpanded(open ? null : game.id)} style={{ backgroundColor: 'transparent', borderColor: 'transparent' }}>{open ? <ChevronDown size={s(15)} color={mappingColors.muted} /> : <MoreHorizontal size={s(17)} color={mappingColors.muted} />}</MappingButton>
            <MappingButton disabled={busy || loading || !profilesLoaded} active onPress={() => router.push({ pathname: '/button-mapping-editor', params: { gameId: game.id, gameTitle: game.title } })}>Tạo mới</MappingButton>
          </View>
          {open ? <View style={{ padding: s(10), paddingTop: s(4), gap: s(7) }}>
            {!saved.length ? <T size={10.5} color={mappingColors.muted}>Chưa có profile. Chọn Tạo mới để bắt đầu.</T> : null}
            {saved.map(profile => <View key={profile.id} style={mappingStyles.row}>
              <T size={11} color={mappingColors.text} style={{ flex: 1, minWidth: s(80) }}>{profile.name}{active?.id === profile.id ? ' · Đang bật' : ''}</T>
              <MappingButton disabled={busy} onPress={() => edit(profile)}>Chỉnh sửa</MappingButton>
              <MappingButton disabled={busy} onPress={() => void mutate(async () => (await mappingRepository().duplicate(profile, Crypto.randomUUID(), Crypto.randomUUID())).warning)}>Nhân bản</MappingButton>
              <MappingButton danger disabled={busy} onPress={() => Alert.alert('Xóa profile?', profile.name, [{ text: 'Hủy', style: 'cancel' }, { text: 'Xóa', style: 'destructive', onPress: () => void mutate(async () => { disableActiveMapping(profile.id); return mappingRepository().delete(profile); }) }])}>Xóa</MappingButton>
            </View>)}
          </View> : null}
        </View>;
      }} />
  </View>;
}

export function MappingLibraryScreen() {
  return <MappingLibrary onClose={() => router.back()} />;
}
