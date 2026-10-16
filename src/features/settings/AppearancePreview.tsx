import { useCallback, useEffect, useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Bell, Monitor, Play, RotateCcw, Settings2, UserRound, X } from 'lucide-react-native';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { StreamLoading } from '@/features/stream/StreamLoading';
import type { PendingGameLaunch } from '@/lib/game-launch';
import { AvatarFrame, CardSurface, HeaderAccent, SeasonScenery, SeasonalIcon, useTheme } from '@/theme';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { SeasonPlayButton } from '@/ui/SeasonPlayButton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

/** Chỉ dùng để hiển thị, không gọi API hay mở game. */
const PREVIEW_LAUNCH: PendingGameLaunch = {
  sessionId: 'appearance-preview', gameId: 'appearance-preview', title: 'JETSONA',
  heroUrl: null, logoUrl: null, createdAt: 0,
};

export function AppearancePreview() {
  const { colors, glass, material, label } = useTheme();
  const { s } = useUi();
  const [preview, setPreview] = useState(false);
  return (
    <View style={{ padding: s(14), gap: s(16) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12) }}>
        <AvatarFrame size={s(32)}>
          <View style={{ width: s(32), height: s(32), borderRadius: s(16), backgroundColor: colors.cardRaised, alignItems: 'center', justifyContent: 'center' }}>
            <UserRound size={s(17)} color={colors.text} />
          </View>
        </AvatarFrame>
        <View style={{ flex: 1 }}>
          <T size={12} weight="semibold">{label}</T>
          <T size={9.5} color={colors.text2}>{material.label}</T>
        </View>
        <SeasonalIcon><Bell size={s(15)} color={colors.text2} /></SeasonalIcon>
        <SeasonalIcon><Settings2 size={s(15)} color={colors.text2} /></SeasonalIcon>
        <View style={{ marginLeft: s(4), flexDirection: 'row', alignItems: 'center', padding: s(6), borderRadius: s(12), borderWidth: 1, borderColor: glass.controlBorder, backgroundColor: glass.control }}>
          <HeaderAccent />
          <T size={9} tabular>20:26</T>
        </View>
      </View>
      <View style={{ height: s(92), borderRadius: s(14), overflow: 'hidden', backgroundColor: colors.card, borderWidth: 1, borderColor: glass.cardBorderActive }}>
        <LinearGradient colors={[colors.primaryDeep, colors.card, colors.bgDeep]} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <SeasonScenery compact />
        <CardSurface selected radius={s(14)} />
        <View style={{ flex: 1, padding: s(14), justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Monitor size={s(20)} color={colors.text} />
          <T size={11} weight="semibold">Jetson PC</T>
        </View>
        <SeasonPlayButton size={s(36)} sound={false} accessibilityLabel="Xem thử hiệu ứng nút Play"
          style={{ position: 'absolute', right: s(14), bottom: s(14), width: s(36), height: s(36), borderRadius: s(18), backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: glass.controlBorderActive }}>
          {(ink) => <Play size={s(15)} color={ink} fill={ink} style={{ marginLeft: s(1) }} />}
        </SeasonPlayButton>
      </View>
      <T size={9.4} color={colors.text3}>Chạm nút Play trong thẻ để thử hiệu ứng.</T>
      <Press onPress={() => setPreview(true)} sound="confirm" accessibilityLabel="Xem thử màn chờ, không kết nối máy tính" style={{ minHeight: s(40), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), borderRadius: s(12), backgroundColor: glass.control, borderWidth: 1, borderColor: glass.controlBorder }}>
        <Play size={s(13)} color={colors.accentGlow} />
        <T size={11} weight="semibold">Xem thử màn chờ</T>
      </Press>
      {preview ? <LoadingPreviewModal onClose={() => setPreview(false)} /> : null}
    </View>
  );
}

function LoadingPreviewModal({ onClose }: { onClose: () => void }) {
  return (
    <Modal visible animationType="fade" onRequestClose={onClose} supportedOrientations={['landscape', 'landscape-left', 'landscape-right']} statusBarTranslucent>
      <FocusLayer><LoadingPreviewScene onClose={onClose} /></FocusLayer>
    </Modal>
  );
}

function LoadingPreviewScene({ onClose }: { onClose: () => void }) {
  const { colors, glass, label } = useTheme();
  const { s, insets } = useUi();
  const { active } = useMotion();
  const [progress, setProgress] = useState(8);
  const [run, setRun] = useState(0);
  const [finished, setFinished] = useState(false);
  const complete = useCallback(() => setFinished(true), []);
  useBack(onClose);
  useEffect(() => {
    if (!active || progress >= 100) return;
    const timer = setTimeout(() => setProgress((value) => Math.min(100, value + 16)), 650);
    return () => clearTimeout(timer);
  }, [active, progress]);
  const replay = () => { setFinished(false); setProgress(8); setRun((value) => value + 1); };
  const status = progress < 40 ? 'Xem thử · Đang kết nối' : progress < 80 ? 'Xem thử · Đang chuẩn bị trò chơi' : 'Xem thử · Sắp sẵn sàng';
  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep, alignItems: 'center', justifyContent: 'center', padding: s(24) }}>
      <LinearGradient colors={[colors.cardRaised, colors.bgDeep]} style={StyleSheet.absoluteFill} />
      <View pointerEvents={finished ? 'auto' : 'none'} accessibilityElementsHidden={!finished} importantForAccessibility={finished ? 'auto' : 'no-hide-descendants'} style={{ alignItems: 'center' }}>
      <T size={22} weight="semibold">Xem thử hoàn tất</T>
      <T size={11} color={colors.text2} style={{ marginTop: s(8) }}>{label} · Không kết nối máy tính</T>
      <View style={{ flexDirection: 'row', gap: s(12), marginTop: s(24) }}>
        <Press onPress={replay} focusable={finished} style={{ padding: s(14), borderRadius: s(14), flexDirection: 'row', gap: s(8), backgroundColor: glass.control, borderWidth: 1, borderColor: glass.controlBorder }}>
          <RotateCcw size={s(16)} color={colors.text} /><T size={12}>Xem lại</T>
        </Press>
        <Press onPress={onClose} focusable={finished} style={{ padding: s(14), borderRadius: s(14), flexDirection: 'row', gap: s(8), backgroundColor: glass.control, borderWidth: 1, borderColor: glass.controlBorder }}>
          <X size={s(16)} color={colors.text} /><T size={12}>Đóng</T>
        </Press>
      </View>
      </View>
      <StreamLoading key={run} preview visible={progress < 100} phase="waiting" progress={progress} status={status} launch={PREVIEW_LAUNCH} onRetry={replay} onExit={onClose} onFinished={complete} />
      <View pointerEvents="none" style={{ position: 'absolute', top: insets.top + s(18), left: insets.left + s(18), zIndex: 45, backgroundColor: glass.panel, borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(6) }}>
        <T size={10} color={colors.text2}>Xem thử · {label}</T>
      </View>
    </View>
  );
}
