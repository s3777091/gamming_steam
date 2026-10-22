import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, ScrollView, View } from 'react-native';
import { ChevronRight, Folder, Image, X, type LucideIcon } from 'lucide-react-native';
import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { SCREENSHOT_FOLDER, screenshotAuthHeaders, screenshotImageSource } from '@/lib/game-screenshots';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { T } from '@/ui/Text';
import { useUi } from '@/ui/scale';
import { MAX_IMAGE_BYTES } from './model';
import { MappingButton, MappingCard, MappingModal, MappingStatus, mappingColors, mappingStyles } from './MappingUi';
import { PhotoPermissionError } from './photo-permissions';
import { pickDeviceScreenshot, prepareStorageScreenshot, releaseStorageScreenshot, type ScreenshotSelection } from './screenshot-sources';
import { listStorageImages, type ImageStorageMode, type StorageImageEntry } from './storage-images';

function ScreenshotSource({ title, detail, icon: Icon, primary, disabled, onPress }: { title: string; detail: string; icon: LucideIcon; primary?: boolean; disabled: boolean; onPress: () => void }) {
  const { s } = useUi();
  return <MappingButton disabled={disabled} onPress={onPress} style={{ alignItems: 'stretch', padding: s(8) }}>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}><View style={{ width: s(34), height: s(34), borderRadius: s(7), alignItems: 'center', justifyContent: 'center', backgroundColor: primary ? '#50308b' : '#343044' }}><Icon size={s(21)} color={mappingColors.text} /></View><View style={{ flex: 1, minWidth: 0, gap: s(4) }}><T size={10.5} color={mappingColors.text} weight="semibold">{title}</T><T size={8.5} color={mappingColors.muted}>{detail}</T></View><ChevronRight size={s(15)} color={mappingColors.muted} /></View>
  </MappingButton>;
}

