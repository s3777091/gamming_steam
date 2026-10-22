import { useEffect, useRef, useState } from 'react';
import { FlatList, Linking, Modal, ScrollView, View } from 'react-native';
import { Folder } from 'lucide-react-native';
import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { SCREENSHOT_FOLDER, screenshotAuthHeaders, screenshotImageSource } from '@/lib/game-screenshots';
import { useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { T } from '@/ui/Text';
import { MAX_IMAGE_BYTES } from './model';
import { MappingButton, MappingCard, MappingStatus, mappingStyles } from './MappingUi';
import { PhotoPermissionError } from './photo-permissions';
import { pickDeviceScreenshot, prepareStorageScreenshot, releaseStorageScreenshot, type ScreenshotSelection } from './screenshot-sources';
import { listStorageImages, type ImageStorageMode, type StorageImageEntry } from './storage-images';

export function ScreenshotPicker({ onConfirm, onClose }: { onConfirm: (asset: ScreenshotSelection) => void; onClose: () => void }) {
  const { colors } = useTheme();
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
  return <FocusLayer><Modal transparent visible animationType="fade" onRequestClose={onClose}>
    <View style={mappingStyles.modal}><ScrollView style={{ width: '100%', maxWidth: 650, maxHeight: '100%', flexGrow: 0 }}><MappingCard>
      <T size={17} weight="bold">Chọn ảnh gameplay</T>
      <T size={11} color={colors.text3}>Ảnh toàn khung game · PNG, JPEG, WebP · tối đa 10 MB</T>
      <View style={mappingStyles.row}>
        <MappingButton disabled={busy} active={mode === 'storage'} onPress={() => browse()}>Ảnh trong Storage</MappingButton>
        <MappingButton disabled={busy} onPress={() => void select(() => pickDeviceScreenshot())}>Thư viện thiết bị</MappingButton>
        {candidate && mode !== 'preview' ? <MappingButton disabled={busy} onPress={() => setMode('preview')}>Ảnh đã chọn</MappingButton> : null}
      </View>
      {mode === 'sources' ? <T size={12} color={colors.text3}>Dùng ảnh đã lưu trên Storage hoặc chọn ảnh từ thư viện của bạn. Quyền truy cập ảnh chỉ được xin khi chọn thư viện thiết bị.</T> : null}
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
        <MappingButton onPress={onClose}>Hủy</MappingButton>
      </View>
    </MappingCard></ScrollView></View>
  </Modal></FocusLayer>;
}
