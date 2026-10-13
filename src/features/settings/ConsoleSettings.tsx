// Màn hình Cài đặt theo ngôn ngữ thiết kế Apple (iPadOS / iOS Settings Split View):
// Bố cục chia hai cột Master - Detail: Cột trái liệt kê danh mục với biểu tượng squircle
// nhiều màu bo góc mềm, hàng đang chọn tô nền xanh Apple Blue (#007AFF) với chữ trắng
// (như mục FaceTime ở góc dưới ảnh mẫu); cột phải hiển thị các card Inset Grouped bo tròn
// viền mảnh, công tắc UISwitch xanh lá (#34C759) và dấu tích xanh #007AFF.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { FocusScroll, FocusLayer } from '@/features/gamepad/focus';
import {
  Check,
  Gamepad2,
  Gauge,
  Keyboard,
  Layers,
  Monitor,
  MonitorPlay,
  Mouse,
  RefreshCw,
  Sparkles,
  Volume2,
  Wifi,
  X,
  type LucideIcon,
} from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { appleColors, PillButton } from './controls';
import { AudioPage, ControllerPage, DevicesPage, KeyboardPage, MousePage } from './DevicePages';
import { LatencyPage, NetworkPage, OverlayPage, QualityPage, VideoPage } from './StreamPages';
import { useInputSettings } from './useInputSettings';
import { useStreamSettingsDraft } from './useStreamSettingsDraft';

export type SettingsCategory =
  | 'quality'
  | 'video'
  | 'latency'
  | 'network'
  | 'overlay'
  | 'devices'
  | 'controller'
  | 'mouse'
  | 'keyboard'
  | 'audio';

type Tone = 'error' | 'success' | 'info';
type Notice = { id: number; tone: Tone; title: string; detail?: string };

const CATEGORIES: Array<{
  id: SettingsCategory;
  label: string;
  detail: string;
  icon: LucideIcon;
  stream: boolean;
  color: string;
}> = [
  { id: 'quality', label: 'Chất lượng stream', detail: 'Chọn profile hợp với cách bạn chơi', icon: Sparkles, stream: true, color: appleColors.purple },
  { id: 'video', label: 'Hình ảnh', detail: 'Độ phân giải, FPS, codec, bitrate và lớp phủ', icon: MonitorPlay, stream: true, color: appleColors.blue },
  { id: 'latency', label: 'Độ trễ & độ mượt', detail: 'Bộ đệm, frame pacing và V-Sync', icon: Gauge, stream: true, color: appleColors.orange },
  { id: 'network', label: 'Mạng', detail: 'Khu vực và kiểm tra đường truyền', icon: Wifi, stream: true, color: appleColors.blue },
  { id: 'overlay', label: 'Trong lúc stream', detail: 'Performance HUD và viền phát sóng', icon: Layers, stream: true, color: appleColors.green },
  { id: 'devices', label: 'Thiết bị', detail: 'Thiết bị đang nối với máy này', icon: Monitor, stream: false, color: appleColors.gray },
  { id: 'controller', label: 'Tay cầm', detail: 'Bố cục nút, rung và vùng chết', icon: Gamepad2, stream: false, color: appleColors.red },
  { id: 'mouse', label: 'Chuột', detail: 'Tốc độ con trỏ và cuộn', icon: Mouse, stream: false, color: appleColors.teal },
  { id: 'keyboard', label: 'Bàn phím', detail: 'Phím tắt và đổi phím', icon: Keyboard, stream: false, color: appleColors.indigo },
  { id: 'audio', label: 'Âm thanh', detail: 'Đầu ra và âm lượng stream', icon: Volume2, stream: false, color: appleColors.pink },
];

function SaveStatus({ saving, saved, failed }: { saving: boolean; saved: boolean; failed: boolean }) {
  const { s } = useUi();
  if (!saving && !saved && !failed) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
      {saving ? (
        <ActivityIndicator size="small" color={appleColors.textTertiary} />
      ) : failed ? (
        <X size={s(14)} color={appleColors.red} strokeWidth={2.4} />
      ) : (
        <Check size={s(14)} color={appleColors.green} strokeWidth={2.6} />
      )}
      <T size={10.8} weight="medium" color={failed ? appleColors.red : appleColors.textTertiary}>
        {saving ? 'Đang lưu…' : failed ? 'Chưa lưu được' : 'Đã lưu'}
      </T>
    </View>
  );
}

