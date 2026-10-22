import { useEffect, useRef, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Camera,
  Check,
  ChevronLeft,
  ChevronRight,
  Cloud,
  Folder,
  FolderOpen,
  FolderUp,
  HardDrive,
  ImagePlus,
  RefreshCw,
  Smartphone,
  X,
} from 'lucide-react-native';
import { FocusScroll, ensureFocusActive } from '@/features/gamepad/focus';
import { useBack, useGamepadTabs } from '@/features/gamepad/hooks';
import { SCREENSHOT_FOLDER, screenshotAuthHeaders, screenshotImageSource } from '@/lib/game-screenshots';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { T } from '@/ui/Text';
import { useUi } from '@/ui/scale';
import { MAX_IMAGE_BYTES } from './model';
import {
  MappingButton,
  MappingDivider,
  MappingModal,
  MappingSegmented,
  MappingStatus,
  mappingColors,
} from './MappingUi';
import { PhotoPermissionError } from './photo-permissions';
import {
  pickDeviceScreenshot,
  prepareStorageScreenshot,
  releaseStorageScreenshot,
  type ScreenshotSelection,
} from './screenshot-sources';
import { listStorageImages, type ImageStorageMode, type StorageImageEntry } from './storage-images';

type TabKey = 'cloud' | 'local' | 'device';

