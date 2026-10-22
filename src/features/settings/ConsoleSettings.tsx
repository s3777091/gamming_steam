// Compact settings with fixed density, flat theme surfaces and a handheld drawer.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Modal, Platform, Pressable, StyleSheet, View, type ScrollView } from 'react-native';
import { FocusScroll, FocusLayer } from '@/features/gamepad/focus';
import {
  Check,
  Gamepad2,
  Gauge,
  Keyboard,
  Menu,
  Monitor,
  MonitorPlay,
  Mouse,
  Palette,
  RefreshCw,
  Rocket,
  Sparkles,
  Volume2,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { type SettingsTokens } from '@/theme';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { AppearancePage } from './AppearancePage';
import { MappingLibrary } from '@/features/key-mapping/MappingLibrary';
import { mappingColors } from '@/features/key-mapping/MappingUi';
import { PillButton } from './controls';
import { AudioPage, ControllerPage, DevicesPage, KeyboardPage, MousePage } from './DevicePages';
import { GameBoosterPage } from './GameBoosterPage';
import { LatencyPage, NetworkPage, QualityPage, VideoPage } from './StreamPages';
import { useInputSettings } from './useInputSettings';
import { useStreamSettingsDraft } from './useStreamSettingsDraft';
import { SettingsRestoreButton, SettingsRestoreContext, type SettingsRestoreAction } from './SettingsRestore';
import { SETTINGS_LAYOUT, SettingsSurface, useSettingsColors } from './SettingsSurface';

export type SettingsCategory =
  | 'quality'
  | 'video'
  | 'latency'
  | 'network'
  | 'booster'
  | 'mapping'
  | 'devices'
  | 'controller'
  | 'mouse'
  | 'keyboard'
  | 'audio'
  | 'appearance';

type SettingsSection = 'streaming' | 'game' | 'devices' | 'app';

type Tone = 'error' | 'success' | 'info';
type Notice = { id: number; tone: Tone; title: string; detail?: string };

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'streaming', label: 'STREAMING' },
  { id: 'game', label: 'CHƠI GAME' },
  { id: 'devices', label: 'THIẾT BỊ' },
  { id: 'app', label: 'ỨNG DỤNG' },
];

const CATEGORIES: {
  id: SettingsCategory;
  label: string;
  detail: string;
  icon: LucideIcon;
  section: SettingsSection;
  color: keyof SettingsTokens;
}[] = [
  { id: 'mapping', label: 'Thiết lập nút', detail: 'Tạo và quản lý profile nút cho từng game', icon: Gamepad2, section: 'game', color: 'teal' },
  { id: 'quality', label: 'Chất lượng stream', detail: 'Chọn profile hợp với cách bạn chơi', icon: Sparkles, section: 'streaming', color: 'purple' },
  { id: 'video', label: 'Hình ảnh', detail: 'Độ phân giải, FPS, codec, bitrate và lớp phủ', icon: MonitorPlay, section: 'streaming', color: 'blue' },
  { id: 'latency', label: 'Độ trễ & độ mượt', detail: 'Bộ đệm, frame pacing và V-Sync', icon: Gauge, section: 'streaming', color: 'orange' },
  { id: 'network', label: 'Mạng', detail: 'Quản lý kết nối và chất lượng streaming', icon: Wifi, section: 'streaming', color: 'orange' },
  { id: 'booster', label: 'Game Booster', detail: 'Máy tính tự tối ưu khi bấm Play: Auto, Cao, Cân bằng, Tiết kiệm', icon: Rocket, section: 'game', color: 'red' },
  { id: 'devices', label: 'Thiết bị', detail: 'Thiết bị đang nối với máy này', icon: Monitor, section: 'devices', color: 'gray' },
  { id: 'controller', label: 'Tay cầm', detail: 'Bố cục nút, rung và vùng chết', icon: Gamepad2, section: 'devices', color: 'red' },
  { id: 'mouse', label: 'Chuột', detail: 'Tốc độ con trỏ và cuộn', icon: Mouse, section: 'devices', color: 'teal' },
  { id: 'keyboard', label: 'Bàn phím', detail: 'Phím tắt và đổi phím', icon: Keyboard, section: 'devices', color: 'indigo' },
  { id: 'audio', label: 'Âm thanh', detail: 'Đầu ra và âm lượng stream', icon: Volume2, section: 'devices', color: 'pink' },
  { id: 'appearance', label: 'Giao diện', detail: 'Theme màu cho toàn bộ ứng dụng', icon: Palette, section: 'app', color: 'accent' },
];

