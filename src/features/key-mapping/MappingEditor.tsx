import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Alert, Animated, PanResponder, ScrollView, StyleSheet, TextInput, View, type GestureResponderEvent } from 'react-native';
import { ArrowLeft, CheckCircle2, ChevronLeft, ChevronRight, Eye, EyeOff, ImagePlus, Maximize, MoreHorizontal, Move, Redo2, Undo2, X } from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';
import { useSignedInUser } from '@/features/auth';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { Img } from '@/ui/Img';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { ActionEditor, makeStep } from './ActionEditor';
import { disableActiveMapping } from './active';
import { anchorBinding, canvasPoint, CONTROLS, controlLabel, MAX_IMAGE_BYTES, validateProfile, type Binding, type Control, type MappingProfile, type Point } from './model';
import { MappingButton, MappingStatus, mappingColors, mappingStyles } from './MappingUi';
import { mappingRepository } from './service';
import { ScreenshotPicker } from './ScreenshotPicker';
import { releaseStorageScreenshot, type ScreenshotSelection } from './screenshot-sources';

/** Uses screen coordinates for drops, so palette and image need not share a parent. */
class TokenGesture {
  private context = { disabled: false, size: 40, onTap: () => {}, onDrop: (_x: number, _y: number, settled: () => void) => settled() };
  private grab = { x: 0, y: 0 };
  readonly responder;
  constructor(offset: Animated.ValueXY) {
    this.responder = PanResponder.create({
      onStartShouldSetPanResponder: () => !this.context.disabled,
      onPanResponderGrant: e => { this.grab = { x: this.context.size / 2 - e.nativeEvent.locationX, y: this.context.size / 2 - e.nativeEvent.locationY }; },
      // No state updates or timing animations while a marker follows the pointer.
      onPanResponderMove: Animated.event([null, { dx: offset.x, dy: offset.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, g) => {
        const settled = () => offset.setValue({ x: 0, y: 0 });
        if (Math.hypot(g.dx, g.dy) < 5) { settled(); playUiSound('select'); this.context.onTap(); }
        else { playUiSound('confirm'); this.context.onDrop(e.nativeEvent.pageX + this.grab.x, e.nativeEvent.pageY + this.grab.y, settled); }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => offset.setValue({ x: 0, y: 0 }),
    });
  }
  update(context: TokenGesture['context']) { this.context = context; }
}

function DragToken({ label, onDrop, onTap, selected = false, palette = false, disabled = false }: { label: string; onDrop: (x: number, y: number, settled: () => void) => void; onTap: () => void; selected?: boolean; palette?: boolean; disabled?: boolean }) {
  const { s } = useUi();
  const size = Math.max(40, s(30));
  const [offset] = useState(() => new Animated.ValueXY());
  const [gesture] = useState(() => new TokenGesture(offset));
  useLayoutEffect(() => { gesture.update({ onDrop, onTap, disabled, size }); }, [disabled, gesture, onDrop, onTap, size]);
  const tint = palette ? ({ A: '#bc94ff', B: '#ff868d', X: '#80b9ff', Y: '#ecca71' }[label] ?? mappingColors.text) : mappingColors.accent;
  return <Animated.View {...gesture.responder.panHandlers} accessibilityLabel={label} accessibilityRole="button" accessibilityState={{ selected, disabled }} accessibilityActions={[{ name: 'activate', label: 'Chọn' }]} onAccessibilityAction={() => { if (!disabled) onTap(); }}
    style={{ transform: offset.getTranslateTransform(), width: size, height: size, paddingHorizontal: s(3), justifyContent: 'center', alignItems: 'center', borderRadius: palette ? s(8) : size / 2, borderWidth: palette ? 1 : 2, borderColor: selected ? '#c99dff' : palette ? mappingColors.border : mappingColors.accent, backgroundColor: palette ? mappingColors.raised : '#231638', opacity: disabled ? 0.4 : 1, zIndex: 40 }}>
    <View pointerEvents="none" style={{ width: '100%' }}><T size={palette ? 10 : 11} color={tint} weight="semibold" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6} style={{ textAlign: 'center' }}>{label}</T></View>
    {selected && !palette ? <View pointerEvents="none" style={{ position: 'absolute', top: -6, bottom: -6, left: -6, right: -6, borderWidth: 1, borderColor: mappingColors.accent }} /> : null}
  </Animated.View>;
}

const PALETTE_GROUPS: { label: string; controls: Control[] }[] = [
  { label: 'Nút cơ bản', controls: ['a', 'b', 'x', 'y', 'l3', 'r3'] },
  { label: 'DPad', controls: ['up', 'down', 'left', 'right'] },
  { label: 'Trigger & Bumper', controls: ['l1', 'r1', 'l2', 'r2'] },
  { label: 'Joystick', controls: CONTROLS.filter(control => control.startsWith('ls-') || control.startsWith('rs-')) },
];

class CanvasGesture {
  private context: { panning: boolean; pan: Point; onPan: (point: Point) => void; onPick: (e: GestureResponderEvent) => void; picking: boolean } | null = null;
  private start: Point = { x: 0, y: 0 };
  readonly responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { this.start = this.context?.pan ?? { x: 0, y: 0 }; },
    onPanResponderMove: (_: GestureResponderEvent, g: { dx: number; dy: number }) => { if (this.context?.panning) this.context.onPan({ x: this.start.x + g.dx, y: this.start.y + g.dy }); },
    onPanResponderRelease: (e: GestureResponderEvent, g: { dx: number; dy: number }) => { if (this.context && !this.context.panning && Math.hypot(g.dx, g.dy) < 5) this.context.onPick(e); },
  });
  update(context: NonNullable<CanvasGesture['context']>) { this.context = context; }
}

