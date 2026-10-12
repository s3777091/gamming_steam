// Thanh điều khiển phiên stream kiểu Dynamic Island: thu gọn là một đốm nhỏ giữa
// đỉnh (chấm sức khoẻ phiên), chạm thì nở thành thanh nút; im 4 giây tự co lại.
// Bản landscape của jetson-phone/src/components/StreamTakeover.tsx.

import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Activity, Keyboard, LayoutGrid, LogOut, Moon, RefreshCw, UserRound } from 'lucide-react-native';

import { RESOLUTION_META, RESOLUTION_ORDER, tierWithinDeviceLimit, type MoonlightSettings, type Resolution, type StreamSettings } from '@/lib/stream-settings';
import { detectStreamDeviceClass } from '@/lib/stream-device';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const AUTO_HIDE_MS = 4_000;

function BarButton({ label, onPress, active, children }: { label: string; onPress: () => void; active?: boolean; children: ReactNode }) {
  const { s } = useUi();
  return (
    <Press
      onPress={onPress}
      accessibilityLabel={label}
      style={{
        width: s(40), height: s(40), borderRadius: s(20), alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? 'rgba(102,168,255,0.18)' : 'transparent',
      }}
    >
      {children}
    </Press>
  );
}

export function StreamBar({
  visible, onVisibleChange, inputReady, audioReady, streamSettings, moonlightSettings, controller,
  hudEnabled, onGuide, onReconnect, onKeyboard, onExit, onToggleHud, onSaveResolution, onSleep,
}: {
  visible: boolean;
  onVisibleChange: (visible: boolean) => void;
  inputReady: boolean;
  audioReady: boolean;
  streamSettings: StreamSettings | null;
  moonlightSettings: MoonlightSettings | null;
  controller: { name: string; avatarUrl: string | null } | null;
  hudEnabled: boolean;
  onGuide: () => void;
  onReconnect: () => void;
  onKeyboard: () => void;
  onExit: () => void;
  onToggleHud: () => void;
  onSaveResolution: (resolution: Resolution) => void;
  onSleep: () => void;
}) {
  const { s, insets } = useUi();
  const slide = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmSleep, setConfirmSleep] = useState(false);
  const panelOpen = menuOpen || confirmSleep;
  const deviceClass = detectStreamDeviceClass();

  const clear = useCallback(() => { if (timer.current) clearTimeout(timer.current); timer.current = null; }, []);
  const arm = useCallback(() => {
    clear();
    if (panelOpen) return;
    timer.current = setTimeout(() => onVisibleChange(false), AUTO_HIDE_MS);
  }, [clear, onVisibleChange, panelOpen]);

  useEffect(() => {
    Animated.timing(slide, { toValue: visible ? 1 : 0, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    if (visible) arm(); else clear();
    return clear;
  }, [arm, clear, slide, visible]);

  const tap = (action: () => void) => () => {
    void Haptics.selectionAsync();
    clear();
    action();
    arm();
  };

  const dotColor = inputReady && audioReady ? colors.success : moonlightSettings ? colors.warning : 'rgba(255,255,255,0.4)';
  const translateY = slide.interpolate({ inputRange: [0, 1], outputRange: [-s(70), 0] });
  const current = streamSettings?.resolution ?? 'auto';
  const options = RESOLUTION_ORDER.filter((value) => value === 'auto' || tierWithinDeviceLimit(value, deviceClass));

  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: Math.min(insets.top, 8) + s(4), left: insets.left + s(10), right: insets.right + s(10), alignItems: 'center', zIndex: 80 }}
    >
      <Animated.View
        pointerEvents={visible ? 'none' : 'box-none'}
        style={{ position: 'absolute', opacity: slide.interpolate({ inputRange: [0, 0.45, 1], outputRange: [1, 0, 0] }), transform: [{ scale: slide.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }] }}
      >
        <Pressable
          accessibilityLabel="Mở thanh điều khiển"
          onPress={() => { void Haptics.selectionAsync(); onVisibleChange(true); }}
          hitSlop={18}
          style={{ height: s(14), minWidth: s(46), borderRadius: s(7), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }}
        >
          <View style={{ width: s(6), height: s(6), borderRadius: s(3), backgroundColor: dotColor }} />
        </Pressable>
      </Animated.View>

      <Animated.View
        pointerEvents={visible ? 'auto' : 'none'}
        style={[
          styles.bar,
          { borderRadius: s(28), padding: s(6), gap: s(2), opacity: slide, transform: [{ translateY }, { scale: slide.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] }) }] },
        ]}
      >
        <View style={{ width: s(40), height: s(40), borderRadius: s(20), overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
          {controller?.avatarUrl ? <Img source={{ uri: controller.avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : <UserRound size={s(17)} color={colors.text2} />}
        </View>
        <BarButton label="Menu tay cầm" onPress={tap(onGuide)}><LayoutGrid size={s(17)} color={colors.text2} /></BarButton>
        <BarButton label="Kết nối lại phiên" onPress={tap(onReconnect)}><RefreshCw size={s(17)} color={colors.text2} /></BarButton>
        <BarButton label="Menu độ phân giải" active={menuOpen} onPress={tap(() => setMenuOpen((value) => !value))}>
          <Activity size={s(17)} color={menuOpen ? colors.accentSoft : colors.text2} />
        </BarButton>
        <BarButton label="Cho máy ngủ" onPress={tap(() => setConfirmSleep(true))}><Moon size={s(17)} color={colors.text2} /></BarButton>
        <BarButton label="Bàn phím" onPress={tap(onKeyboard)}><Keyboard size={s(18)} color={colors.text2} /></BarButton>
        <BarButton label="Performance HUD" active={hudEnabled} onPress={tap(onToggleHud)}>
          <Activity size={s(17)} color={hudEnabled ? colors.accentSoft : colors.text2} />
        </BarButton>
        <View style={{ width: StyleSheet.hairlineWidth, height: s(22), marginHorizontal: s(4), backgroundColor: 'rgba(255,255,255,0.18)' }} />
        <BarButton label="Thoát phiên" onPress={tap(onExit)}><LogOut size={s(17)} color="#fca5a5" /></BarButton>
      </Animated.View>

      {menuOpen && visible ? (
        <View style={[styles.menu, { marginTop: s(8), width: s(300), maxHeight: s(250), borderRadius: s(16), padding: s(8) }]}>
          <T size={9.6} weight="semibold" color={colors.text4} tracking={0.12} style={{ paddingHorizontal: s(8), paddingBottom: s(6) }}>ĐỘ PHÂN GIẢI</T>
          <ScrollView showsVerticalScrollIndicator={false}>
            {options.map((value) => {
              const active = value === current;
              const meta = RESOLUTION_META[value];
              return (
                <Press
                  key={value}
                  onPress={() => { void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); setMenuOpen(false); onSaveResolution(value); }}
                  pressScale={0.99}
                  style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: s(10), paddingVertical: s(8), borderRadius: s(10), backgroundColor: active ? 'rgba(31,111,235,0.22)' : 'transparent' }}
                >
                  <T size={11.6} weight={active ? 'semibold' : 'medium'}>{meta.label}</T>
                  <T size={9.6} color={colors.text3}>{value === 'auto' && moonlightSettings ? `${moonlightSettings.videoSizeCustom.width}×${moonlightSettings.videoSizeCustom.height}` : meta.width}</T>
                </Press>
              );
            })}
          </ScrollView>
        </View>
      ) : null}

      {confirmSleep && visible ? (
        <View style={[styles.menu, { marginTop: s(8), width: s(320), borderRadius: s(16), padding: s(14) }]}>
          <T size={12.6} weight="semibold">Cho máy ở nhà ngủ?</T>
          <T size={10.6} color={colors.text3} leading={1.5} style={{ marginTop: s(4) }}>Máy sẽ lưu trạng thái và phiên stream sẽ đóng.</T>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(8), marginTop: s(12) }}>
            <Press onPress={() => setConfirmSleep(false)} style={{ height: s(34), paddingHorizontal: s(14), justifyContent: 'center', borderRadius: s(10) }}>
              <T size={11} weight="semibold" color={colors.text3}>Hủy</T>
            </Press>
            <Press onPress={() => { setConfirmSleep(false); onSleep(); }} style={{ height: s(34), paddingHorizontal: s(14), justifyContent: 'center', borderRadius: s(10), backgroundColor: colors.primary }}>
              <T size={11} weight="semibold">Cho ngủ</T>
            </Press>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(8,11,17,0.86)',
  },
  menu: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(8,11,17,0.94)',
  },
});
