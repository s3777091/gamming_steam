import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, ScrollView, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useSignedInUser } from '@/features/auth';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { ActionEditor, makeStep, MappingField } from './ActionEditor';
import { disableActiveMapping } from './active';
import { anchorBinding, canvasPoint, CONTROLS, controlLabel, MAX_IMAGE_BYTES, validateProfile, type Binding, type Control, type MappingProfile, type Point } from './model';
import { MappingButton, MappingStatus, mappingStyles } from './MappingUi';
import { mappingRepository } from './service';
import { ScreenshotPicker } from './ScreenshotPicker';
import { releaseStorageScreenshot, type ScreenshotSelection } from './screenshot-sources';

/** Uses screen coordinates for drops, so palette and image need not share a parent. */
function DragToken({ label, onDrop, onTap, selected = false }: { label: string; onDrop: (x: number, y: number) => void; onTap: () => void; selected?: boolean }) {
  const { colors, glass } = useTheme();
  const [offset] = useState(() => new Animated.ValueXY());
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderMove: (_, g) => offset.setValue({ x: g.dx, y: g.dy }),
    onPanResponderRelease: (e, g) => {
      offset.setValue({ x: 0, y: 0 });
      if (Math.hypot(g.dx, g.dy) < 5) { playUiSound('select'); onTap(); }
      else { playUiSound('confirm'); onDrop(e.nativeEvent.pageX, e.nativeEvent.pageY); }
    },
    onPanResponderTerminate: () => offset.setValue({ x: 0, y: 0 }),
  }), [offset, onDrop, onTap]);
  return <Animated.View {...responder.panHandlers} accessibilityLabel={label} accessibilityRole="button" accessibilityActions={[{ name: 'activate', label: 'Chọn' }]} onAccessibilityAction={onTap} style={{ transform: offset.getTranslateTransform(), minWidth: 42, minHeight: 42, paddingHorizontal: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 21, borderWidth: 2, borderColor: selected ? colors.accentSoft : glass.controlBorder, backgroundColor: selected ? colors.primary : glass.panel, zIndex: 20 }}><T size={11} weight="bold">{label}</T></Animated.View>;
}

class CanvasGesture {
  private context: { panning: boolean; pan: Point; onPan: (point: Point) => void; onPick: (e: GestureResponderEvent) => void; picking: boolean } | null = null;
  private start: Point = { x: 0, y: 0 };
  readonly responder = PanResponder.create({
    onStartShouldSetPanResponder: () => Boolean(this.context?.panning || this.context?.picking),
    onPanResponderGrant: () => { this.start = this.context?.pan ?? { x: 0, y: 0 }; },
    onPanResponderMove: (_: GestureResponderEvent, g: { dx: number; dy: number }) => { if (this.context?.panning) this.context.onPan({ x: this.start.x + g.dx, y: this.start.y + g.dy }); },
    onPanResponderRelease: (e: GestureResponderEvent) => { if (this.context && !this.context.panning && this.context.picking) this.context.onPick(e); },
  });
  update(context: NonNullable<CanvasGesture['context']>) { this.context = context; }
}

