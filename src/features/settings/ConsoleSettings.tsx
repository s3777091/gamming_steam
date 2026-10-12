// Cài đặt kiểu console: danh sách nhóm bên trái, các hàng của nhóm đang chọn
// bên phải, ảnh thư viện làm mờ phía sau. Không có nút Lưu: cài đặt stream được
// ghi lên Supabase ngay sau mỗi thay đổi, cài đặt nhập liệu áp dụng tại chỗ rồi
// đồng bộ sau. Bản native của components/settings/ConsoleSettings.tsx.

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, ScrollView, StyleSheet, View } from 'react-native';
import {
  Check, ChevronLeft, Gamepad2, Gauge, Keyboard, Layers, Monitor, MonitorPlay, Mouse, RefreshCw, Sparkles, Volume2, Wifi, X, type LucideIcon,
} from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { PillButton } from './controls';
import { AudioPage, ControllerPage, DevicesPage, KeyboardPage, MousePage } from './DevicePages';
import { LatencyPage, NetworkPage, OverlayPage, QualityPage, VideoPage } from './StreamPages';
import { useInputSettings } from './useInputSettings';
import { useStreamSettingsDraft } from './useStreamSettingsDraft';

export type SettingsCategory =
  | 'quality' | 'video' | 'latency' | 'network' | 'overlay'
  | 'devices' | 'controller' | 'mouse' | 'keyboard' | 'audio';

type Tone = 'error' | 'success' | 'info';
type Notice = { id: number; tone: Tone; title: string; detail?: string };

const CATEGORIES: Array<{ id: SettingsCategory; label: string; detail: string; icon: LucideIcon; stream: boolean }> = [
  { id: 'quality', label: 'Chất lượng stream', detail: 'Chọn profile hợp với cách bạn chơi', icon: Sparkles, stream: true },
  { id: 'video', label: 'Hình ảnh', detail: 'Độ phân giải, FPS, codec và bitrate', icon: MonitorPlay, stream: true },
  { id: 'latency', label: 'Độ trễ & độ mượt', detail: 'Bộ đệm, frame pacing và V-Sync', icon: Gauge, stream: true },
  { id: 'network', label: 'Mạng', detail: 'Khu vực và kiểm tra đường truyền', icon: Wifi, stream: true },
  { id: 'overlay', label: 'Trong lúc stream', detail: 'HUD, viền phát và màn hình chờ', icon: Layers, stream: true },
  { id: 'devices', label: 'Thiết bị', detail: 'Thiết bị đang nối với máy này', icon: Monitor, stream: false },
  { id: 'controller', label: 'Tay cầm', detail: 'Bố cục nút, rung và vùng chết', icon: Gamepad2, stream: false },
  { id: 'mouse', label: 'Chuột', detail: 'Tốc độ con trỏ và cuộn', icon: Mouse, stream: false },
  { id: 'keyboard', label: 'Bàn phím', detail: 'Phím tắt và đổi phím', icon: Keyboard, stream: false },
  { id: 'audio', label: 'Âm thanh', detail: 'Đầu ra và âm lượng stream', icon: Volume2, stream: false },
];

function SaveStatus({ saving, saved, failed }: { saving: boolean; saved: boolean; failed: boolean }) {
  const { s } = useUi();
  if (!saving && !saved && !failed) return null;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
      {saving ? <ActivityIndicator size="small" color="rgba(255,255,255,0.55)" /> : failed ? <X size={s(14)} color="#fecaca" /> : <Check size={s(14)} color={colors.accent} />}
      <T size={10.6} weight="medium" color={failed ? '#fecaca' : 'rgba(255,255,255,0.55)'}>
        {saving ? 'Đang lưu…' : failed ? 'Chưa lưu được' : 'Đã lưu'}
      </T>
    </View>
  );
}