export default function ConsoleSettings({
  initialCategory = 'quality',
  onClose,
}: {
  initialCategory?: SettingsCategory;
  backdropUrl?: string | null;
  onClose: () => void;
}) {
  const { s, width, insets } = useUi();
  const [category, setCategory] = useState<SettingsCategory>(initialCategory);
  const [notice, setNotice] = useState<Notice | null>(null);
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
  const [inputTouched, setInputTouched] = useState(false);

  useEffect(() => {
    if (input.syncState === 'saving') setInputTouched(true);
  }, [input.syncState]);

  const select = (next: SettingsCategory) => {
    setCategory(next);
    content.current?.scrollTo?.({ y: 0, animated: false });
  };

  const meta = CATEGORIES.find((entry) => entry.id === category)!;
  const settings = draft.settings;

  let page: ReactNode;
  if (!meta.stream) {
    page =
      category === 'devices' ? (
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
      ) : category === 'network' ? (
        <NetworkPage {...props} notify={notify} />
      ) : (
        <OverlayPage {...props} />
      );
  }

  const saving = draft.saveState === 'saving' || input.syncState === 'saving';
  const failed = draft.saveState === 'error';
  const saved = !saving && !failed && (draft.saveState === 'saved' || inputTouched);
  const navWidth = Math.min(s(280), Math.max(s(210), width * 0.28));

  const streamCategories = CATEGORIES.filter((c) => c.stream);
  const deviceCategories = CATEGORIES.filter((c) => !c.stream);

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
          {/* CỘT TRÁI (MASTER / SIDEBAR): Chuẩn Apple iPadOS Settings */}
          <View
            style={{
              width: navWidth,
              backgroundColor: appleColors.sidebarBg,
              borderRightWidth: StyleSheet.hairlineWidth,
              borderRightColor: appleColors.cardBorder,
            }}
          >
            {/* Top Bar của Sidebar: Tiêu đề Cài đặt chuẩn iPadOS */}
            <View
              style={{
                height: s(50),
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: s(16),
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: appleColors.cardBorder,
              }}
            >
              <T size={17} weight="bold" color={appleColors.text}>
                Cài đặt
              </T>
            </View>

            {/* Danh sách nhóm cài đặt */}
            <FocusScroll
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingHorizontal: s(10), paddingVertical: s(8) }}
            >
              <T
                size={9.6}
                weight="semibold"
                color={appleColors.textSecondary}
                tracking={0.08}
                style={{ paddingHorizontal: s(10), marginBottom: s(4) }}
              >
                STREAMING
              </T>
              {streamCategories.map((entry) => {
                const Icon = entry.icon;
                const active = entry.id === category;
                return (
                  <Press
                    key={entry.id}
                    onPress={() => select(entry.id)}
                    autoFocus={active}
                    pressScale={0.99}
                    accessibilityState={{ selected: active }}
                    style={{
                      height: s(38),
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: s(10),
                      paddingHorizontal: s(10),
                      borderRadius: s(8),
                      marginVertical: s(1),
                      backgroundColor: active ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: s(28),
                        height: s(28),
                        borderRadius: s(7),
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: entry.color,
                      }}
                    >
                      <Icon size={s(15)} color="#FFFFFF" strokeWidth={2.2} />
                    </View>
                    <T
                      size={13}
                      weight={active ? 'semibold' : 'regular'}
                      color={appleColors.text}
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {entry.label}
                    </T>
                  </Press>
                );
              })}

              <T
                size={9.6}
                weight="semibold"
                color={appleColors.textSecondary}
                tracking={0.08}
                style={{ paddingHorizontal: s(10), marginTop: s(14), marginBottom: s(4) }}
              >
                THIẾT BỊ
              </T>
              {deviceCategories.map((entry) => {
                const Icon = entry.icon;
                const active = entry.id === category;
                return (
                  <Press
                    key={entry.id}
                    onPress={() => select(entry.id)}
                    autoFocus={active}
                    pressScale={0.99}
                    accessibilityState={{ selected: active }}
                    style={{
                      height: s(38),
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: s(10),
                      paddingHorizontal: s(10),
                      borderRadius: s(8),
                      marginVertical: s(1),
                      backgroundColor: active ? 'rgba(0, 0, 0, 0.08)' : 'transparent',
                    }}
                  >
                    <View
                      style={{
                        width: s(28),
                        height: s(28),
                        borderRadius: s(7),
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: entry.color,
                      }}
                    >
                      <Icon size={s(15)} color="#FFFFFF" strokeWidth={2.2} />
                    </View>
                    <T
                      size={13}
                      weight={active ? 'semibold' : 'regular'}
                      color={appleColors.text}
                      numberOfLines={1}
                      style={{ flex: 1 }}
                    >
                      {entry.label}
                    </T>
                  </Press>
                );
              })}
            </FocusScroll>
          </View>

          {/* CỘT PHẢI (DETAIL): Chuẩn Inset Grouped của Apple */}
          <View style={{ flex: 1, backgroundColor: appleColors.bg }}>
            {/* Top Bar của Detail */}
            <View
              style={{
                height: s(50),
                flexDirection: 'row',
                alignItems: 'center',
                paddingHorizontal: s(24),
                borderBottomWidth: StyleSheet.hairlineWidth,
                borderBottomColor: appleColors.cardBorder,
              }}
            >
              <T size={16} weight="semibold" color={appleColors.text}>
                {meta.label}
              </T>
              <View style={{ flex: 1 }} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
                <SaveStatus saving={saving} saved={saved} failed={failed} />
                <Press
                  onPress={onClose}
                  sound="back"
                  accessibilityLabel="Đóng cài đặt"
                  style={{
                    paddingVertical: s(6),
                    paddingHorizontal: s(12),
                    borderRadius: s(14),
                    backgroundColor: 'rgba(0, 122, 255, 0.1)',
                  }}
                >
                  <T size={13.5} weight="semibold" color={appleColors.blue}>
                    Xong
                  </T>
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
                {page}
              </View>
            </FocusScroll>
          </View>
        </View>

        {/* Thông báo dạng Apple Banner */}
        {notice ? (
          <View
            style={[
              styles.notice,
              {
                right: s(20) + insets.right,
                bottom: s(16) + insets.bottom,
                maxWidth: s(340),
                padding: s(12),
                borderRadius: s(10),
                gap: s(10),
                borderColor: notice.tone === 'error' ? appleColors.red : appleColors.cardBorder,
                backgroundColor: '#FFFFFF',
              },
            ]}
          >
            <View style={{ flex: 1 }}>
              <T size={12} weight="semibold" color={notice.tone === 'error' ? appleColors.red : appleColors.text}>
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
              style={{ width: s(22), height: s(22), alignItems: 'center', justifyContent: 'center' }}
            >
              <X size={s(14)} color={appleColors.textTertiary} />
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
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
});
