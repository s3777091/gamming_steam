import * as Crypto from 'expo-crypto';
import { File } from 'expo-file-system';
import { router, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { usePreventRemove } from 'expo-router/react-navigation';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type GestureResponderEvent,
} from 'react-native';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  CircleDot,
  Cloud,
  Compass,
  Crosshair,
  Eye,
  EyeOff,
  FileText,
  Gamepad2,
  ImagePlus,
  Layers,
  Maximize2,
  Minus,
  MoreHorizontal,
  Move,
  Plus,
  Redo2,
  Save,
  SlidersHorizontal,
  Smartphone,
  Sparkles,
  Undo2,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import Svg, { Line } from 'react-native-svg';
import { useSignedInUser } from '@/features/auth';
import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { ActionEditor, makeStep } from './ActionEditor';
import { disableActiveMapping } from './active';
import {
  anchorBinding,
  canvasPoint,
  CONTROLS,
  controlLabel,
  MAX_IMAGE_BYTES,
  validateProfile,
  type Binding,
  type Control,
  type MappingProfile,
  type Point,
} from './model';
import {
  MappingButton,
  MappingDivider,
  MappingStatus,
  mappingColors,
  mappingStyles,
} from './MappingUi';
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
      onPanResponderGrant: e => {
        this.grab = { x: this.context.size / 2 - e.nativeEvent.locationX, y: this.context.size / 2 - e.nativeEvent.locationY };
      },
      onPanResponderMove: Animated.event([null, { dx: offset.x, dy: offset.y }], { useNativeDriver: false }),
      onPanResponderRelease: (e, g) => {
        const settled = () => offset.setValue({ x: 0, y: 0 });
        if (Math.hypot(g.dx, g.dy) < 5) {
          settled();
          playUiSound('select');
          this.context.onTap();
        } else {
          playUiSound('confirm');
          this.context.onDrop(e.nativeEvent.pageX + this.grab.x, e.nativeEvent.pageY + this.grab.y, settled);
        }
      },
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: () => offset.setValue({ x: 0, y: 0 }),
    });
  }
  update(context: TokenGesture['context']) {
    this.context = context;
  }
}

function DragToken({
  label,
  onDrop,
  onTap,
  selected = false,
  palette = false,
  disabled = false,
}: {
  label: string;
  onDrop: (x: number, y: number, settled: () => void) => void;
  onTap: () => void;
  selected?: boolean;
  palette?: boolean;
  disabled?: boolean;
}) {
  const { s } = useUi();
  const size = Math.max(40, s(32));
  const [offset] = useState(() => new Animated.ValueXY());
  const [gesture] = useState(() => new TokenGesture(offset));
  useLayoutEffect(() => {
    gesture.update({ onDrop, onTap, disabled, size });
  }, [disabled, gesture, onDrop, onTap, size]);

  let tint = mappingColors.accent;
  let bg = '#1d172e';
  let border = mappingColors.border;

  if (label === 'A') {
    tint = mappingColors.btnA;
    bg = palette ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.25)';
    border = palette ? 'rgba(16, 185, 129, 0.45)' : mappingColors.btnA;
  } else if (label === 'B') {
    tint = mappingColors.btnB;
    bg = palette ? 'rgba(244, 63, 94, 0.14)' : 'rgba(244, 63, 94, 0.25)';
    border = palette ? 'rgba(244, 63, 94, 0.45)' : mappingColors.btnB;
  } else if (label === 'X') {
    tint = mappingColors.btnX;
    bg = palette ? 'rgba(56, 189, 248, 0.14)' : 'rgba(56, 189, 248, 0.25)';
    border = palette ? 'rgba(56, 189, 248, 0.45)' : mappingColors.btnX;
  } else if (label === 'Y') {
    tint = mappingColors.btnY;
    bg = palette ? 'rgba(251, 191, 36, 0.14)' : 'rgba(251, 191, 36, 0.25)';
    border = palette ? 'rgba(251, 191, 36, 0.45)' : mappingColors.btnY;
  } else if (['UP', 'DOWN', 'LEFT', 'RIGHT'].includes(label)) {
    tint = '#c4b5fd';
    bg = palette ? 'rgba(167, 122, 255, 0.12)' : 'rgba(167, 122, 255, 0.22)';
    border = palette ? 'rgba(167, 122, 255, 0.4)' : '#a77aff';
  } else if (['L1', 'R1', 'L2', 'R2'].includes(label)) {
    tint = '#a5b4fc';
    bg = palette ? 'rgba(129, 140, 248, 0.14)' : 'rgba(129, 140, 248, 0.24)';
    border = palette ? 'rgba(129, 140, 248, 0.45)' : '#818cf8';
  } else if (label.startsWith('L') || label.startsWith('R')) {
    tint = '#f5f3fc';
    bg = palette ? mappingColors.raised : '#251b3d';
    border = palette ? mappingColors.border : mappingColors.accent;
  }

  let displayLabel = label;
  if (palette) {
    if (label === 'UP') displayLabel = '↑';
    else if (label === 'DOWN') displayLabel = '↓';
    else if (label === 'LEFT') displayLabel = '←';
    else if (label === 'RIGHT') displayLabel = '→';
  }

  return (
    <Animated.View
      {...gesture.responder.panHandlers}
      accessibilityLabel={label}
      accessibilityRole="button"
      accessibilityState={{ selected, disabled }}
      accessibilityActions={[{ name: 'activate', label: 'Chọn' }]}
      onAccessibilityAction={() => {
        if (!disabled) onTap();
      }}
      style={{
        transform: offset.getTranslateTransform(),
        width: size,
        height: size,
        paddingHorizontal: s(2),
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: palette ? s(9) : size / 2,
        borderWidth: palette ? 1.5 : 2,
        borderColor: selected ? '#ffffff' : border,
        backgroundColor: bg,
        opacity: disabled ? 0.38 : 1,
        zIndex: 40,
        shadowColor: selected ? '#c084fc' : '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: selected ? 0.6 : 0.3,
        shadowRadius: selected ? 6 : 3,
        elevation: selected ? 6 : 2,
      }}>
      <View pointerEvents="none" style={{ width: '100%', alignItems: 'center', justifyContent: 'center' }}>
        <T
          size={palette && displayLabel.length > 3 ? 8.5 : palette ? 10.5 : 11}
          color={tint}
          weight="bold"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.6}
          style={{ textAlign: 'center' }}>
          {displayLabel}
        </T>
      </View>

      {/* Modern Glowing Selection Ring for Canvas Tokens */}
      {selected && !palette ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: -5,
            bottom: -5,
            left: -5,
            right: -5,
            borderRadius: (size + 10) / 2,
            borderWidth: 2,
            borderColor: '#ffffff',
            backgroundColor: 'rgba(167, 122, 255, 0.24)',
          }}
        />
      ) : null}
    </Animated.View>
  );
}