export function ScreenshotPicker({ onConfirm, onClose }: { onConfirm: (asset: ScreenshotSelection) => void; onClose: () => void }) {
  const { s } = useUi();
  const [tab, setTab] = useState<TabKey>('cloud');
  const [folder, setFolder] = useState('Images');
  const [refresh, setRefresh] = useState(0);
  const [browser, setBrowser] = useState<{ entries: StorageImageEntry[]; headers: Record<string, string>; loading: boolean }>({
    entries: [],
    headers: {},
    loading: true,
  });
  const [candidate, setCandidate] = useState<ScreenshotSelection | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settingsAvailable, setSettingsAvailable] = useState(false);
  const busyLock = useRef(false);
  const mounted = useRef(false);
  const selectionRequest = useRef<AbortController | null>(null);
  const browserGeneration = useRef(0);
  const ownedFiles = useRef(new Set<string>());

  // Gamepad B button: if in preview mode, cancel preview; otherwise close dialog
  useBack(() => {
    if (candidate) {
      setCandidate(null);
      return;
    }
    onClose();
  });

  const browse = (path = folder, targetTab: 'cloud' | 'local' = tab === 'local' ? 'local' : 'cloud') => {
    browserGeneration.current++;
    setError(null);
    setSettingsAvailable(false);
    setBrowser({ entries: [], headers: {}, loading: true });
    setFolder(path);
    setTab(targetTab);
    setRefresh(value => value + 1);
  };

  // Gamepad LB / RB: switch between Cloud Storage, PC Storage, Thư viện máy
  useGamepadTabs(direction => {
    const tabs: TabKey[] = ['cloud', 'local', 'device'];
    const idx = tabs.indexOf(tab);
    const nextTab = tabs[(idx + direction + tabs.length) % tabs.length];
    setTab(nextTab);
    setError(null);
    if (nextTab !== 'device') {
      browse(folder, nextTab);
    }
  });

  useEffect(() => {
    ensureFocusActive();
    mounted.current = true;
    const owned = ownedFiles.current;
    return () => {
      mounted.current = false;
      selectionRequest.current?.abort();
      owned.forEach(releaseStorageScreenshot);
      owned.clear();
    };
  }, []);

  const storageMode: ImageStorageMode = tab === 'local' ? 'local' : 'cloud';

  useEffect(() => {
    if (tab === 'device') return;
    const controller = new AbortController();
    const generation = browserGeneration.current;
    void Promise.all([listStorageImages(folder, controller.signal, storageMode), screenshotAuthHeaders()])
      .then(([entries, headers]) => {
        if (!controller.signal.aborted && generation === browserGeneration.current) {
          setBrowser({ entries, headers, loading: false });
        }
      })
      .catch(e => {
        if (!controller.signal.aborted && generation === browserGeneration.current) {
          setError((e as Error).message);
          setBrowser({ entries: [], headers: {}, loading: false });
        }
      });
    return () => controller.abort();
  }, [folder, refresh, storageMode, tab]);

  const select = async (task: (signal: AbortSignal) => Promise<ScreenshotSelection | null>) => {
    if (busyLock.current) return;
    busyLock.current = true;
    setBusy(true);
    setError(null);
    setSettingsAvailable(false);
    const controller = new AbortController();
    selectionRequest.current = controller;
    try {
      const selected = await task(controller.signal);
      if (!selected) return;
      if (!mounted.current) {
        if (selected.origin === 'storage') releaseStorageScreenshot(selected.uri);
        return;
      }
      if (candidate?.origin === 'storage') {
        releaseStorageScreenshot(candidate.uri);
        ownedFiles.current.delete(candidate.uri);
      }
      if (selected.origin === 'storage') ownedFiles.current.add(selected.uri);
      setCandidate(selected);
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

  const parentFolder = folder.includes('/') ? folder.split('/').slice(0, -1).join('/') : '';
  const isAtRoot = folder === '';
  const pathParts = folder ? folder.split('/') : [];

  return (
    <MappingModal onClose={onClose} wide>
      <FocusScroll
        style={{ flexGrow: 0, flexShrink: 1 }}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled">
        <View style={{
          padding: s(12),
          gap: s(10),
          borderRadius: s(14),
          borderWidth: 1,
          borderColor: mappingColors.borderAccent,
          backgroundColor: mappingColors.card,
        }}>
          {/* Modal Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10) }}>
            <View style={{
              width: s(32),
              height: s(32),
              borderRadius: s(9),
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: mappingColors.accentSoft,
            }}>
              <ImagePlus size={s(17)} color={mappingColors.accent} />
            </View>
            <View style={{ flex: 1, minWidth: 0, gap: s(2) }}>
              <T size={12.5} color={mappingColors.text} weight="bold">Chọn ảnh gameplay</T>
              <T size={9} color={mappingColors.muted}>Ảnh chụp nền để căn chỉnh và đặt các phím gamepad ảo</T>
            </View>
            <MappingButton label="Đóng chọn ảnh" onPress={onClose} variant="ghost" style={{ paddingHorizontal: s(6) }}>
              <X size={s(15)} color={mappingColors.muted} />
            </MappingButton>
          </View>

          {/* Candidate Selected Preview Mode */}
          {candidate ? (
            <View style={{
              gap: s(10),
              padding: s(10),
              borderRadius: s(10),
              backgroundColor: mappingColors.panel,
              borderWidth: 1,
              borderColor: mappingColors.border,
            }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                <T size={10} weight="semibold" color={mappingColors.accent}>Xem trước ảnh đã chọn</T>
              </View>

              <View style={{
                height: s(140),
                borderRadius: s(8),
                overflow: 'hidden',
                backgroundColor: '#07070c',
                borderWidth: 1,
                borderColor: mappingColors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                <Img source={{ uri: candidate.uri }} contentFit="contain" style={{ width: '100%', height: '100%' }} />
              </View>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: s(8) }}>
                <View style={{ flex: 1, minWidth: 140, gap: s(2) }}>
                  <T size={11} color={mappingColors.text} weight="semibold" numberOfLines={1}>{candidate.name}</T>
                  <T size={9} color={mappingColors.muted}>
                    {candidate.origin === 'storage' ? (tab === 'local' ? 'PC Storage' : 'Cloud Storage') : 'Thư viện thiết bị'} · {candidate.width} × {candidate.height} px
                  </T>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                  <MappingButton disabled={busy} variant="ghost" onPress={() => setCandidate(null)}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                      <ChevronLeft size={s(13)} color={mappingColors.muted} />
                      <T size={10} color={mappingColors.muted}>Đổi ảnh khác</T>
                    </View>
                  </MappingButton>

                  <MappingButton
                    autoFocus
                    disabled={busy}
                    variant="primary"
                    onPress={() => {
                      ownedFiles.current.delete(candidate.uri);
                      onConfirm(candidate);
                    }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
                      <Check size={s(14)} color="#ffffff" />
                      <T size={10.5} weight="bold" color="#ffffff">Dùng ảnh này</T>
                    </View>
                  </MappingButton>
                </View>
              </View>
            </View>
          ) : (
            <>
              {/* Source Selection Tabs */}
              <MappingSegmented<TabKey>
                value={tab}
                onChange={nextTab => {
                  setTab(nextTab);
                  setError(null);
                  if (nextTab !== 'device') {
                    browse(folder, nextTab);
                  }
                }}
                options={[
                  { key: 'cloud', label: 'Cloud Storage', icon: Cloud },
                  { key: 'local', label: 'PC Storage', icon: HardDrive },
                  { key: 'device', label: 'Thư viện máy', icon: Smartphone },
                ]}
              />

              {/* Device Library Card */}
              {tab === 'device' ? (
                <View style={{
                  padding: s(16),
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: s(10),
                  borderRadius: s(12),
                  backgroundColor: mappingColors.panel,
                  borderWidth: 1,
                  borderStyle: 'dashed',
                  borderColor: mappingColors.borderAccent,
                }}>
                  <View style={{
                    width: s(46),
                    height: s(46),
                    borderRadius: s(23),
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: mappingColors.accentSoft,
                  }}>
                    <Smartphone size={s(24)} color={mappingColors.accent} />
                  </View>
                  <View style={{ alignItems: 'center', gap: s(3) }}>
                    <T size={12} weight="semibold" color={mappingColors.text}>Chọn ảnh chụp từ máy của bạn</T>
                    <T size={9.5} color={mappingColors.muted} style={{ textAlign: 'center' }}>
                      Dùng ảnh chụp màn hình game từ Thư viện Ảnh (Photos / Gallery). Hỗ trợ PNG, JPG, WebP tối đa 10 MB.
                    </T>
                  </View>
                  <MappingButton
                    autoFocus
                    disabled={busy}
                    variant="primary"
                    onPress={() => void select(() => pickDeviceScreenshot())}
                    style={{ paddingHorizontal: s(14), minHeight: Math.max(40, s(30)) }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                      <ImagePlus size={s(15)} color="#ffffff" />
                      <T size={10.5} weight="semibold" color="#ffffff">Mở thư viện ảnh</T>
                    </View>
                  </MappingButton>
                </View>
              ) : (
                <>
                  {/* Storage Breadcrumbs & Action Toolbar */}
                  <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: s(6),
                    paddingHorizontal: s(8),
                    paddingVertical: s(6),
                    borderRadius: s(8),
                    backgroundColor: mappingColors.panel,
                    borderWidth: 1,
                    borderColor: mappingColors.border,
                  }}>
                    {/* Breadcrumbs */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: s(3), flex: 1, minWidth: 140 }}>
                      <Press
                        onPress={() => browse('')}
                        focusRadius={s(6)}
                        focusVariant="card"
                        style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), paddingHorizontal: s(6), paddingVertical: s(3), borderRadius: s(5) }}>
                        {tab === 'local' ? <HardDrive size={s(12)} color={mappingColors.accent} /> : <Cloud size={s(12)} color={mappingColors.accent} />}
                        <T size={9.5} weight={isAtRoot ? 'bold' : 'regular'} color={isAtRoot ? mappingColors.text : mappingColors.muted}>
                          {tab === 'local' ? 'PC' : 'Cloud'}
                        </T>
                      </Press>

                      {pathParts.map((part, index) => {
                        const currentPath = pathParts.slice(0, index + 1).join('/');
                        const isLast = index === pathParts.length - 1;
                        return (
                          <View key={currentPath} style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
                            <ChevronRight size={s(11)} color={mappingColors.border} />
                            <Press
                              onPress={() => browse(currentPath)}
                              focusRadius={s(6)}
                              focusVariant="card"
                              style={{ paddingHorizontal: s(6), paddingVertical: s(3), borderRadius: s(5) }}>
                              <T size={9.5} weight={isLast ? 'bold' : 'regular'} color={isLast ? mappingColors.text : mappingColors.muted}>
                                {part}
                              </T>
                            </Press>
                          </View>
                        );
                      })}
                    </View>

                    {/* Quick Actions */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                      <MappingButton
                        disabled={busy || isAtRoot}
                        variant="ghost"
                        label="Lên thư mục cha"
                        onPress={() => browse(parentFolder)}
                        style={{ paddingHorizontal: s(6) }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
                          <FolderUp size={s(12)} color={isAtRoot ? mappingColors.border : mappingColors.muted} />
                          <T size={9} color={isAtRoot ? mappingColors.border : mappingColors.muted}>Lên</T>
                        </View>
                      </MappingButton>

                      {tab === 'local' ? (
                        <MappingButton
                          disabled={busy}
                          variant="ghost"
                          label="Thư mục ảnh chụp game"
                          onPress={() => browse(SCREENSHOT_FOLDER, 'local')}
                          style={{ paddingHorizontal: s(6) }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(3) }}>
                            <Camera size={s(12)} color={mappingColors.accent} />
                            <T size={9} color={mappingColors.accent}>Ảnh game</T>
                          </View>
                        </MappingButton>
                      ) : null}

                      <MappingButton
                        disabled={busy || browser.loading}
                        variant="ghost"
                        label="Tải lại danh sách"
                        onPress={() => browse()}
                        style={{ paddingHorizontal: s(6) }}>
                        <RefreshCw size={s(12)} color={mappingColors.muted} />
                      </MappingButton>
                    </View>
                  </View>

                  {/* Entries List / Grid */}
                  <MappingStatus loading={browser.loading} />

                  {!browser.loading && !browser.entries.length ? (
                    <View style={{
                      padding: s(20),
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: s(8),
                      borderRadius: s(10),
                      backgroundColor: mappingColors.panel,
                      borderWidth: 1,
                      borderColor: mappingColors.border,
                    }}>
                      <FolderOpen size={s(32)} color={mappingColors.muted} />
                      <T size={11} color={mappingColors.muted}>Thư mục này chưa có ảnh phù hợp</T>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                        {tab === 'local' ? (
                          <MappingButton onPress={() => browse(SCREENSHOT_FOLDER, 'local')}>
                            <T size={9.5} color={mappingColors.accent}>Mở Ảnh chụp game</T>
                          </MappingButton>
                        ) : null}
                        <MappingButton onPress={() => void select(() => pickDeviceScreenshot())}>
                          <T size={9.5} color={mappingColors.accent}>Chọn từ Thiết bị</T>
                        </MappingButton>
                      </View>
                    </View>
                  ) : null}

                  {browser.entries.length ? (
                    <FocusScroll
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={{ flexGrow: 0, height: s(128), marginHorizontal: -s(2) }}
                      contentContainerStyle={{ gap: s(8), paddingHorizontal: s(2), paddingVertical: s(4) }}>
                      {browser.entries.map((item, index) => {
                        const tooLarge = !item.isDir && item.size > MAX_IMAGE_BYTES;
                        const fileSizeMb = (item.size / (1024 * 1024)).toFixed(1);

                        return (
                          <Press
                            key={item.path}
                            disabled={busy || tooLarge}
                            autoFocus={index === 0}
                            focusRadius={s(10)}
                            focusVariant="card"
                            onPress={() => {
                              if (item.isDir) {
                                browse(item.path);
                              } else {
                                void select(signal => prepareStorageScreenshot(item, signal, storageMode));
                              }
                            }}
                            accessibilityLabel={`${item.isDir ? 'Mở thư mục' : 'Chọn ảnh'} ${item.name}`}
                            style={{
                              width: s(142),
                              height: s(120),
                              borderRadius: s(10),
                              backgroundColor: mappingColors.panel,
                              borderWidth: 1,
                              borderColor: mappingColors.border,
                              padding: s(5),
                              gap: s(4),
                              opacity: tooLarge ? 0.38 : 1,
                            }}>
                            <View style={{
                              flex: 1,
                              borderRadius: s(7),
                              overflow: 'hidden',
                              backgroundColor: '#090812',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {item.isDir ? (
                                <View style={{ alignItems: 'center', gap: s(4) }}>
                                  <Folder color={mappingColors.accent} size={s(28)} />
                                  <T size={8.5} color={mappingColors.muted}>Thư mục</T>
                                </View>
                              ) : tooLarge ? (
                                <T size={9.5} color={mappingColors.danger}>Vượt 10 MB</T>
                              ) : (
                                <Img
                                  source={{
                                    ...screenshotImageSource(item.path, browser.headers, storageMode),
                                    cacheKey: `mapping-storage:${storageMode}:${item.path}:${item.modified}`,
                                  }}
                                  style={StyleSheet.absoluteFill}
                                  contentFit="cover"
                                />
                              )}

                              {!item.isDir && !tooLarge ? (
                                <View style={{
                                  position: 'absolute',
                                  right: s(4),
                                  bottom: s(4),
                                  backgroundColor: 'rgba(9, 8, 18, 0.78)',
                                  paddingHorizontal: s(4),
                                  paddingVertical: s(1),
                                  borderRadius: s(4),
                                }}>
                                  <T size={7.5} color={mappingColors.mutedLight}>{fileSizeMb} MB</T>
                                </View>
                              ) : null}
                            </View>

                            <T size={9.5} color={mappingColors.text} numberOfLines={1}>
                              {item.name}
                            </T>
                          </Press>
                        );
                      })}
                    </FocusScroll>
                  ) : null}
                </>
              )}
            </>
          )}

          <MappingDivider />

          {/* Error & Settings notice */}
          <MappingStatus loading={busy} error={error} />
          {settingsAvailable ? (
            <MappingButton onPress={() => void Linking.openSettings().catch(() => setError('Không mở được Cài đặt.'))}>
              Mở Cài đặt quyền ảnh thiết bị
            </MappingButton>
          ) : null}

          {/* Modal Bottom Footer */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8) }}>
            <T size={8.5} color={mappingColors.muted}>Hỗ trợ PNG, JPEG, WebP · Tối đa 10 MB</T>
            <MappingButton onPress={onClose} variant="ghost" style={{ paddingHorizontal: s(12) }}>
              Đóng
            </MappingButton>
          </View>
        </View>
      </FocusScroll>
    </MappingModal>
  );
}
