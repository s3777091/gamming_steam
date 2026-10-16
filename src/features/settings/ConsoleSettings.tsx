// Màn hình Cài đặt theo ngôn ngữ thiết kế Apple Liquid Glass (iOS 26 / Console Glass):
// Bố cục chia hai cột Master - Detail: Kính mờ quang học (GlassBackdrop / BlurView),
// nền cực quang chất lỏng (Liquid Ambient Aurora), viền phản quang specular rim,
// icon squircle kính đa sắc và nút đóng viên thuốc kính nổi bật.

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { FocusScroll, FocusLayer } from '@/features/gamepad/focus';
import {
  Check,
  Gamepad2,
  Gauge,
  Keyboard,
  Monitor,
  MonitorPlay,
  Mouse,
  Palette,
  RefreshCw,
  Sparkles,
  Volume2,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { alpha, type SettingsTokens, ThemeDecor, useTheme } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { AppearancePage } from './AppearancePage';
import { PillButton } from './controls';
import { AudioPage, ControllerPage, DevicesPage, KeyboardPage, MousePage } from './DevicePages';
import { LatencyPage, NetworkPage, QualityPage, VideoPage } from './StreamPages';
import { useInputSettings } from './useInputSettings';
import { useStreamSettingsDraft } from './useStreamSettingsDraft';
import { SettingsRestoreButton, SettingsRestoreContext, type SettingsRestoreAction } from './SettingsRestore';

export type SettingsCategory =
  | 'quality'
  | 'video'
  | 'latency'
  | 'network'
  | 'devices'
  | 'controller'
  | 'mouse'
  | 'keyboard'
  | 'audio'
  | 'appearance';

type SettingsSection = 'streaming' | 'devices' | 'app';

type Tone = 'error' | 'success' | 'info';
type Notice = { id: number; tone: Tone; title: string; detail?: string };

const SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: 'streaming', label: 'STREAMING' },
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
  { id: 'quality', label: 'Chất lượng stream', detail: 'Chọn profile hợp với cách bạn chơi', icon: Sparkles, section: 'streaming', color: 'purple' },
  { id: 'video', label: 'Hình ảnh', detail: 'Độ phân giải, FPS, codec, bitrate và lớp phủ', icon: MonitorPlay, section: 'streaming', color: 'blue' },
  { id: 'latency', label: 'Độ trễ & độ mượt', detail: 'Bộ đệm, frame pacing và V-Sync', icon: Gauge, section: 'streaming', color: 'orange' },
  { id: 'network', label: 'Mạng', detail: 'Khu vực và kiểm tra đường truyền', icon: Wifi, section: 'streaming', color: 'blue' },
  { id: 'devices', label: 'Thiết bị', detail: 'Thiết bị đang nối với máy này', icon: Monitor, section: 'devices', color: 'gray' },
  { id: 'controller', label: 'Tay cầm', detail: 'Bố cục nút, rung và vùng chết', icon: Gamepad2, section: 'devices', color: 'red' },
  { id: 'mouse', label: 'Chuột', detail: 'Tốc độ con trỏ và cuộn', icon: Mouse, section: 'devices', color: 'teal' },
  { id: 'keyboard', label: 'Bàn phím', detail: 'Phím tắt và đổi phím', icon: Keyboard, section: 'devices', color: 'indigo' },
  { id: 'audio', label: 'Âm thanh', detail: 'Đầu ra và âm lượng stream', icon: Volume2, section: 'devices', color: 'pink' },
  { id: 'appearance', label: 'Giao diện', detail: 'Theme màu cho toàn bộ ứng dụng', icon: Palette, section: 'app', color: 'accent' },
];

function SaveStatus({ saving, saved, failed }: { saving: boolean; saved: boolean; failed: boolean }) {
  const { settings: appleColors } = useTheme();
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

/**
 * Mục sidebar. Hai trạng thái phải nhìn khác nhau ngay lập tức:
 * - Đã chọn: kính hổ phách ấm (nền + viền ấm, chữ đậm).
 * - Tay cầm đang trỏ vào: viền trắng sắc của FocusRing, không tô màu.
 */
function NavItem({
  entry,
  active,
  onPress,
}: {
  entry: (typeof CATEGORIES)[number];
  active: boolean;
  onPress: () => void;
}) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const Icon = entry.icon;
  return (
    <Press
      onPress={onPress}
      autoFocus={active}
      pressScale={0.985}
      accessibilityState={{ selected: active }}
      style={{
        height: s(42),
        flexDirection: 'row',
        alignItems: 'center',
        gap: s(10),
        paddingHorizontal: s(10),
        borderRadius: s(12),
        marginVertical: s(2),
        backgroundColor: active ? appleColors.selectedBg : 'transparent',
        borderWidth: 1,
        borderColor: active ? appleColors.selectedBorder : 'transparent',
      }}
    >
      {active ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(12), overflow: 'hidden' }]}>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.16)', 'rgba(255, 255, 255, 0.02)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['rgba(255, 255, 255, 0.45)', 'rgba(255, 255, 255, 0.06)', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1 }}
          />
        </View>
      ) : null}
      <View
        style={{
          width: s(28),
          height: s(28),
          borderRadius: s(8),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: appleColors[entry.color],
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255, 255, 255, 0.40)',
          overflow: 'hidden',
        }}
      >
        <LinearGradient
          colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0.7 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <Icon size={s(15)} color="#FFFFFF" strokeWidth={2.2} />
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