type History = { past: MappingProfile[]; current: MappingProfile; future: MappingProfile[] };
export default function MappingEditor() {
  const params = useLocalSearchParams<{ profileId?: string; gameId?: string; gameTitle?: string }>();
  const { userId } = useSignedInUser();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { insets } = useUi();
  const [history, setHistory] = useState<History | null>(null);
  const [previous, setPrevious] = useState<MappingProfile | null>(null);
  const [savedJson, setSavedJson] = useState('');
  const [uri, setUri] = useState<string | null>(null);
  const [upload, setUpload] = useState<ScreenshotSelection | null>(null);
  const ownedImages = useRef(new Set<string>());
  const [imageDialog, setImageDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const savingLock = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [properties, setProperties] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState<Point>({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const [visible, setVisible] = useState(true);
  const [palettePage, setPalettePage] = useState(0);
  const [pick, setPick] = useState<{ binding: string; index: number; end: boolean } | null>(null);
  const [box, setBox] = useState({ width: 1, height: 1 });
  const canvas = useRef<View>(null);
  const profile = history?.current ?? null;
  const binding = profile?.bindings.find(b => b.id === selected);
  const dirty = Boolean(upload || (profile && JSON.stringify(profile) !== savedJson));

  usePreventRemove(dirty || saving, ({ data }) => {
    if (saving) { setNotice('Đang lưu. Vui lòng chờ Supabase xác nhận.'); return; }
    Alert.alert('Thay đổi chưa lưu', 'Rời editor và bỏ thay đổi?', [{ text: 'Ở lại', style: 'cancel' }, { text: 'Bỏ thay đổi', style: 'destructive', onPress: () => navigation.dispatch(data.action) }]);
  });
  useBack(() => { if (properties) setProperties(false); else router.back(); });
  useEffect(() => { const owned = ownedImages.current; return () => { owned.forEach(releaseStorageScreenshot); owned.clear(); }; }, []);
  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (params.profileId) {
          disableActiveMapping(params.profileId);
          const loaded = await mappingRepository().load(userId, params.profileId);
          if (!alive) return;
          setPrevious(loaded); setHistory({ past: [], current: loaded, future: [] }); setSavedJson(JSON.stringify(loaded));
          try { const imageUri = await mappingRepository().screenshotUrl(loaded); if (alive) setUri(imageUri); }
          catch (e) { if (alive) { setError((e as Error).message); setImageDialog(true); } }
        } else {
          if (!params.gameId || !params.gameTitle) throw new Error('Chưa chọn game.');
          const now = new Date().toISOString();
          const draft: MappingProfile = { id: Crypto.randomUUID(), user_id: userId, game_id: params.gameId, game_title: params.gameTitle, name: '', description: '', screenshot_path: '', screenshot: { width: 1920, height: 1080 }, bindings: [], settings: { markerOpacity: 0.85 }, schema_version: 1, created_at: now, updated_at: now };
          if (alive) { setHistory({ past: [], current: draft, future: [] }); setSavedJson(JSON.stringify(draft)); setImageDialog(true); }
        }
      } catch (e) { if (alive) setError((e as Error).message); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [params.gameId, params.gameTitle, params.profileId, userId]);
  const commit = (next: MappingProfile) => setHistory(h => h ? { past: [...h.past.slice(-39), h.current], current: next, future: [] } : h);
  const changeBinding = (next: Binding) => { if (profile) commit({ ...profile, bindings: profile.bindings.map(b => b.id === next.id ? anchorBinding(next) : b) }); };
  const place = (b: Binding, point: Point) => {
    let moved = false;
    changeBinding({ ...b, point, steps: b.steps.map(step => {
      if (!moved && 'point' in step) { moved = true; return { ...step, point }; } return step;
    }) });
  };
  const pointFromScreen = (x: number, y: number, done: (p: Point) => void) => canvas.current?.measureInWindow((left, top, width, height) => {
    if (!profile) return;
    if (x < left || y < top || x > left + width || y > top + height) { setNotice('Thả nút trong ảnh gameplay.'); return; }
    const p = canvasPoint(x - left, y - top, { width, height }, profile.screenshot, zoom, pan);
    if (p) done(p); else setNotice('Vị trí nằm ngoài ảnh.');
  });
  const add = (control: Control, point: Point) => {
    if (!profile || !uri || profile.bindings.length >= 64) return;
    const b: Binding = { id: Crypto.randomUUID(), name: controlLabel(control), controls: [control], point, steps: [makeStep('tap', point)], repeat: 1, physicalHold: false };
    commit({ ...profile, bindings: [...profile.bindings, b] }); setSelected(b.id);
  };
  const save = async () => {
    if (!profile || savingLock.current) return;
    savingLock.current = true; setSaving(true); setError(null); setNotice(null);
    try {
      validateProfile(profile);
      const file = upload ? new File(upload.uri) : null;
      if (file && file.size > MAX_IMAGE_BYTES) throw new Error('Ảnh vượt quá 10 MB.');
      const bytes = file ? await file.arrayBuffer() : null;
      if (!upload) await mappingRepository().screenshotUrl(profile);
      const saved = await mappingRepository().save(profile, previous, bytes && upload ? { bytes, mime: upload.mimeType! } : undefined, Crypto.randomUUID());
      setPrevious(saved.profile); setHistory({ past: [], current: saved.profile, future: [] }); setSavedJson(JSON.stringify(saved.profile)); setUpload(null);
      setNotice(saved.warning ?? 'Đã lưu profile vào Supabase. Mở GuideMenu để kích hoạt.'); playUiSound('confirm');
    } catch (e) { setError((e as Error).message); playUiSound('back'); }
    finally { savingLock.current = false; setSaving(false); }
  };
  const [canvasGesture] = useState(() => new CanvasGesture());
  useLayoutEffect(() => {
    canvasGesture.update({ panning, pan, picking: Boolean(pick), onPan: setPan,
      onPick: (event: GestureResponderEvent) => {
        if (!profile || !pick) return;
        const target = pick;
        const p = canvasPoint(event.nativeEvent.locationX, event.nativeEvent.locationY, box, profile.screenshot, zoom, pan);
        if (!p) return;
        const next = { ...profile, bindings: profile.bindings.map(b => b.id !== target.binding ? b : anchorBinding({ ...b, steps: b.steps.map((step, i) => i !== target.index || !('point' in step) ? step : target.end && step.type === 'drag' ? { ...step, end: p } : { ...step, point: p }) })) };
        setHistory(h => h ? { past: [...h.past.slice(-39), h.current], current: next, future: [] } : h);
        setPick(null); setProperties(true); playUiSound('confirm');
      },
    });
  }, [box, canvasGesture, pan, panning, pick, profile, zoom]);
  const scale = profile ? Math.min(box.width / profile.screenshot.width, box.height / profile.screenshot.height) * zoom : 1;
  const imageWidth = (profile?.screenshot.width ?? 1) * scale; const imageHeight = (profile?.screenshot.height ?? 1) * scale;
  const origin = { x: (box.width - imageWidth) / 2 + pan.x, y: (box.height - imageHeight) / 2 + pan.y };
  const screenPoint = (p: Point) => ({ x: origin.x + p.x * imageWidth, y: origin.y + p.y * imageHeight });

  return <View pointerEvents={saving ? 'none' : 'auto'} style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8, paddingLeft: insets.left + 12, paddingRight: insets.right + 12, gap: 8 }}>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <View style={mappingStyles.row}><MappingButton disabled={saving} onPress={() => router.back()}>Quay lại</MappingButton><View style={{ flex: 1 }}><T size={15} weight="bold">{profile?.game_title ?? 'Thiết lập nút'}</T><T size={10} color={colors.text3}>{dirty ? 'Chưa lưu' : 'Đã đồng bộ'} · kéo nút lên ảnh, chạm marker để cấu hình</T></View>
      <View style={{ width: 180 }}>{profile ? <MappingField label="Tên profile" value={profile.name} onChange={name => commit({ ...profile, name })} /> : null}</View><MappingButton disabled={saving || !profile || !uri} active onPress={() => void save()}>{saving ? 'Đang lưu…' : 'Lưu'}</MappingButton></View>
    <MappingStatus loading={loading} error={error} />
    {notice ? <T size={11} accessibilityLiveRegion="polite" color={colors.accentSoft}>{notice}</T> : null}
    <ScrollView horizontal style={{ flexGrow: 0, maxHeight: 48 }} contentContainerStyle={{ alignItems: 'center', gap: 8, paddingVertical: 3 }} showsHorizontalScrollIndicator={false}>
      <MappingButton disabled={!history?.past.length || saving} onPress={() => setHistory(h => h?.past.length ? { past: h.past.slice(0, -1), current: h.past[h.past.length - 1], future: [h.current, ...h.future] } : h)}>Hoàn tác</MappingButton>
      <MappingButton disabled={!history?.future.length || saving} onPress={() => setHistory(h => h?.future.length ? { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) } : h)}>Làm lại</MappingButton>
      <MappingButton onPress={() => setZoom(z => Math.max(1, z - 0.25))}>−</MappingButton><T size={11}>{Math.round(zoom * 100)}%</T><MappingButton onPress={() => setZoom(z => Math.min(4, z + 0.25))}>+</MappingButton>
      <MappingButton active={panning} onPress={() => setPanning(v => !v)}>Di ảnh</MappingButton><MappingButton onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Vừa ảnh</MappingButton>
      <MappingButton onPress={() => setVisible(v => !v)}>{visible ? 'Ẩn marker' : 'Hiện marker'}</MappingButton>
      <MappingButton disabled={!profile} onPress={() => { if (profile) commit({ ...profile, settings: { markerOpacity: profile.settings.markerOpacity > 0.9 ? 0.4 : profile.settings.markerOpacity > 0.6 ? 1 : 0.7 } }); }}>Độ mờ</MappingButton>
      <MappingButton disabled={saving} onPress={() => setImageDialog(true)}>Thay ảnh</MappingButton>
      {binding ? <><MappingButton onPress={() => setProperties(true)}>Sửa {binding.name}</MappingButton><MappingButton onPress={() => place(binding, { x: 0.5, y: 0.5 })}>Đặt giữa</MappingButton></> : null}
    </ScrollView>
    {pick ? <View style={mappingStyles.row}><T size={12} color={colors.accentSoft}>Chạm ảnh để đặt {pick.end ? 'điểm cuối' : 'vị trí bước'}.</T><MappingButton onPress={() => { setPick(null); setProperties(true); }}>Hủy</MappingButton></View> : null}
    <View ref={canvas} collapsable={false} onLayout={e => setBox(e.nativeEvent.layout)} {...canvasGesture.responder.panHandlers} style={{ flex: 1, minHeight: 80, backgroundColor: '#000', borderRadius: 12, overflow: 'hidden' }}>
      {uri ? <Img source={{ uri }} contentFit="fill" style={{ position: 'absolute', left: origin.x, top: origin.y, width: imageWidth, height: imageHeight }} onError={() => setError('Không hiển thị được ảnh. Hãy tải lại hoặc thay ảnh.')} /> : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}><T size={13}>Tải ảnh gameplay để bắt đầu</T></View>}
      {visible && profile ? <>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>{profile.bindings.flatMap(b => b.steps.map((step, i) => step.type === 'drag' ? <Line key={`${b.id}:${i}`} x1={screenPoint(step.point).x} y1={screenPoint(step.point).y} x2={screenPoint(step.end).x} y2={screenPoint(step.end).y} stroke={colors.accentSoft} strokeWidth={2} /> : null))}</Svg>
        {profile.bindings.map(b => { const p = screenPoint(b.point); return <View key={b.id} pointerEvents={panning || pick ? 'none' : 'auto'} style={{ position: 'absolute', left: p.x - 21, top: p.y - 21, opacity: profile.settings.markerOpacity }}><DragToken label={b.controls.map(controlLabel).join('+')} selected={selected === b.id} onTap={() => { setSelected(b.id); setProperties(true); }} onDrop={(x, y) => pointFromScreen(x, y, point => { setSelected(b.id); place(b, point); })} /></View>; })}
      </> : null}
    </View>
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, zIndex: 30 }}>
      <MappingButton disabled={palettePage === 0} onPress={() => setPalettePage(p => p - 1)}>‹</MappingButton>
      {CONTROLS.slice(palettePage * 6, palettePage * 6 + 6).map(control => <DragToken key={control} label={controlLabel(control)} onTap={() => add(control, { x: 0.5, y: 0.5 })} onDrop={(x, y) => pointFromScreen(x, y, point => add(control, point))} />)}
      <MappingButton disabled={(palettePage + 1) * 6 >= CONTROLS.length} onPress={() => setPalettePage(p => p + 1)}>›</MappingButton>
      <T size={10} color={colors.text3}>{palettePage + 1}/{Math.ceil(CONTROLS.length / 6)}</T>
    </View>
    {properties && binding ? <ActionEditor binding={binding} onClose={() => setProperties(false)} onChange={changeBinding} onDelete={() => { if (profile) commit({ ...profile, bindings: profile.bindings.filter(b => b.id !== binding.id) }); setProperties(false); setSelected(null); }} onPick={(index, end) => { setPick({ binding: binding.id, index, end }); setProperties(false); setPanning(false); }} /> : null}
    {imageDialog && profile ? <ScreenshotPicker onClose={() => setImageDialog(false)} onConfirm={candidate => {
      ownedImages.current.forEach(releaseStorageScreenshot); ownedImages.current.clear();
      if (candidate.origin === 'storage') ownedImages.current.add(candidate.uri);
      setHistory({ past: [], current: { ...profile, screenshot: { width: candidate.width, height: candidate.height } }, future: [] }); setUpload(candidate); setUri(candidate.uri); setImageDialog(false); setError(null); setZoom(1); setPan({ x: 0, y: 0 });
    }} /> : null}
  </View>;
}