function SaveStatus({ saving, saved, failed }: { saving: boolean; saved: boolean; failed: boolean }) {
  const appleColors = useSettingsColors();
  const { s } = useUi();
  if (!saving && !saved && !failed) return null;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(5),
        paddingHorizontal: s(8),
        paddingVertical: s(4),
        borderRadius: s(8),
        backgroundColor: failed
          ? 'rgba(239, 68, 68, 0.14)'
          : saved
            ? 'rgba(52, 199, 89, 0.14)'
            : 'rgba(255, 255, 255, 0.06)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: failed
          ? 'rgba(248, 113, 113, 0.30)'
          : saved
            ? 'rgba(52, 199, 89, 0.30)'
            : 'rgba(255, 255, 255, 0.10)',
      }}
    >
      {saving ? (
        <ActivityIndicator size="small" color={appleColors.textTertiary} />
      ) : failed ? (
        <X size={s(13)} color={appleColors.red} strokeWidth={2.4} />
      ) : (
        <Check size={s(13)} color={appleColors.green} strokeWidth={2.6} />
      )}
      <T size={10.4} weight="medium" color={failed ? '#fca5a5' : saved ? '#86efac' : appleColors.textTertiary}>
        {saving ? 'Đang lưu…' : failed ? 'Chưa lưu được' : 'Đã lưu'}
      </T>
    </View>
  );
}

/** The active accent is separate from the white gamepad focus ring. */
function NavItem({
  entry,
  active,
  onPress,
  onLayout,
}: {
  entry: (typeof CATEGORIES)[number];
  active: boolean;
  onPress: () => void;
  onLayout: (y: number) => void;
}) {
  const appleColors = useSettingsColors();
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [hover] = useState(() => new Animated.Value(0));
  useEffect(() => () => hover.stopAnimation(), [hover]);
  const setHover = (toValue: number) => {
    Animated.timing(hover, {
      toValue, duration: reduceMotion ? 0 : 120, useNativeDriver: true, isInteraction: false,
    }).start();
  };
  const Icon = entry.icon;
  return (
    <Press
      onPress={onPress}
      autoFocus={active}
      pressScale={1}
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
      onHoverIn={() => setHover(1)}
      onHoverOut={() => setHover(0)}
      style={{
        height: SETTINGS_LAYOUT.navHeight,
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
        paddingHorizontal: s(10),
        borderRadius: s(8),
        marginVertical: s(1),
        backgroundColor: active ? appleColors.selectedBg : 'transparent',
      }}
    >
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, {
        borderRadius: s(8), backgroundColor: appleColors.pressedBg, opacity: hover,
      }]} />
      <View
        style={{
          width: s(24),
          height: s(24),
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={s(17)} color={appleColors[entry.color]} strokeWidth={1.8} />
      </View>
      <T
        size={13}
        weight={active ? 'semibold' : 'regular'}
        color={active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.70)'}
        numberOfLines={1}
        style={{ flex: 1, backgroundColor: 'transparent' }}
      >
        {entry.label}
      </T>
    </Press>
  );
}