export default function ConsoleSettings({ initialCategory = 'quality', backdropUrl, onClose }: {
  initialCategory?: SettingsCategory;
  backdropUrl?: string | null;
  onClose: () => void;
}) {
  const { s, width, insets } = useUi();
  const [category, setCategory] = useState<SettingsCategory>(initialCategory);
  const [notice, setNotice] = useState<Notice | null>(null);
  const content = useRef<ScrollView>(null);
  const enter = useRef(new Animated.Value(0)).current;
  useBack(() => { onClose(); });

  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
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
    content.current?.scrollTo({ y: 0, animated: false });
  };

  const meta = CATEGORIES.find((entry) => entry.id === category)!;
  const settings = draft.settings;

  let page: ReactNode;
  if (!meta.stream) {
    page = category === 'devices' ? <DevicesPage notify={notify} />
      : category === 'controller' ? <ControllerPage input={input} />
        : category === 'mouse' ? <MousePage input={input} />
          : category === 'keyboard' ? <KeyboardPage input={input} notify={notify} />
            : <AudioPage input={input} />;
  } else if (draft.loading && !settings) {
    page = <View style={{ height: s(160), alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color="rgba(255,255,255,0.4)" /></View>;
  } else if (!settings) {
    page = (
      <View style={{ height: s(192), alignItems: 'center', justifyContent: 'center', paddingHorizontal: s(24) }}>
        <T size={13.6} color="rgba(255,255,255,0.85)">Không tải được cài đặt</T>
        <T size={10.8} color="rgba(255,255,255,0.48)" leading={1.5} style={{ marginTop: s(4), textAlign: 'center' }}>{draft.loadError}</T>
        <PillButton onPress={() => void draft.reload()}>
          <RefreshCw size={s(14)} color="rgba(255,255,255,0.8)" />
          <T size={10.8} weight="semibold" color="rgba(255,255,255,0.8)">Thử lại</T>
        </PillButton>
      </View>
    );
  } else {
    const props = { draft, settings };
    page = category === 'quality' ? <QualityPage {...props} />
      : category === 'video' ? <VideoPage {...props} />
        : category === 'latency' ? <LatencyPage {...props} />
          : category === 'network' ? <NetworkPage {...props} notify={notify} />
            : <OverlayPage {...props} />;
  }

  const saving = draft.saveState === 'saving' || input.syncState === 'saving';
  const failed = draft.saveState === 'error';
  const saved = !saving && !failed && (draft.saveState === 'saved' || inputTouched);
  const navWidth = Math.min(s(256), Math.max(s(184), width * 0.27));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: '#05080e', opacity: enter, zIndex: 60 }]}>
      {backdropUrl ? <Img source={{ uri: backdropUrl }} style={[StyleSheet.absoluteFill, { opacity: 0.35 }]} contentFit="cover" blurRadius={24} /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(5,8,14,0.82)' }]} />

      <View style={{ flex: 1, paddingLeft: s(22) + insets.left, paddingRight: s(22) + insets.right, paddingTop: s(10) + insets.top, paddingBottom: s(8) + insets.bottom }}>
        <View style={{ height: s(48), flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
          <Press
            onPress={onClose}
            accessibilityLabel="Đóng cài đặt"
            style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' }}
          >
            <ChevronLeft size={s(16)} color="rgba(255,255,255,0.75)" />
          </Press>
          <T size={19} weight="regular" tracking={-0.01} color="rgba(255,255,255,0.95)">Cài đặt</T>
          <View style={{ flex: 1 }} />
          <SaveStatus saving={saving} saved={saved} failed={failed} />
        </View>

        <View style={{ flex: 1, flexDirection: 'row', gap: Math.max(s(16), Math.min(s(40), width * 0.03)), paddingTop: s(4) }}>
          <ScrollView style={{ width: navWidth, flexGrow: 0 }} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: s(8) }}>
            {CATEGORIES.map((entry, index) => {
              const Icon = entry.icon;
              const active = entry.id === category;
              const divided = index > 0 && CATEGORIES[index - 1].stream !== entry.stream;
              return (
                <View key={entry.id} style={divided ? { marginTop: s(8), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.1)', paddingTop: s(8) } : { marginTop: index ? s(2) : 0 }}>
                  <Press
                    onPress={() => select(entry.id)}
                    pressScale={0.985}
                    accessibilityState={{ selected: active }}
                    style={{
                      height: s(40), flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(12), borderRadius: s(8), borderWidth: 1,
                      borderColor: active ? 'rgba(255,255,255,0.7)' : 'transparent', backgroundColor: active ? 'rgba(255,255,255,0.1)' : 'transparent',
                    }}
                  >
                    <Icon size={s(18)} color={active ? colors.white : 'rgba(255,255,255,0.7)'} strokeWidth={1.6} />
                    <T size={12.8} color={active ? colors.white : 'rgba(255,255,255,0.7)'} numberOfLines={1} style={{ flex: 1 }}>{entry.label}</T>
                  </Press>
                </View>
              );
            })}
          </ScrollView>

          <ScrollView ref={content} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: s(24) }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
            <View key={category} style={{ maxWidth: s(640) }}>
              <View style={{ marginBottom: s(12), paddingHorizontal: s(12) }}>
                <T size={15.2} weight="medium" tracking={-0.01}>{meta.label}</T>
                <T size={10.6} color="rgba(255,255,255,0.45)" style={{ marginTop: s(2) }}>{meta.detail}</T>
                {meta.stream && draft.deviceClass === 'phone' ? (
                  <T size={9.9} color="rgba(143,188,255,0.8)" style={{ marginTop: s(4) }}>
                    Tinh chỉnh riêng cho điện thoại · không đổi cài đặt trên PC hay laptop
                  </T>
                ) : null}
              </View>
              {page}
            </View>
          </ScrollView>
        </View>
      </View>

      {notice ? (
        <View
          style={[
            styles.notice,
            {
              right: s(22) + insets.right, bottom: s(14) + insets.bottom, maxWidth: s(352), padding: s(12), borderRadius: s(12), gap: s(12),
              borderColor: notice.tone === 'error' ? 'rgba(252,165,165,0.25)' : 'rgba(255,255,255,0.14)',
              backgroundColor: notice.tone === 'error' ? 'rgba(69,10,10,0.86)' : 'rgba(13,21,32,0.94)',
            },
          ]}
        >
          <View style={{ flex: 1 }}>
            <T size={11.8} weight="semibold">{notice.title}</T>
            {notice.detail ? <T size={10.2} color="rgba(255,255,255,0.6)" leading={1.5} style={{ marginTop: s(2) }}>{notice.detail}</T> : null}
          </View>
          <Press onPress={() => setNotice(null)} accessibilityLabel="Đóng thông báo" style={{ width: s(24), height: s(24), alignItems: 'center', justifyContent: 'center' }}>
            <X size={s(14)} color="rgba(255,255,255,0.5)" />
          </Press>
        </View>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  notice: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderWidth: 1,
    zIndex: 10,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 18 },
    elevation: 20,
  },
});