export default function ConsoleSettings({
  initialCategory = 'quality',
  backdropUrl,
  onClose,
}: {
  initialCategory?: SettingsCategory;
  backdropUrl?: string | null;
  onClose: () => void;
}) {
  const { settings: appleColors, colors, glass } = useTheme();
  const { s, width, insets } = useUi();
  const [category, setCategory] = useState<SettingsCategory>(initialCategory);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [restore, setRestore] = useState<SettingsRestoreAction | null>(null);
  const restoreContext = useMemo(() => ({ category, setRestore }), [category]);
  const content = useRef<any>(null);
  const [enter] = useState(() => new Animated.Value(0));

  useBack(() => {
    onClose();
  });

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

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
    setCategory(next);
    content.current?.scrollTo?.({ y: 0, animated: false });
  };

  const meta = CATEGORIES.find((entry) => entry.id === category)!;
  const settings = draft.settings;

  let page: ReactNode;
  if (meta.section !== 'streaming') {
    page =
      category === 'appearance' ? (
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
  const navWidth = Math.min(s(280), Math.max(s(210), width * 0.28));

  return (
    <FocusLayer>
      <Animated.View
        style={[
          StyleSheet.absoluteFill,
          {
            backgroundColor: appleColors.bg,
            opacity: enter,
            zIndex: 60,
            elevation: 60,
          },
        ]}
      >
        {/* 1. Lớp hình nền trò chơi (nếu có) được làm mờ quang học */}
        {backdropUrl ? (
          <View style={StyleSheet.absoluteFill} pointerEvents="none">
            <Img
              source={{ uri: backdropUrl }}
              style={[StyleSheet.absoluteFill, { opacity: 0.4 }]}
              contentFit="cover"
            />
            <BlurView
              intensity={60}
              tint="dark"
              style={StyleSheet.absoluteFill}
            />
          </View>
        ) : null}

        {/* 2. Ánh sáng môi trường xanh console mát dịu (Console Ambient Blue Glow) */}
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <LinearGradient
            colors={[glass.ambient, alpha(colors.primary, 0.02), 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 0.75, y: 0.8 }}
            style={StyleSheet.absoluteFill}
          />
          <LinearGradient
            colors={['transparent', glass.ambientAccent, 'transparent']}
            start={{ x: 0.3, y: 0 }}
            end={{ x: 1, y: 0.55 }}
            style={StyleSheet.absoluteFill}
          />
        </View>

        {/* 3. Scrim kính tối đồng bộ hoàn toàn với SidePanel */}
        <View
          style={[StyleSheet.absoluteFill, { backgroundColor: alpha(colors.shade, 0.85) }]}
          pointerEvents="none"
        />

        {/* Ánh màu của theme trên lớp scrim (trong suốt ở theme Console) */}
        <LinearGradient
          colors={[glass.backdropTint, 'transparent']}
          start={{ x: 0, y: 1 }}
          end={{ x: 0.9, y: 0 }}
          pointerEvents="none"
          style={StyleSheet.absoluteFill}
        />
        <ThemeDecor />

        {/* 4. Bố cục hai cột Master - Detail Liquid Glass */}
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            paddingLeft: insets.left,
            paddingRight: insets.right,
            paddingTop: insets.top,
            paddingBottom: insets.bottom,
          }}
        >
          {/* CỘT TRÁI (MASTER / SIDEBAR): Liquid Glass Panel */}
          <View
            style={{
              width: navWidth,
              backgroundColor: appleColors.sidebarBg,
              borderRightWidth: 1,
              borderRightColor: appleColors.cardBorder,
              overflow: 'hidden',
            }}
          >
            <BlurView intensity={36} tint="dark" style={StyleSheet.absoluteFill} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.04)', 'rgba(255, 255, 255, 0.01)', 'rgba(255, 255, 255, 0.02)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />

            {/* Vệt sáng viền phải (Specular right edge rim) */}
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.18)', 'rgba(255, 255, 255, 0.04)', 'transparent']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 0 }}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                bottom: 0,
                width: 1.5,
                zIndex: 2,
              }}
            />

            {/* Top Bar của Sidebar: Tiêu đề Cài đặt chuẩn Glass */}
            <View
              style={{
                height: s(52),
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: s(16),
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: 'rgba(255, 255, 255, 0.10)',
                gap: s(8),
              }}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.35)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                }}
              />
              <T size={17} weight="bold" color="#FFFFFF" tracking={-0.02}>
                Cài đặt
              </T>
            </View>

            {/* Danh sách nhóm cài đặt */}
            <FocusScroll
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: s(10), paddingVertical: s(10) }}
            >
              {SECTIONS.map((section, index) => (
                <View key={section.id}>
                  <T
                    size={9.6}
                    weight="semibold"
                    color={appleColors.textSecondary}
                    tracking={0.08}
                    style={{ paddingHorizontal: s(10), marginTop: index > 0 ? s(14) : 0, marginBottom: s(4) }}
                  >
                    {section.label}
                  </T>
                  {CATEGORIES.filter((entry) => entry.section === section.id).map((entry) => (
                    <NavItem
                      key={entry.id}
                      entry={entry}
                      active={entry.id === category}
                      onPress={() => select(entry.id)}
                    />
                  ))}
                </View>
              ))}
            </FocusScroll>
          </View>

          {/* CỘT PHẢI (DETAIL): Liquid Glass Background & Panels */}
          <View style={{ flex: 1, backgroundColor: alpha(colors.bg, 0.40), overflow: 'hidden' }}>

            {/* Top Bar của Detail */}
            <View
              style={{
                height: s(52),
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: s(24),
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: 'rgba(255, 255, 255, 0.08)',
              }}
            >
              <LinearGradient
                colors={['rgba(255, 255, 255, 0.20)', 'rgba(255, 255, 255, 0.03)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  right: 0,
                  height: 1,
                }}
              />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={16} weight="bold" color="#FFFFFF" tracking={-0.015}>
                  {meta.label}
                </T>
                {meta.detail ? (
                  <T size={10.2} color={appleColors.textSecondary} numberOfLines={1} style={{ marginTop: s(1) }}>
                    {meta.detail}
                  </T>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
                <SaveStatus saving={saving} saved={saved} failed={failed} />
                {restore?.category === category ? (
                  <SettingsRestoreButton key={category} action={restore} notify={notify} />
                ) : null}
                {/* Nút đóng tròn đồng bộ SidePanel / Thông tin game */}
                <Press
                  onPress={onClose}
                  sound="back"
                  pressScale={0.92}
                  accessibilityLabel="Đóng cài đặt"
                  style={{
                    width: s(32),
                    height: s(32),
                    borderRadius: s(16),
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    borderColor: 'rgba(255, 255, 255, 0.16)',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View pointerEvents="none" style={[StyleSheet.absoluteFill, { borderRadius: s(16), overflow: 'hidden' }]}>
                    <BlurView
                      intensity={24}
                      tint="dark"
                      style={StyleSheet.absoluteFill}
                    />
                    <LinearGradient
                      colors={['rgba(255, 255, 255, 0.20)', 'transparent']}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 0, y: 0.8 }}
                      style={StyleSheet.absoluteFill}
                    />
                  </View>
                  <X size={s(15)} color="rgba(255, 255, 255, 0.85)" strokeWidth={2.2} />
                </Press>
              </View>
            </View>

            {/* Nội dung danh mục chi tiết */}
            <FocusScroll
              ref={content}
              style={{ flex: 1 }}
              contentContainerStyle={{
                paddingHorizontal: s(24),
                paddingTop: s(8),
                paddingBottom: s(36),
              }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View key={category} style={{ maxWidth: s(680) }}>
                <SettingsRestoreContext.Provider value={restoreContext}>
                  {page}
                </SettingsRestoreContext.Provider>
              </View>
            </FocusScroll>
          </View>
        </View>

        {/* Thông báo dạng Apple Glass Toast */}
        {notice ? (
          <View
            style={[
              styles.notice,
              {
                right: s(20) + insets.right,
                bottom: s(16) + insets.bottom,
                maxWidth: s(360),
                padding: s(12),
                borderRadius: s(14),
                gap: s(10),
                borderColor: notice.tone === 'error' ? 'rgba(248, 113, 113, 0.50)' : 'rgba(255, 255, 255, 0.18)',
                backgroundColor: alpha(colors.panel, 0.92),
                overflow: 'hidden',
              },
            ]}
          >
            <GlassBackdrop material="panel" intensity={42} radius={s(14)} />
            <LinearGradient
              colors={['rgba(255, 255, 255, 0.30)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: 1.5,
              }}
            />
            <View style={{ flex: 1 }}>
              <T size={12} weight="semibold" color={notice.tone === 'error' ? '#fca5a5' : '#FFFFFF'}>
                {notice.title}
              </T>
              {notice.detail ? (
                <T size={10.4} color={appleColors.textSecondary} leading={1.35} style={{ marginTop: s(2) }}>
                  {notice.detail}
                </T>
              ) : null}
            </View>
            <Press
              onPress={() => setNotice(null)}
              accessibilityLabel="Đóng thông báo"
              pressScale={0.92}
              style={{
                width: s(24),
                height: s(24),
                borderRadius: s(12),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255, 255, 255, 0.08)',
                borderWidth: StyleSheet.hairlineWidth,
                borderColor: 'rgba(255, 255, 255, 0.18)',
              }}
            >
              <X size={s(13)} color="rgba(255, 255, 255, 0.8)" />
            </Press>
          </View>
        ) : null}
      </Animated.View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    zIndex: 10,
    shadowColor: '#000000',
    shadowOpacity: 0.35,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
});