function SettingsSidebar({ category, onSelect, onDismiss }: {
  category: SettingsCategory;
  onSelect: (category: SettingsCategory) => void;
  onDismiss?: () => void;
}) {
  const colors = useSettingsColors();
  const { insets } = useUi();
  const { reduceMotion } = useMotion();
  const [positions, setPositions] = useState<Partial<Record<SettingsCategory, number>>>({});
  const [indicator] = useState(() => new Animated.Value(0));
  const positioned = useRef(false);
  const target = positions[category];

  useEffect(() => {
    if (target === undefined) return;
    if (reduceMotion || !positioned.current) {
      indicator.setValue(target + 12);
      positioned.current = true;
      return;
    }
    const animation = Animated.timing(indicator, {
      toValue: target + 12, duration: 200, easing: Easing.out(Easing.cubic),
      useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [indicator, reduceMotion, target]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.sidebarBg }}>
      <View style={{ height: 56 + insets.top, paddingTop: insets.top, paddingHorizontal: 20,
        flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.cardBorder }}>
        <T size={17} weight="bold" style={{ flex: 1 }}>Cài đặt</T>
        {onDismiss ? <Press onPress={onDismiss} sound="back" accessibilityLabel="Đóng danh mục cài đặt"
          style={styles.iconButton}><X size={18} color={colors.textSecondary} /></Press> : null}
      </View>
      <FocusScroll showsVerticalScrollIndicator={false} style={{ flex: 1 }}
        contentContainerStyle={{ padding: 12, paddingBottom: 20 + insets.bottom }}>
        <View>
          <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0,
            width: 3, height: 22, borderRadius: 2, backgroundColor: colors.accent,
            zIndex: 1, opacity: target === undefined ? 0 : 1, transform: [{ translateY: indicator }] }} />
          {SECTIONS.flatMap((section, index) => [
            <T key={section.id} size={9.6} weight="semibold" color={colors.textSecondary} tracking={0.08}
              style={{ paddingHorizontal: 10, marginTop: index > 0 ? 16 : 0, marginBottom: 6 }}>
              {section.label}
            </T>,
            ...CATEGORIES.filter((entry) => entry.section === section.id).map((entry) => (
              <NavItem key={entry.id} entry={entry} active={entry.id === category}
                onPress={() => onSelect(entry.id)}
                onLayout={(y) => setPositions((current) => current[entry.id] === y
                  ? current : { ...current, [entry.id]: y })} />
            )),
          ])}
        </View>
      </FocusScroll>
    </View>
  );
}

function SettingsPage({ children, fill = false }: { children: ReactNode; fill?: boolean }) {
  const { reduceMotion } = useMotion();
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1, duration: reduceMotion ? 0 : 180, easing: Easing.out(Easing.cubic),
      useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);
  return <Animated.View style={{ flex: fill ? 1 : undefined, opacity: progress,
    transform: [{ translateY: reduceMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>
    {children}
  </Animated.View>;
}

function SettingsDrawer({ category, onSelect, onClose }: {
  category: SettingsCategory; onSelect: (category: SettingsCategory) => void; onClose: () => void;
}) {
  const { width, insets } = useUi();
  const colors = useSettingsColors();
  const { reduceMotion } = useMotion();
  const [progress] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  useBack(onClose);
  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1, duration: reduceMotion ? 0 : 180, easing: Easing.out(Easing.cubic),
      useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);
  return <Modal transparent animationType="none" visible onRequestClose={onClose}
    supportedOrientations={['portrait', 'landscape']} statusBarTranslucent navigationBarTranslucent>
    <FocusLayer>
      <View style={{ flex: 1 }}>
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { opacity: progress, backgroundColor: 'rgba(0,0,0,0.6)' }]} />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessible={false} focusable={false} />
        <Animated.View accessibilityViewIsModal style={{ flex: 1,
          width: Math.min(SETTINGS_LAYOUT.sidebarWidth + insets.left, width - 48),
          transform: [{ translateX: reduceMotion ? 0 : progress.interpolate({ inputRange: [0, 1], outputRange: [-SETTINGS_LAYOUT.sidebarWidth, 0] }) }] }}>
          <View style={{ flex: 1, paddingLeft: insets.left, backgroundColor: colors.sidebarBg }}>
            <SettingsSidebar category={category} onSelect={onSelect} onDismiss={onClose} />
          </View>
        </Animated.View>
      </View>
    </FocusLayer>
  </Modal>;
}

type SettingsProps = {
  initialCategory?: SettingsCategory;
  backdropUrl?: string | null;
  onClose: () => void;
};

export default function ConsoleSettings({ initialCategory = 'quality', ...props }: SettingsProps) {
  const [category, setCategory] = useState<SettingsCategory>(initialCategory);
  return <SettingsSurface network={category === 'network'}>
    <SettingsContent {...props} category={category} onCategoryChange={setCategory} />
  </SettingsSurface>;
}