export function ScreenshotPicker({ onConfirm, onClose }: { onConfirm: (asset: ScreenshotSelection) => void; onClose: () => void }) {
  const colors = { text3: mappingColors.muted, bg: mappingColors.bg, accentSoft: mappingColors.accent };
  const { s } = useUi();
  const [mode, setMode] = useState<'sources' | 'storage' | 'preview'>('sources');
  const [folder, setFolder] = useState('Images');
  const [storageMode, setStorageMode] = useState<ImageStorageMode>('cloud');
  const [refresh, setRefresh] = useState(0);
  const [browser, setBrowser] = useState<{ entries: StorageImageEntry[]; headers: Record<string, string>; loading: boolean }>({ entries: [], headers: {}, loading: true });
  const [candidate, setCandidate] = useState<ScreenshotSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const busyLock = useRef(false);
  const mounted = useRef(false);
  const selectionRequest = useRef<AbortController | null>(null);
  const browserGeneration = useRef(0);
  const ownedFiles = useRef(new Set<string>());
  useBack(onClose);

  useEffect(() => {
    mounted.current = true;
    const owned = ownedFiles.current;
    return () => {
      mounted.current = false;
      selectionRequest.current?.abort();
      owned.forEach(releaseStorageScreenshot);
      owned.clear();
    };
  }, []);
  useEffect(() => {
    if (mode !== 'storage') return;
    const controller = new AbortController();
    const generation = browserGeneration.current;
    void Promise.all([listStorageImages(folder, controller.signal, storageMode), screenshotAuthHeaders()]).then(([entries, headers]) => {
      if (!controller.signal.aborted && generation === browserGeneration.current) setBrowser({ entries, headers, loading: false });
    }).catch(e => {
      if (!controller.signal.aborted && generation === browserGeneration.current) { setError((e as Error).message); setBrowser({ entries: [], headers: {}, loading: false }); }
    });
    return () => controller.abort();
  }, [folder, mode, refresh, storageMode]);

  const browse = (path = folder, target = storageMode) => {
    browserGeneration.current++;
    setError(null); setSettingsAvailable(false); setBrowser({ entries: [], headers: {}, loading: true });
    setFolder(path); setStorageMode(target); setMode('storage'); setRefresh(value => value + 1);
  };
  const select = async (task: (signal: AbortSignal) => Promise<ScreenshotSelection | null>) => {
    if (busyLock.current) return;
    busyLock.current = true; setBusy(true); setError(null); setSettingsAvailable(false);
    const controller = new AbortController(); selectionRequest.current = controller;
    try {
      const selected = await task(controller.signal);
      if (!selected) return;
      if (!mounted.current) { if (selected.origin === 'storage') releaseStorageScreenshot(selected.uri); return; }
      if (candidate?.origin === 'storage') { releaseStorageScreenshot(candidate.uri); ownedFiles.current.delete(candidate.uri); }
      if (selected.origin === 'storage') ownedFiles.current.add(selected.uri);
      setCandidate(selected); setMode('preview');
    } catch (e) {
      if (mounted.current && !controller.signal.aborted) {
        setError((e as Error).message);
        setSettingsAvailable(e instanceof PhotoPermissionError && e.canOpenSettings);
      }
    } finally {
      busyLock.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const parent = folder.split('/').slice(0, -1).join('/');
  return <FocusLayer><MappingModal onClose={onClose} wide={mode !== 'sources'}>
    <ScrollView style={{ flexGrow: 0, flexShrink: 1 }} keyboardShouldPersistTaps="handled"><MappingCard>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}><T size={12} color={mappingColors.text} weight="semibold" style={{ flex: 1 }}>Chọn ảnh gameplay</T><MappingButton label="Đóng chọn ảnh" onPress={onClose} style={{ borderWidth: 0, backgroundColor: 'transparent' }}><X size={s(14)} color={mappingColors.muted} /></MappingButton></View>
      {mode === 'sources' ? <View style={{ gap: s(7) }}>
        <ScreenshotSource title="Ảnh trong Storage" detail="Chọn ảnh đã lưu trên Storage của bạn" icon={Image} primary disabled={busy} onPress={() => browse()} />
        <ScreenshotSource title="Thư viện thiết bị" detail="Chọn ảnh từ thư viện thiết bị của bạn" icon={Folder} disabled={busy} onPress={() => void select(() => pickDeviceScreenshot())} />
        <T size={8.5} color={colors.text3}>PNG, JPEG, WebP · tối đa 10 MB</T>
      </View> : <View style={mappingStyles.row}>
        <MappingButton disabled={busy} onPress={() => setMode('sources')}>Đổi nguồn</MappingButton>
        <MappingButton disabled={busy} active={mode === 'storage'} onPress={() => browse()}>Ảnh trong Storage</MappingButton>
        <MappingButton disabled={busy} onPress={() => void select(() => pickDeviceScreenshot())}>Thư viện thiết bị</MappingButton>
        {candidate && mode !== 'preview' ? <MappingButton disabled={busy} onPress={() => setMode('preview')}>Ảnh đã chọn</MappingButton> : null}
      </View>}
      {mode === 'storage' ? <>
        <View style={mappingStyles.row}>
          <MappingButton disabled={busy} active={storageMode === 'cloud'} onPress={() => browse('Images', 'cloud')}>Cloud</MappingButton>
          <MappingButton disabled={busy} active={storageMode === 'local'} onPress={() => browse('Images', 'local')}>PC</MappingButton>
          <MappingButton disabled={busy || !folder} onPress={() => browse(parent)}>↑ Thư mục cha</MappingButton>
          <MappingButton disabled={busy} onPress={() => browse('')}>Gốc Storage</MappingButton>
          <MappingButton disabled={busy} onPress={() => browse(SCREENSHOT_FOLDER, 'local')}>Ảnh chụp game</MappingButton>
          <MappingButton disabled={busy || browser.loading} onPress={() => browse()}>Tải lại</MappingButton>
        </View>
        <T size={10} color={colors.text3} numberOfLines={1}>{storageMode === 'cloud' ? 'Cloud' : 'PC'} / {folder || 'Storage'}</T>
        <MappingStatus loading={browser.loading} />
        {!browser.loading && !browser.entries.length ? <T size={12}>Thư mục này chưa có ảnh phù hợp.</T> : null}
        <FlatList horizontal data={browser.entries} keyExtractor={entry => entry.path} style={{ flexGrow: 0, height: browser.entries.length ? 124 : 0, marginHorizontal: -6, marginVertical: -6 }} contentContainerStyle={{ gap: 8, padding: 6 }} initialNumToRender={6} maxToRenderPerBatch={6} windowSize={3}
          renderItem={({ item }) => {
            const tooLarge = !item.isDir && item.size > MAX_IMAGE_BYTES;
            return <Press disabled={busy || tooLarge} onPress={() => { if (item.isDir) browse(item.path); else void select(signal => prepareStorageScreenshot(item, signal, storageMode)); }} accessibilityLabel={`${item.isDir ? 'Mở thư mục' : 'Chọn ảnh'} ${item.name}`} style={{ width: 130, opacity: tooLarge ? 0.4 : 1, gap: 4, borderRadius: 10 }}>
              <View style={{ height: 76, borderRadius: 10, overflow: 'hidden', backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
                {item.isDir ? <Folder color={colors.accentSoft} size={30} /> : tooLarge ? <T size={11}>Vượt 10 MB</T> : <Img source={{ ...screenshotImageSource(item.path, browser.headers, storageMode), cacheKey: `mapping-storage:${storageMode}:${item.path}:${item.modified}` }} style={{ width: '100%', height: '100%' }} contentFit="cover" />}
              </View>
              <T size={10} numberOfLines={1}>{item.name}</T>
            </Press>;
          }} />
      </> : null}
      {mode === 'preview' && candidate ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <Img source={{ uri: candidate.uri }} contentFit="contain" style={{ flex: 1, height: 125 }} />
        <View style={{ width: 160, gap: 6 }}><T size={12} numberOfLines={2}>{candidate.name}</T><T size={10} color={colors.text3}>{candidate.origin === 'storage' ? 'Storage' : 'Thư viện thiết bị'} · {candidate.width} × {candidate.height}</T></View>
      </View> : null}
      <MappingStatus loading={busy} error={error} />
      <View style={mappingStyles.row}>
        {mode === 'preview' && candidate ? <MappingButton disabled={busy} active onPress={() => { ownedFiles.current.delete(candidate.uri); onConfirm(candidate); }}>Dùng ảnh này</MappingButton> : null}
        {settingsAvailable ? <MappingButton onPress={() => void Linking.openSettings().catch(() => setError('Không mở được Cài đặt. Hãy mở quyền Ảnh của Jetsona trong Cài đặt thiết bị.'))}>Mở Cài đặt quyền ảnh</MappingButton> : null}
        {mode !== 'sources' ? <MappingButton onPress={onClose}>Hủy</MappingButton> : null}
      </View>
    </MappingCard></ScrollView>
  </MappingModal></FocusLayer>;
}