const PALETTE_GROUPS: { label: string; icon: LucideIcon; controls: Control[] }[] = [
  { label: 'Nút cơ bản', icon: Gamepad2, controls: ['a', 'b', 'x', 'y', 'l3', 'r3'] },
  { label: 'D-Pad', icon: Compass, controls: ['up', 'down', 'left', 'right'] },
  { label: 'Triggers', icon: SlidersHorizontal, controls: ['l1', 'r1', 'l2', 'r2'] },
  { label: 'Cần xoay', icon: CircleDot, controls: CONTROLS.filter(control => control.startsWith('ls-') || control.startsWith('rs-')) },
];

class CanvasGesture {
  private context: { panning: boolean; pan: Point; onPan: (point: Point) => void; onPick: (e: GestureResponderEvent) => void; picking: boolean } | null = null;
  private start: Point = { x: 0, y: 0 };
  readonly responder = PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => {
      this.start = this.context?.pan ?? { x: 0, y: 0 };
    },
    onPanResponderMove: (_: GestureResponderEvent, g: { dx: number; dy: number }) => {
      if (this.context?.panning) this.context.onPan({ x: this.start.x + g.dx, y: this.start.y + g.dy });
    },
    onPanResponderRelease: (e: GestureResponderEvent, g: { dx: number; dy: number }) => {
      if (this.context && !this.context.panning && Math.hypot(g.dx, g.dy) < 5) this.context.onPick(e);
    },
  });
  update(context: NonNullable<CanvasGesture['context']>) {
    this.context = context;
  }
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
    if (saving) {
      setNotice('Đang lưu. Vui lòng chờ Supabase xác nhận.');
      return;
    }
    Alert.alert('Thay đổi chưa lưu', 'Rời editor và bỏ thay đổi?', [
      { text: 'Ở lại', style: 'cancel' },
      { text: 'Bỏ thay đổi', style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });

  useBack(() => {
    if (properties) setProperties(false);
    else router.back();
  });

  useEffect(() => {
    const owned = ownedImages.current;
    return () => {
      owned.forEach(releaseStorageScreenshot);
      owned.clear();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        if (params.profileId) {
          disableActiveMapping(params.profileId);
          const loaded = await mappingRepository().load(userId, params.profileId);
          if (!alive) return;
          setPrevious(loaded);
          setHistory({ past: [], current: loaded, future: [] });
          setSavedJson(JSON.stringify(loaded));
          try {
            const imageUri = await mappingRepository().screenshotUrl(loaded);
            if (alive) setUri(imageUri);
          } catch (e) {
            if (alive) {
              setError((e as Error).message);
              setImageDialog(true);
            }
          }
        } else {
          if (!params.gameId || !params.gameTitle) throw new Error('Chưa chọn game.');
          const now = new Date().toISOString();
          const draft: MappingProfile = {
            id: Crypto.randomUUID(),
            user_id: userId,
            game_id: params.gameId,
            game_title: params.gameTitle,
            name: 'Profile 1',
            description: '',
            screenshot_path: '',
            screenshot: { width: 1920, height: 1080 },
            bindings: [],
            settings: { markerOpacity: 0.85 },
            schema_version: 1,
            created_at: now,
            updated_at: now,
          };
          if (alive) {
            setHistory({ past: [], current: draft, future: [] });
            setSavedJson(JSON.stringify(draft));
            setImageDialog(true);
          }
        }
      } catch (e) {
        if (alive) setError((e as Error).message);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [params.gameId, params.gameTitle, params.profileId, userId]);

  const commit = (next: MappingProfile) =>
    setHistory(h => (h ? { past: [...h.past.slice(-39), h.current], current: next, future: [] } : h));

  const changeBinding = (next: Binding) => {
    if (profile) commit({ ...profile, bindings: profile.bindings.map(b => (b.id === next.id ? anchorBinding(next) : b)) });
  };

  const place = (b: Binding, point: Point) => {
    let moved = false;
    changeBinding({
      ...b,
      point,
      steps: b.steps.map(step => {
        if (!moved && 'point' in step) {
          moved = true;
          return { ...step, point };
        }
        return step;
      }),
    });
  };

  const pointFromScreen = (x: number, y: number, done: (p: Point) => void, settled = () => {}) => {
    if (!canvas.current) {
      settled();
      return;
    }
    canvas.current.measureInWindow((left, top, width, height) => {
      settled();
      if (!profile) return;
      if (x < left || y < top || x > left + width || y > top + height) {
        setNotice('Thả nút trong ảnh gameplay.');
        return;
      }
      const p = canvasPoint(x - left, y - top, { width, height }, profile.screenshot, zoom, pan);
      if (p) done(p);
      else setNotice('Vị trí nằm ngoài ảnh.');
    });
  };

  const add = (control: Control, point: Point) => {
    if (!profile || !uri || profile.bindings.length >= 64) return;
    const b: Binding = {
      id: Crypto.randomUUID(),
      name: controlLabel(control),
      controls: [control],
      point,
      steps: [makeStep('tap', point)],
      repeat: 1,
      physicalHold: false,
    };
    commit({ ...profile, bindings: [...profile.bindings, b] });
    setSelected(b.id);
    setProperties(true);
  };

  const save = async () => {
    if (!profile || savingLock.current) return;
    savingLock.current = true;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      validateProfile(profile);
      const file = upload ? new File(upload.uri) : null;
      if (file && file.size > MAX_IMAGE_BYTES) throw new Error('Ảnh vượt quá 10 MB.');
      const bytes = file ? await file.arrayBuffer() : null;
      if (!upload) await mappingRepository().screenshotUrl(profile);
      const saved = await mappingRepository().save(
        profile,
        previous,
        bytes && upload ? { bytes, mime: upload.mimeType! } : undefined,
        Crypto.randomUUID()
      );
      setPrevious(saved.profile);
      setHistory({ past: [], current: saved.profile, future: [] });
      setSavedJson(JSON.stringify(saved.profile));
      setUpload(null);
      setNotice(saved.warning ?? 'Đã lưu profile vào Supabase. Mở GuideMenu để kích hoạt.');
      playUiSound('confirm');
    } catch (e) {
      setError((e as Error).message);
      playUiSound('back');
    } finally {
      savingLock.current = false;
      setSaving(false);
    }
  };

  const [canvasGesture] = useState(() => new CanvasGesture());
  useLayoutEffect(() => {
    canvasGesture.update({
      panning,
      pan,
      picking: Boolean(pick),
      onPan: setPan,
      onPick: (event: GestureResponderEvent) => {
        if (!pick) {
          setSelected(null);
          setProperties(false);
          return;
        }
        if (!profile) return;
        const target = pick;
        const p = canvasPoint(event.nativeEvent.locationX, event.nativeEvent.locationY, box, profile.screenshot, zoom, pan);
        if (!p) return;
        const next = {
          ...profile,
          bindings: profile.bindings.map(b =>
            b.id !== target.binding
              ? b
              : anchorBinding({
                  ...b,
                  steps: b.steps.map((step, i) =>
                    i !== target.index || !('point' in step)
                      ? step
                      : target.end && step.type === 'drag'
                        ? { ...step, end: p }
                        : { ...step, point: p }
                  ),
                })
          ),
        };
        setHistory(h => (h ? { past: [...h.past.slice(-39), h.current], current: next, future: [] } : h));
        setPick(null);
        setProperties(true);
        playUiSound('confirm');
      },
    });
  }, [box, canvasGesture, pan, panning, pick, profile, zoom]);

  const scale = profile ? Math.min(box.width / profile.screenshot.width, box.height / profile.screenshot.height) * zoom : 1;
  const imageWidth = (profile?.screenshot.width ?? 1) * scale;
  const imageHeight = (profile?.screenshot.height ?? 1) * scale;
  const origin = { x: (box.width - imageWidth) / 2 + pan.x, y: (box.height - imageHeight) / 2 + pan.y };
  const screenPoint = (p: Point) => ({ x: origin.x + p.x * imageWidth, y: origin.y + p.y * imageHeight });

  const panelOpen = Boolean(properties && binding);
  const dockWidth = width - insets.left - insets.right - (panelOpen ? Math.min(s(238), width - 32) + s(20) : s(24));
  const paletteSlots = Math.max(2, Math.min(6, Math.floor((dockWidth - 100) / (Math.max(40, s(32)) + s(8)))));
  const controls = PALETTE_GROUPS[paletteGroup].controls;
  const pageCount = Math.ceil(controls.length / paletteSlots);
  const page = Math.min(palettePage, pageCount - 1);
  const undo = () =>
    setHistory(h =>
      h?.past.length
        ? { past: h.past.slice(0, -1), current: h.past[h.past.length - 1], future: [h.current, ...h.future] }
        : h
    );
  const redo = () =>
    setHistory(h => (h?.future.length ? { past: [...h.past, h.current], current: h.future[0], future: h.future.slice(1) } : h));

  return (
    <FocusLayer>
      <View
        pointerEvents={saving ? 'none' : 'auto'}
        style={{
          flex: 1,
          backgroundColor: mappingColors.bg,
          paddingTop: insets.top,
          paddingBottom: insets.bottom,
          paddingLeft: insets.left,
          paddingRight: insets.right,
        }}>
        <Stack.Screen options={{ gestureEnabled: false }} />

      {/* Top Header Bar */}
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(8),
        paddingHorizontal: s(10),
        paddingVertical: s(6),
        borderBottomWidth: 1,
        borderBottomColor: mappingColors.border,
        backgroundColor: mappingColors.panel,
      }}>
        <MappingButton disabled={saving} label="Quay lại danh sách game" onPress={() => router.back()} variant="ghost">
          <ArrowLeft size={s(16)} color={mappingColors.text} />
        </MappingButton>

        <View style={{ flex: 1, minWidth: 0, gap: s(2) }}>
          <T size={12} weight="bold" color={mappingColors.text} numberOfLines={1}>
            {profile?.game_title ?? 'Thiết lập nút'}
          </T>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
            <View style={{
              width: s(6),
              height: s(6),
              borderRadius: s(3),
              backgroundColor: saving
                ? mappingColors.accent
                : dirty
                  ? '#f59e0b'
                  : previous
                    ? mappingColors.success
                    : '#a78bfa',
            }} />
            <T size={8.5} color={dirty ? '#fbbf24' : previous ? mappingColors.success : mappingColors.muted}>
              {saving ? 'Đang lưu...' : dirty ? 'Chưa lưu thay đổi' : previous ? 'Đã đồng bộ' : 'Bản nháp'}
            </T>
          </View>
        </View>

        {profile ? (
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: mappingColors.raised,
            borderWidth: 1,
            borderColor: mappingColors.border,
            borderRadius: s(7),
            paddingHorizontal: s(8),
            width: s(width < 700 ? 110 : 150),
            minHeight: Math.max(38, s(28)),
            gap: s(5),
          }}>
            <FileText size={s(11)} color={mappingColors.muted} />
            <TextInput
              accessibilityLabel="Tên profile"
              value={profile.name}
              onChangeText={name => commit({ ...profile, name })}
              placeholder="Tên profile"
              placeholderTextColor={mappingColors.muted}
              selectTextOnFocus
              maxLength={80}
              style={{
                flex: 1,
                color: mappingColors.text,
                fontSize: s(10.5),
                padding: 0,
              }}
            />
          </View>
        ) : null}

        {/* Change Image Button */}
        <MappingButton
          disabled={saving}
          label="Chọn ảnh gameplay"
          onPress={() => setImageDialog(true)}
          style={{ paddingHorizontal: s(8) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
            <ImagePlus size={s(14)} color={mappingColors.accent} />
            {width >= 720 ? <T size={10} color={mappingColors.text}>Ảnh nền</T> : null}
          </View>
        </MappingButton>

        {/* Save Button */}
        <MappingButton
          disabled={saving || !profile || !uri}
          variant="primary"
          onPress={() => void save()}
          style={{
            minWidth: s(width < 700 ? 56 : 74),
            paddingHorizontal: s(10),
            backgroundColor: mappingColors.primary,
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
            {saving ? <ActivityIndicator size="small" color="#ffffff" /> : <Save size={s(13)} color="#ffffff" />}
            <T size={10.5} weight="bold" color="#ffffff">{saving ? 'Lưu...' : 'Lưu'}</T>
          </View>
        </MappingButton>
      </View>

      {/* Canvas Viewport */}
      <View style={{ flex: 1 }}>
        <View
          ref={canvas}
          collapsable={false}
          onLayout={e => setBox(e.nativeEvent.layout)}
          {...canvasGesture.responder.panHandlers}
          style={{ flex: 1, minHeight: 80, backgroundColor: '#090812', overflow: 'hidden' }}>
          {uri ? (
            <Img
              source={{ uri }}
              contentFit="fill"
              style={{ position: 'absolute', left: origin.x, top: origin.y, width: imageWidth, height: imageHeight }}
              onError={() => setError('Không hiển thị được ảnh. Hãy tải lại hoặc thay ảnh.')}
            />
          ) : (
            /* Modern 21st.dev Dropzone Hero Card */
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: s(16) }}>
              <View style={{
                width: '100%',
                maxWidth: s(440),
                alignItems: 'center',
                paddingVertical: s(24),
                paddingHorizontal: s(20),
                borderRadius: s(16),
                backgroundColor: 'rgba(22, 20, 36, 0.88)',
                borderWidth: 1,
                borderColor: 'rgba(167, 122, 255, 0.3)',
                gap: s(12),
              }}>
                <View style={{
                  width: s(56),
                  height: s(56),
                  borderRadius: s(28),
                  backgroundColor: 'rgba(121, 70, 232, 0.18)',
                  borderWidth: 1,
                  borderColor: 'rgba(167, 122, 255, 0.35)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <Gamepad2 size={s(28)} color={mappingColors.accent} />
                </View>

                <View style={{ alignItems: 'center', gap: s(4) }}>
                  <T size={13} weight="bold" color={mappingColors.text}>Chưa có ảnh chụp gameplay</T>
                  <T size={9.5} color={mappingColors.muted} style={{ textAlign: 'center', lineHeight: s(14) }}>
                    Thêm ảnh chụp màn hình game để kéo thả các phím bấm ảo chính xác theo giao diện điều khiển.
                  </T>
                </View>

                <MappingButton
                  variant="primary"
                  onPress={() => setImageDialog(true)}
                  style={{ minHeight: Math.max(40, s(32)), paddingHorizontal: s(16), borderRadius: s(9) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                    <ImagePlus size={s(15)} color="#ffffff" />
                    <T size={11} weight="bold" color="#ffffff">Thêm ảnh gameplay</T>
                  </View>
                </MappingButton>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginTop: s(4) }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(6) }}>
                    <Cloud size={s(10)} color={mappingColors.muted} />
                    <T size={8} color={mappingColors.muted}>Cloud & PC</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(6) }}>
                    <Smartphone size={s(10)} color={mappingColors.muted} />
                    <T size={8} color={mappingColors.muted}>Thư viện thiết bị</T>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4), backgroundColor: 'rgba(255,255,255,0.04)', paddingHorizontal: s(8), paddingVertical: s(3), borderRadius: s(6) }}>
                    <Sparkles size={s(10)} color={mappingColors.accent} />
                    <T size={8} color={mappingColors.accent}>Tỉ lệ 16:9</T>
                  </View>
                </View>
              </View>
            </View>
          )}

          {visible && profile ? (
            <>
              <Svg pointerEvents="none" style={StyleSheet.absoluteFill}>
                {profile.bindings.flatMap(b =>
                  b.steps.map((step, i) =>
                    step.type === 'drag' ? (
                      <Line
                        key={`${b.id}:${i}`}
                        x1={screenPoint(step.point).x}
                        y1={screenPoint(step.point).y}
                        x2={screenPoint(step.end).x}
                        y2={screenPoint(step.end).y}
                        stroke={mappingColors.accent}
                        strokeWidth={2}
                      />
                    ) : null
                  )
                )}
              </Svg>
              {profile.bindings.map(b => {
                const p = screenPoint(b.point);
                const radius = Math.max(40, s(32)) / 2;
                return (
                  <View
                    key={b.id}
                    pointerEvents={panning || pick ? 'none' : 'auto'}
                    style={{
                      position: 'absolute',
                      left: p.x - radius,
                      top: p.y - radius,
                      opacity: profile.settings.markerOpacity,
                      zIndex: selected === b.id ? 3 : 2,
                    }}>
                    <DragToken
                      label={b.controls.map(controlLabel).join('+')}
                      selected={selected === b.id}
                      onTap={() => {
                        setSelected(b.id);
                        setProperties(true);
                      }}
                      onDrop={(x, y, settled) =>
                        pointFromScreen(
                          x,
                          y,
                          point => {
                            setSelected(b.id);
                            place(b, point);
                          },
                          settled
                        )
                      }
                    />
                  </View>
                );
              })}
            </>
          ) : null}
        </View>

        {/* Floating Canvas Island Toolbar */}
        <View style={{
          position: 'absolute',
          right: s(8),
          top: s(8),
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: 'rgba(23, 21, 36, 0.92)',
          padding: s(4),
          borderRadius: s(10),
          borderWidth: 1,
          borderColor: mappingColors.borderAccent,
          gap: s(3),
          zIndex: 60,
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.4,
          shadowRadius: 6,
          elevation: 6,
        }}>
          {/* Undo / Redo */}
          <MappingButton
            label="Hoàn tác"
            disabled={!history?.past.length || saving}
            onPress={undo}
            variant="ghost"
            style={{ minWidth: s(28), paddingHorizontal: s(4) }}>
            <Undo2 size={s(13)} color={history?.past.length ? mappingColors.text : mappingColors.border} />
          </MappingButton>
          <MappingButton
            label="Làm lại"
            disabled={!history?.future.length || saving}
            onPress={redo}
            variant="ghost"
            style={{ minWidth: s(28), paddingHorizontal: s(4) }}>
            <Redo2 size={s(13)} color={history?.future.length ? mappingColors.text : mappingColors.border} />
          </MappingButton>

          <MappingDivider vertical />

          {/* Zoom controls */}
          <MappingButton
            label="Thu nhỏ"
            onPress={() => setZoom(z => Math.max(1, z - 0.25))}
            variant="ghost"
            style={{ minWidth: s(26), paddingHorizontal: s(2) }}>
            <Minus size={s(12)} color={mappingColors.text} />
          </MappingButton>

          <Press
            onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            style={{ paddingHorizontal: s(6), paddingVertical: s(3), borderRadius: s(5), backgroundColor: 'rgba(255, 255, 255, 0.06)' }}>
            <T size={9} weight="bold" color={mappingColors.accent}>{Math.round(zoom * 100)}%</T>
          </Press>

          <MappingButton
            label="Phóng to"
            onPress={() => setZoom(z => Math.min(4, z + 0.25))}
            variant="ghost"
            style={{ minWidth: s(26), paddingHorizontal: s(2) }}>
            <Plus size={s(12)} color={mappingColors.text} />
          </MappingButton>

          <MappingButton
            label="Vừa ảnh"
            onPress={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
            variant="ghost"
            style={{ minWidth: s(28), paddingHorizontal: s(3) }}>
            <Maximize2 size={s(13)} color={mappingColors.text} />
          </MappingButton>

          <MappingDivider vertical />

          {/* Pan Mode */}
          <MappingButton
            label={panning ? 'Tắt di chuyển' : 'Di chuyển ảnh'}
            active={panning}
            onPress={() => setPanning(v => !v)}
            style={{
              minWidth: s(28),
              paddingHorizontal: s(5),
              backgroundColor: panning ? mappingColors.primary : 'transparent',
              borderColor: panning ? 'rgba(255,255,255,0.2)' : 'transparent',
            }}>
            <Move size={s(13)} color={panning ? '#ffffff' : mappingColors.text} />
          </MappingButton>

          {/* Visibility */}
          <MappingButton
            label={visible ? 'Ẩn marker' : 'Hiện marker'}
            onPress={() => setVisible(v => !v)}
            variant="ghost"
            style={{ minWidth: s(28), paddingHorizontal: s(5) }}>
            {visible ? <Eye size={s(13)} color={mappingColors.text} /> : <EyeOff size={s(13)} color={mappingColors.danger} />}
          </MappingButton>

          {/* Center Selected */}
          {binding ? (
            <MappingButton
              label="Căn giữa"
              onPress={() => place(binding, { x: 0.5, y: 0.5 })}
              variant="ghost"
              style={{ minWidth: s(28), paddingHorizontal: s(5) }}>
              <Crosshair size={s(13)} color={mappingColors.accent} />
            </MappingButton>
          ) : null}

          {/* More options popover toggle */}
          <MappingButton
            label="Tùy chọn Canvas"
            active={tools}
            onPress={() => setTools(v => !v)}
            style={{
              minWidth: s(28),
              paddingHorizontal: s(5),
              backgroundColor: tools ? mappingColors.selected : 'transparent',
              borderColor: tools ? mappingColors.accent : 'transparent',
            }}>
            <MoreHorizontal size={s(15)} color={mappingColors.text} />
          </MappingButton>
        </View>

        {/* Notices and Alerts */}
        {loading || error || notice || pick ? (
          <View style={{
            position: 'absolute',
            left: s(12),
            top: s(8),
            right: panelOpen ? s(254) : s(12),
            gap: s(6),
            padding: s(8),
            borderRadius: s(8),
            backgroundColor: '#171620f0',
            borderWidth: 1,
            borderColor: mappingColors.border,
            zIndex: 20,
          }}>
            <MappingStatus loading={loading} error={error} />
            {notice ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                <T size={10} style={{ flex: 1 }} accessibilityLiveRegion="polite" color={mappingColors.accent}>
                  {notice}
                </T>
                <MappingButton label="Ẩn thông báo" onPress={() => setNotice(null)} variant="ghost" style={{ paddingHorizontal: s(4) }}>
                  <X size={s(12)} color={mappingColors.muted} />
                </MappingButton>
              </View>
            ) : null}
            {pick ? (
              <View style={mappingStyles.row}>
                <T size={10} color={mappingColors.accent}>Chạm ảnh để đặt {pick.end ? 'điểm cuối' : 'vị trí bước'}.</T>
                <MappingButton onPress={() => { setPick(null); setProperties(true); }}>Hủy</MappingButton>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* Expanded Tools Popover Card */}
        {tools ? (
          <View style={{
            position: 'absolute',
            right: s(8),
            top: s(48),
            width: s(236),
            padding: s(10),
            gap: s(8),
            backgroundColor: mappingColors.card,
            borderWidth: 1,
            borderColor: mappingColors.borderAccent,
            borderRadius: s(12),
            zIndex: 70,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.5,
            shadowRadius: 10,
            elevation: 8,
          }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                <SlidersHorizontal size={s(13)} color={mappingColors.accent} />
                <T size={10.5} weight="bold" color={mappingColors.text}>Tùy chọn Canvas</T>
              </View>
              <MappingButton variant="ghost" label="Đóng tùy chọn" onPress={() => setTools(false)} style={{ paddingHorizontal: s(4) }}>
                <X size={s(13)} color={mappingColors.muted} />
              </MappingButton>
            </View>

            <MappingDivider />

            {/* Opacity Selector */}
            <View style={{ gap: s(5) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
                  <Layers size={s(12)} color={mappingColors.muted} />
                  <T size={9.5} color={mappingColors.muted}>Độ mờ marker</T>
                </View>
                <T size={9.5} weight="bold" color={mappingColors.accent}>
                  {Math.round((profile?.settings.markerOpacity ?? 0.85) * 100)}%
                </T>
              </View>

              <View style={{ flexDirection: 'row', gap: s(4) }}>
                {[0.4, 0.7, 1.0].map(val => {
                  const active = Math.abs((profile?.settings.markerOpacity ?? 0.85) - val) < 0.16;
                  return (
                    <Press
                      key={val}
                      onPress={() => {
                        if (profile) commit({ ...profile, settings: { markerOpacity: val } });
                      }}
                      style={{
                        flex: 1,
                        alignItems: 'center',
                        paddingVertical: s(5),
                        borderRadius: s(6),
                        backgroundColor: active ? mappingColors.primary : mappingColors.panel,
                        borderWidth: 1,
                        borderColor: active ? 'rgba(255,255,255,0.2)' : mappingColors.border,
                      }}>
                      <T size={9} weight={active ? 'bold' : 'regular'} color={active ? '#ffffff' : mappingColors.muted}>
                        {Math.round(val * 100)}%
                      </T>
                    </Press>
                  );
                })}
              </View>
            </View>

            <MappingDivider />

            {/* Quick shortcuts */}
            <View style={{ gap: s(5) }}>
              {binding ? (
                <MappingButton
                  onPress={() => {
                    place(binding, { x: 0.5, y: 0.5 });
                    setTools(false);
                  }}
                  style={{ width: '100%', justifyContent: 'flex-start' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                    <Crosshair size={s(13)} color={mappingColors.accent} />
                    <T size={10} color={mappingColors.text}>Đặt nút chọn ở tâm ảnh</T>
                  </View>
                </MappingButton>
              ) : null}

              <MappingButton
                onPress={() => {
                  setTools(false);
                  setImageDialog(true);
                }}
                style={{ width: '100%', justifyContent: 'flex-start' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                  <ImagePlus size={s(13)} color={mappingColors.accent} />
                  <T size={10} color={mappingColors.text}>Đổi ảnh gameplay...</T>
                </View>
              </MappingButton>
            </View>
          </View>
        ) : null}

        {/* Bottom Gamepad Controller Floating Dock */}
        {!pick ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              bottom: s(10),
              left: s(12),
              right: panelOpen ? Math.min(s(238), width - 32) + s(18) : s(12),
              alignItems: 'center',
              zIndex: 40,
            }}>
            <View style={{
              width: '100%',
              maxWidth: s(520),
              padding: s(8),
              gap: s(7),
              borderRadius: s(14),
              backgroundColor: 'rgba(23, 21, 36, 0.95)',
              borderWidth: 1,
              borderColor: mappingColors.borderAccent,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.5,
              shadowRadius: 8,
              elevation: 8,
            }}>
              {/* Category Segmented Control with Icons */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexGrow: 0 }} contentContainerStyle={{ gap: s(4) }}>
                {PALETTE_GROUPS.map((group, index) => {
                  const active = paletteGroup === index;
                  const Icon = group.icon;
                  return (
                    <Press
                      key={group.label}
                      onPress={() => {
                        setPaletteGroup(index);
                        setPalettePage(0);
                      }}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: s(5),
                        paddingHorizontal: s(10),
                        paddingVertical: s(5),
                        borderRadius: s(7),
                        backgroundColor: active ? mappingColors.primary : 'transparent',
                        borderWidth: 1,
                        borderColor: active ? 'rgba(255,255,255,0.2)' : 'transparent',
                      }}>
                      <Icon size={s(12)} color={active ? '#ffffff' : mappingColors.muted} />
                      <T size={9.5} weight={active ? 'bold' : 'regular'} color={active ? '#ffffff' : mappingColors.muted}>
                        {group.label}
                      </T>
                    </Press>
                  );
                })}
              </ScrollView>

              {/* Gamepad Tokens Row */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8) }}>
                {pageCount > 1 ? (
                  <MappingButton
                    label="Trang nút trước"
                    disabled={page === 0}
                    onPress={() => setPalettePage(page - 1)}
                    variant="ghost"
                    style={{ minWidth: s(28), paddingHorizontal: s(4) }}>
                    <ChevronLeft size={s(14)} color={page === 0 ? mappingColors.border : mappingColors.muted} />
                  </MappingButton>
                ) : null}

                {controls.slice(page * paletteSlots, page * paletteSlots + paletteSlots).map(control => (
                  <DragToken
                    key={control}
                    palette
                    disabled={!uri || saving}
                    label={controlLabel(control)}
                    onTap={() => add(control, { x: 0.5, y: 0.5 })}
                    onDrop={(x, y, settled) => pointFromScreen(x, y, point => add(control, point), settled)}
                  />
                ))}

                {pageCount > 1 ? (
                  <MappingButton
                    label="Trang nút tiếp"
                    disabled={page === pageCount - 1}
                    onPress={() => setPalettePage(page + 1)}
                    variant="ghost"
                    style={{ minWidth: s(28), paddingHorizontal: s(4) }}>
                    <ChevronRight size={s(14)} color={page === pageCount - 1 ? mappingColors.border : mappingColors.muted} />
                  </MappingButton>
                ) : null}
              </View>

              <View style={{ alignItems: 'center' }}>
                <T size={8} color={mappingColors.muted}>Kéo thả nút vào vị trí ảnh gameplay hoặc chạm để đặt ở giữa</T>
              </View>
            </View>
          </View>
        ) : null}

        {/* Action Editor Properties Drawer */}
        {properties && binding ? (
          <ActionEditor
            key={binding.id}
            binding={binding}
            onClose={() => setProperties(false)}
            onChange={changeBinding}
            onDelete={() => {
              if (profile) commit({ ...profile, bindings: profile.bindings.filter(b => b.id !== binding.id) });
              setProperties(false);
              setSelected(null);
            }}
            onPick={(index, end) => {
              setPick({ binding: binding.id, index, end });
              setProperties(false);
              setPanning(false);
            }}
          />
        ) : null}
      </View>

      {/* Screenshot Picker Modal */}
      {imageDialog && profile ? (
        <ScreenshotPicker
          onClose={() => setImageDialog(false)}
          onConfirm={candidate => {
            ownedImages.current.forEach(releaseStorageScreenshot);
            ownedImages.current.clear();
            if (candidate.origin === 'storage') ownedImages.current.add(candidate.uri);
            setHistory({
              past: [],
              current: { ...profile, screenshot: { width: candidate.width, height: candidate.height } },
              future: [],
            });
            setUpload(candidate);
            setUri(candidate.uri);
            setImageDialog(false);
            setError(null);
            setZoom(1);
            setPan({ x: 0, y: 0 });
          }}
        />
      ) : null}
    </View>
    </FocusLayer>
  );
}
