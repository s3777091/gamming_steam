import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, Play } from 'lucide-react-native';

import { FocusScroll } from '@/features/gamepad/focus';
import { colors } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

// Cùng kích thước thẻ đang chọn ở tab Games (khung thiết kế 932x430).
const CARD = { w: 288, h: 112 };

/**
 * Tab PC: stream thẳng desktop của máy tính, không qua game nào. Cùng bố cục tab Games
 * (tiêu đề + nút tròn phía trên, kệ thẻ phía dưới) nhưng không có nút (…) vì không có
 * thông tin/thành tựu/cập nhật để xem. Cấu hình stream dùng chung với Games.
 */
export function PcView({ reachable, refreshing, error, onConnect }: {
  reachable: boolean;
  refreshing: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  const { s, width } = useUi();
  const enter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 760, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  const size = s(44);
  const label = reachable ? 'Kết nối máy tính' : 'Mở máy tính';
  const status = refreshing ? 'Đang kiểm tra máy tính…' : reachable ? 'Máy tính đã sẵn sàng' : 'Máy tính chưa kết nối';

  return (
    <View style={{ flex: 1 }}>
      <View pointerEvents="box-none" style={{ flex: 1, justifyContent: 'flex-end', paddingBottom: s(16), paddingTop: s(8), zIndex: 40 }}>
        <View pointerEvents="box-none" style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(28) }}>
          <Animated.View
            style={{
              flexShrink: 1,
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
            }}
          >
            <T size={Math.min(54, Math.max(32, width * 0.054 / 1.4))} weight="semibold" tracking={-0.055} leading={0.98} numberOfLines={1}>
              Jetson PC
            </T>
          </Animated.View>
          <Press
            onPress={onConnect}
            sound="confirm"
            autoFocus
            accessibilityLabel={label}
            style={[styles.play, { width: size, height: size, borderRadius: size / 2 }]}
          >
            {reachable ? (
              <Play size={s(18)} color={colors.white} fill={colors.white} style={{ marginLeft: s(2) }} />
            ) : (
              <Monitor size={s(18)} color={colors.white} />
            )}
          </Press>
        </View>
        {error && !reachable ? (
          <View style={[styles.error, { marginTop: s(10), maxWidth: s(480), borderRadius: s(12), paddingHorizontal: s(12), paddingVertical: s(6) }]}>
            <T size={10.4} color="#fee2e2" leading={1.5}>{error}</T>
          </View>
        ) : (
          <T size={10.4} weight="medium" color="rgba(255,255,255,0.66)" style={{ marginTop: s(10) }}>{status}</T>
        )}
      </View>

      <FocusScroll
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ flexGrow: 0, height: s(142) }}
        contentContainerStyle={{ alignItems: 'flex-end', paddingHorizontal: s(10), paddingTop: s(10), paddingBottom: s(12) }}
        accessibilityRole="list"
      >
        <Press onPress={onConnect} focusRadius={s(16)} pressScale={0.98} accessibilityLabel="Jetson PC">
          <View style={[styles.card, { width: s(CARD.w), height: s(CARD.h), borderRadius: s(16) }]}>
            <LinearGradient
              colors={['#0a4fb8', '#06265f', '#020b24']}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient colors={['rgba(255,255,255,0.08)', 'rgba(7,16,28,0)', 'rgba(7,16,28,0.5)']} style={StyleSheet.absoluteFill} />
            <Monitor size={s(36)} color="rgba(255,255,255,0.86)" strokeWidth={1.4} style={styles.cardIcon} />
            <View style={[styles.chip, { right: s(10), bottom: s(10), borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(6), gap: s(8) }]}>
              <View style={{ width: s(7), height: s(7), borderRadius: s(3.5), backgroundColor: reachable ? colors.success : colors.text4 }} />
              <T size={10.9} weight="semibold">{reachable ? 'Trực tuyến' : 'Ngoại tuyến'}</T>
            </View>
          </View>
        </Press>
      </FocusScroll>
    </View>
  );
}

const styles = StyleSheet.create({
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    shadowColor: colors.primary,
    shadowOpacity: 0.38,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    backgroundColor: colors.card,
  },
  cardIcon: { position: 'absolute', left: 16, top: 16 },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.18)',
    backgroundColor: 'rgba(10,17,28,0.58)',
  },
  error: {
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.2)',
    backgroundColor: 'rgba(69,10,10,0.54)',
  },
});