type History = { past: MappingProfile[]; current: MappingProfile; future: MappingProfile[] };
export default function MappingEditor() {
  const params = useLocalSearchParams<{ profileId?: string; gameId?: string; gameTitle?: string }>();
  const { userId } = useSignedInUser();
  const navigation = useNavigation();
  const { insets, s, width } = useUi();
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
  const [paletteGroup, setPaletteGroup] = useState(0);
  const [tools, setTools] = useState(false);
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
          const draft: MappingProfile = { id: Crypto.randomUUID(), user_id: userId, game_id: params.gameId, game_title: params.gameTitle, name: 'Profile 1', description: '', screenshot_path: '', screenshot: { width: 1920, height: 1080 }, bindings: [], settings: { markerOpacity: 0.85 }, schema_version: 1, created_at: now, updated_at: now };
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
  const pointFromScreen = (x: number, y: number, done: (p: Point) => void, settled = () => {}) => {
    if (!canvas.current) { settled(); return; }
    canvas.current.measureInWindow((left, top, width, height) => {
    settled();
    if (!profile) return;
    if (x < left || y < top || x > left + width || y > top + height) { setNotice('Thả nút trong ảnh gameplay.'); return; }
    const p = canvasPoint(x - left, y - top, { width, height }, profile.screenshot, zoom, pan);
    if (p) done(p); else setNotice('Vị trí nằm ngoài ảnh.');
    });
  };
  const add = (control: Control, point: Point) => {
    if (!profile || !uri || profile.bindings.length >= 64) return;
    const b: Binding = { id: Crypto.randomUUID(), name: controlLabel(control), controls: [control], point, steps: [makeStep('tap', point)], repeat: 1, physicalHold: false };
    commit({ ...profile, bindings: [...profile.bindings, b] }); setSelected(b.id); setProperties(true);
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
        if (!pick) { setSelected(null); setProperties(false); return; }
        if (!profile) return;
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

  const panelOpen = Boolean(properties && binding);
  const dockWidth = width - insets.left - insets.right - (panelOpen ? Math.min(s(238), width - 32) + s(20) : s(24));
  const paletteSlots = Math.max(2, Math.min(6, Math.floor((dockWidth - 100) / (Math.max(40, s(30)) + s(7)))));
  const controls = PALETTE_GROUPS[paletteGroup].controls;
  const pageCount = Math.ceil(controls.length / paletteSlots);
  const page = Math.min(palettePage, pageCount - 1);
  const undo = () => setHistory(h => h?.past.length ? { past: h.past.slice(0, -1), current: h.past[h.past.length - 1], future: [h.current, ...h.future] } : h);
  const redo = () => setHistory(h => h?.future.length ? { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) } : h);

  return <View pointerEvents={saving ? 'none' : 'auto'} style={{ flex: 1, backgroundColor: mappingColors.bg, paddingTop: insets.top, paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right }}>
    <Stack.Screen options={{ gestureEnabled: false }} />
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(7), paddingHorizontal: s(10), paddingVertical: s(7), borderBottomWidth: 1, borderBottomColor: mappingColors.border }}>
      <MappingButton disabled={saving} label="Quay lại danh sách game" onPress={() => router.back()}><ArrowLeft size={s(16)} color={mappingColors.text} /></MappingButton>
      <View style={{ flex: 1, minWidth: 0, gap: s(4) }}><T size={12} weight="semibold" color={mappingColors.text} numberOfLines={1}>{profile?.game_title ?? 'Thiết lập nút'}</T><View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>{previous && !dirty ? <CheckCircle2 size={s(10)} color={mappingColors.success} /> : null}<T size={8.5} color={dirty || !previous ? mappingColors.muted : mappingColors.success}>{saving ? 'Đang lưu...' : dirty ? 'Chưa lưu thay đổi' : previous ? 'Đã đồng bộ' : 'Bản nháp'}</T></View></View>
      {profile ? <TextInput accessibilityLabel="Tên profile" value={profile.name} onChangeText={name => commit({ ...profile, name })} placeholder="Tên profile" placeholderTextColor={mappingColors.muted} selectTextOnFocus maxLength={80} style={{ width: s(width < 700 ? 94 : 138), color: mappingColors.text, fontSize: s(10.5), paddingHorizontal: s(9), minHeight: 40, borderWidth: 1, borderColor: mappingColors.border, borderRadius: s(6), backgroundColor: mappingColors.raised }} /> : null}
      {width >= 840 ? <><MappingButton label="Hoàn tác" disabled={!history?.past.length || saving} onPress={undo}><Undo2 size={s(15)} color={mappingColors.text} /></MappingButton><MappingButton label="Làm lại" disabled={!history?.future.length || saving} onPress={redo}><Redo2 size={s(15)} color={mappingColors.text} /></MappingButton></> : null}
      {width >= 700 ? <><MappingButton label="Đổi mức thu phóng" onPress={() => setZoom(z => z >= 4 ? 1 : z + 0.5)}>{Math.round(zoom * 100)}%</MappingButton><MappingButton label="Vừa ảnh" onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}><Maximize size={s(15)} color={mappingColors.text} /></MappingButton></> : null}
      <MappingButton disabled={saving} label="Chọn ảnh gameplay" onPress={() => setImageDialog(true)}><ImagePlus size={s(15)} color={mappingColors.text} /></MappingButton>
      <MappingButton disabled={saving || !profile || !uri} active onPress={() => void save()} style={{ backgroundColor: mappingColors.primary, minWidth: s(57) }}>{saving ? 'Đang lưu...' : 'Lưu'}</MappingButton>
      <MappingButton label="Công cụ mapping" active={tools} onPress={() => setTools(value => !value)}><MoreHorizontal size={s(17)} color={mappingColors.text} /></MappingButton>
    </View>
    <View style={{ flex: 1 }}>
    <View ref={canvas} collapsable={false} onLayout={e => setBox(e.nativeEvent.layout)} {...canvasGesture.responder.panHandlers} style={{ flex: 1, minHeight: 80, backgroundColor: '#09090e', overflow: 'hidden' }}>
      {uri ? <Img source={{ uri }} contentFit="fill" style={{ position: 'absolute', left: origin.x, top: origin.y, width: imageWidth, height: imageHeight }} onError={() => setError('Không hiển thị được ảnh. Hãy tải lại hoặc thay ảnh.')} /> : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: s(12) }}><ImagePlus size={s(32)} color={mappingColors.muted} /><T size={13} color={mappingColors.text}>Chọn ảnh gameplay để bắt đầu</T><MappingButton onPress={() => setImageDialog(true)}>Chọn ảnh</MappingButton></View>}
      {visible && profile ? <>
        <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>{profile.bindings.flatMap(b => b.steps.map((step, i) => step.type === 'drag' ? <Line key={`${b.id}:${i}`} x1={screenPoint(step.point).x} y1={screenPoint(step.point).y} x2={screenPoint(step.end).x} y2={screenPoint(step.end).y} stroke={mappingColors.accent} strokeWidth={2} /> : null))}</Svg>
        {profile.bindings.map(b => { const p = screenPoint(b.point); const radius = Math.max(40, s(30)) / 2; return <View key={b.id} pointerEvents={panning || pick ? 'none' : 'auto'} style={{ position: 'absolute', left: p.x - radius, top: p.y - radius, opacity: profile.settings.markerOpacity, zIndex: selected === b.id ? 3 : 2 }}><DragToken label={b.controls.map(controlLabel).join('+')} selected={selected === b.id} onTap={() => { setSelected(b.id); setProperties(true); }} onDrop={(x, y, settled) => pointFromScreen(x, y, point => { setSelected(b.id); place(b, point); }, settled)} /></View>; })}
      </> : null}
    </View>
    {loading || error || notice || pick ? <View style={{ position: 'absolute', left: s(12), top: s(8), right: panelOpen ? s(254) : s(12), gap: s(6), padding: s(8), borderRadius: s(7), backgroundColor: '#171620ed', zIndex: 20 }}>
      <MappingStatus loading={loading} error={error} />
      {notice ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}><T size={10} style={{ flex: 1 }} accessibilityLiveRegion="polite" color={mappingColors.accent}>{notice}</T><MappingButton label="Ẩn thông báo" onPress={() => setNotice(null)}><X size={s(12)} color={mappingColors.muted} /></MappingButton></View> : null}
      {pick ? <View style={mappingStyles.row}><T size={10} color={mappingColors.accent}>Chạm ảnh để đặt {pick.end ? 'điểm cuối' : 'vị trí bước'}.</T><MappingButton onPress={() => { setPick(null); setProperties(true); }}>Hủy</MappingButton></View> : null}
    </View>
    : null}
    {tools ? <View style={{ position: 'absolute', right: s(8), top: s(8), width: s(230), maxHeight: '95%', padding: s(9), gap: s(8), backgroundColor: mappingColors.panel, borderWidth: 1, borderColor: mappingColors.border, borderRadius: s(9), zIndex: 70 }}><ScrollView contentContainerStyle={{ gap: s(8) }}>
      <View style={mappingStyles.row}><MappingButton disabled={!history?.past.length} onPress={undo}>Hoàn tác</MappingButton><MappingButton disabled={!history?.future.length} onPress={redo}>Làm lại</MappingButton></View>
      <View style={mappingStyles.row}><MappingButton onPress={() => setZoom(z => Math.max(1, z - 0.25))}>−</MappingButton><T size={10} color={mappingColors.text}>{Math.round(zoom * 100)}%</T><MappingButton onPress={() => setZoom(z => Math.min(4, z + 0.25))}>+</MappingButton><MappingButton onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}>Vừa ảnh</MappingButton></View>
      <MappingButton active={panning} onPress={() => { setPanning(value => !value); setTools(false); }}><View style={mappingStyles.row}><Move size={s(13)} color={mappingColors.text} /><T size={10} color={mappingColors.text}>{panning ? 'Tắt di chuyển ảnh' : 'Di chuyển ảnh'}</T></View></MappingButton>
      <MappingButton onPress={() => setVisible(value => !value)}><View style={mappingStyles.row}>{visible ? <EyeOff size={s(13)} color={mappingColors.text} /> : <Eye size={s(13)} color={mappingColors.text} />}<T size={10} color={mappingColors.text}>{visible ? 'Ẩn marker' : 'Hiện marker'}</T></View></MappingButton>
      <MappingButton disabled={!profile} onPress={() => { if (profile) commit({ ...profile, settings: { markerOpacity: profile.settings.markerOpacity > 0.9 ? 0.4 : profile.settings.markerOpacity > 0.6 ? 1 : 0.7 } }); }}>Độ mờ marker</MappingButton>
      {binding ? <MappingButton onPress={() => { place(binding, { x: 0.5, y: 0.5 }); setTools(false); }}>Đặt nút đã chọn ở giữa</MappingButton> : null}
    </ScrollView></View> : null}
    {!pick ? <View pointerEvents="box-none" style={{ position: 'absolute', bottom: s(10), left: s(12), right: panelOpen ? Math.min(s(238), width - 32) + s(18) : s(12), alignItems: 'center', zIndex: 40 }}>
      <View style={{ width: '100%', maxWidth: s(520), padding: s(7), gap: s(7), borderRadius: s(10), backgroundColor: '#171620f5', borderWidth: 1, borderColor: mappingColors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: s(3) }}>{PALETTE_GROUPS.map((group, index) => <MappingButton key={group.label} active={paletteGroup === index} onPress={() => { setPaletteGroup(index); setPalettePage(0); }} style={{ flex: 1, borderColor: 'transparent', backgroundColor: paletteGroup === index ? mappingColors.selected : 'transparent', paddingHorizontal: s(9) }}>{group.label}</MappingButton>)}</ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(7) }}>
          {pageCount > 1 ? <MappingButton label="Trang nút trước" disabled={page === 0} onPress={() => setPalettePage(page - 1)}><ChevronLeft size={s(13)} color={mappingColors.muted} /></MappingButton> : null}
          {controls.slice(page * paletteSlots, page * paletteSlots + paletteSlots).map(control => <DragToken key={control} palette disabled={!uri || saving} label={controlLabel(control)} onTap={() => add(control, { x: 0.5, y: 0.5 })} onDrop={(x, y, settled) => pointFromScreen(x, y, point => add(control, point), settled)} />)}
          {pageCount > 1 ? <MappingButton label="Trang nút tiếp" disabled={page === pageCount - 1} onPress={() => setPalettePage(page + 1)}><ChevronRight size={s(13)} color={mappingColors.muted} /></MappingButton> : null}
        </View>
      </View>
    </View> : null}
    {properties && binding ? <ActionEditor key={binding.id} binding={binding} onClose={() => setProperties(false)} onChange={changeBinding} onDelete={() => { if (profile) commit({ ...profile, bindings: profile.bindings.filter(b => b.id !== binding.id) }); setProperties(false); setSelected(null); }} onPick={(index, end) => { setPick({ binding: binding.id, index, end }); setProperties(false); setPanning(false); }} /> : null}
    </View>
    {imageDialog && profile ? <ScreenshotPicker onClose={() => setImageDialog(false)} onConfirm={candidate => {
      ownedImages.current.forEach(releaseStorageScreenshot); ownedImages.current.clear();
      if (candidate.origin === 'storage') ownedImages.current.add(candidate.uri);
      setHistory({ past: [], current: { ...profile, screenshot: { width: candidate.width, height: candidate.height } }, future: [] }); setUpload(candidate); setUri(candidate.uri); setImageDialog(false); setError(null); setZoom(1); setPan({ x: 0, y: 0 });
    }} /> : null}
  </View>;
}