function SettingsContent({ category, onCategoryChange, onClose }: Omit<SettingsProps, 'initialCategory'> & {
  category: SettingsCategory; onCategoryChange: (category: SettingsCategory) => void;
}) {
  const appleColors = useSettingsColors();
  const { s, width, insets, tablet } = useUi();
  const { reduceMotion } = useMotion();
  const inlineSidebar = width >= 900 && (tablet || Platform.OS === 'web');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [restore, setRestore] = useState<SettingsRestoreAction | null>(null);
  const restoreContext = useMemo(() => ({ category, setRestore }), [category]);
  const content = useRef<ScrollView | null>(null);
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));

  useBack(() => {
    if (drawerOpen) setDrawerOpen(false);
    else onClose();
  });

  useEffect(() => {
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? 0 : 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  const [previousInlineSidebar, setPreviousInlineSidebar] = useState(inlineSidebar);
  if (previousInlineSidebar !== inlineSidebar) {
    setPreviousInlineSidebar(inlineSidebar);
    if (inlineSidebar) setDrawerOpen(false);
  }

  const notify = useCallback((tone: Tone, title: string, detail?: string) => {
    setNotice({ id: Date.now(), tone, title, detail });
  }, []);

  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(null), 4500);
    return () => clearTimeout(timer);
  }, [notice]);

  const draft = useStreamSettingsDraft(notify);
  const input = useInputSettings();

  const select = (next: SettingsCategory) => {
    onCategoryChange(next);
    setDrawerOpen(false);
    content.current?.scrollTo?.({ y: 0, animated: false });
  };

  const meta = CATEGORIES.find((entry) => entry.id === category)!;
  const settings = draft.settings;

  let page: ReactNode;
  if (meta.section !== 'streaming') {
    page =
      category === 'mapping' ? (
        <MappingLibrary embedded />
      ) : category === 'booster' ? (
        <GameBoosterPage notify={notify} />
      ) : category === 'appearance' ? (
        <AppearancePage />
      ) : category === 'devices' ? (
        <DevicesPage notify={notify} />
      ) : category === 'controller' ? (
        <ControllerPage input={input} />
      ) : category === 'mouse' ? (
        <MousePage input={input} />
      ) : category === 'keyboard' ? (
        <KeyboardPage input={input} notify={notify} />
      ) : (
        <AudioPage input={input} />
      );
  } else if (draft.loading && !settings) {
    page = (
      <View style={{ height: s(160), alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={appleColors.blue} size="large" />
      </View>
    );
  } else if (!settings) {
    page = (
      <View style={{ height: s(192), alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(24) }}>
        <T size={14} weight="semibold" color={appleColors.text}>
          Không tải được cài đặt
        </T>
        <T size={11} color={appleColors.textTertiary} leading={1.4} style={{ marginTop: s(4), textAlign: 'center' }}>
          {draft.loadError}
        </T>
        <View style={{ marginTop: s(12) }}>
          <PillButton tone="accent" onPress={() => void draft.reload()}>
            <RefreshCw size={s(14)} color="#FFFFFF" />
            <T size={11} weight="semibold" color="#FFFFFF">
              Thử lại
            </T>
          </PillButton>
        </View>
      </View>
    );
  } else {
    const props = { draft, settings };
    page =
      category === 'quality' ? (
        <QualityPage {...props} />
      ) : category === 'video' ? (
        <VideoPage {...props} />
      ) : category === 'latency' ? (
        <LatencyPage {...props} />
      ) : (
        <NetworkPage {...props} notify={notify} />
      );
  }

  const saving = draft.saveState === 'saving' || input.syncState === 'saving';
  const failed = draft.saveState === 'error';
  const saved = !saving && !failed && (draft.saveState === 'saved' || input.dirty);
  const mappingPage = category === 'mapping';
  return (
    <FocusLayer>
      <Animated.View style={[StyleSheet.absoluteFill, {
        backgroundColor: appleColors.bg, opacity: enter, zIndex: 60, elevation: 60,
        transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [reduceMotion ? 0 : 32, 0] }) }],
      }]}>
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {inlineSidebar ? (
            <View style={{ width: (mappingPage ? 200 : SETTINGS_LAYOUT.sidebarWidth) + insets.left,
              paddingLeft: insets.left, backgroundColor: appleColors.sidebarBg,
              borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: appleColors.cardBorder }}>
              <SettingsSidebar category={category} onSelect={select} />
            </View>
          ) : null}
          <View style={{ flex: 1, minWidth: 0, paddingLeft: inlineSidebar ? 0 : insets.left,
            paddingRight: insets.right, overflow: 'hidden', backgroundColor: mappingPage ? mappingColors.bg : undefined }}>
            <View style={{ minHeight: 64 + insets.top, paddingTop: insets.top,
              flexDirection: 'row', alignItems: 'center', paddingHorizontal: inlineSidebar ? 24 : 12,
              gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: appleColors.cardBorder }}>
              {!inlineSidebar ? (
                <Press onPress={() => setDrawerOpen(true)} accessibilityLabel="Mở danh mục cài đặt"
                  accessibilityState={{ expanded: drawerOpen }} style={styles.iconButton}>
                  <Menu size={19} color={appleColors.textSecondary} />
                </Press>
              ) : null}
              <View style={{ flex: 1, minWidth: 0, paddingVertical: 8 }}>
                <T size={16} weight="bold" accessibilityRole="header" numberOfLines={1}>{meta.label}</T>
                <T size={11} color={appleColors.textSecondary} numberOfLines={1} style={{ marginTop: 3 }}>
                  {meta.detail}
                </T>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {!mappingPage ? <SaveStatus saving={saving} saved={saved} failed={failed} /> : null}
                {restore?.category === category ? (
                  <SettingsRestoreButton key={category} action={restore} notify={notify} />
                ) : null}
                <Press onPress={onClose} sound="back" pressScale={0.96}
                  accessibilityLabel="Đóng cài đặt" style={styles.iconButton}>
                  <X size={18} color={appleColors.textSecondary} />
                </Press>
              </View>
            </View>
            <SettingsRestoreContext.Provider value={restoreContext}>
              {mappingPage ? (
                <SettingsPage key={category} fill>{page}</SettingsPage>
              ) : (
                <FocusScroll ref={content} style={{ flex: 1 }}
                  contentContainerStyle={{ paddingHorizontal: inlineSidebar ? 24 : 16,
                    paddingTop: 0, paddingBottom: 24 + insets.bottom }}
                  showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                  <View style={{ width: '100%', maxWidth: 880, alignSelf: 'center' }}>
                    <SettingsPage key={category}>{page}</SettingsPage>
                  </View>
                </FocusScroll>
              )}
            </SettingsRestoreContext.Provider>
          </View>
        </View>

        {notice ? (
          <View accessibilityLiveRegion="polite" style={[styles.notice, {
            left: inlineSidebar ? undefined : 16 + insets.left,
            right: 16 + insets.right, bottom: 16 + insets.bottom,
            maxWidth: 360, padding: 12, borderRadius: SETTINGS_LAYOUT.radius, gap: 8,
            borderColor: notice.tone === 'error' ? 'rgba(248,113,113,0.4)' : appleColors.cardBorder,
            backgroundColor: appleColors.sidebarBg,
          }]}>
            <View style={{ flex: 1 }}>
              <T size={12} weight="semibold" color={notice.tone === 'error' ? '#fca5a5' : appleColors.text}>
                {notice.title}
              </T>
              {notice.detail ? (
                <T size={11} color={appleColors.textSecondary} leading={1.4} style={{ marginTop: 3 }}>
                  {notice.detail}
                </T>
              ) : null}
            </View>
            <Press onPress={() => setNotice(null)} accessibilityLabel="Đóng thông báo"
              style={styles.iconButton}><X size={16} color={appleColors.textSecondary} /></Press>
          </View>
        ) : null}
        {!inlineSidebar && drawerOpen ? (
          <SettingsDrawer category={category} onSelect={select} onClose={() => setDrawerOpen(false)} />
        ) : null}
      </Animated.View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  iconButton: {
    width: 44, height: 44, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
  },
  notice: {
    position: 'absolute', flexDirection: 'row', alignItems: 'center', borderWidth: 1, zIndex: 10,
  },
});
