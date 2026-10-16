import { memo, useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Monitor, Play } from 'lucide-react-native';

import { FocusScroll } from '@/features/gamepad/focus';
import { alpha, makeStyles, useTheme } from '@/theme';
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
export const PcView = memo(function PcView({ reachable, refreshing, error, onConnect }: {
  reachable: boolean;
  refreshing: boolean;
  error: string | null;
  onConnect: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s, width } = useUi();
  const [enter] = useState(() => new Animated.Value(0));
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
        <Press onPress={onConnect} focusRadius={s(20)} focusVariant="glassCard" pressScale={0.98} accessibilityLabel="Jetson PC">
          <View style={[styles.card, { width: s(CARD.w), height: s(CARD.h), borderRadius: s(20) }]}>
            <LinearGradient
              colors={[colors.primaryDeep, colors.primaryDark, colors.primaryNight]}
              start={{ x: 1, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            {/* Lớp phản quang khúc xạ ánh sáng đa góc Liquid Glass */}
            <LinearGradient
              colors={['rgba(255,255,255,0.22)', alpha(colors.panelSolid, 0), alpha(colors.panelSolid, 0.6)]}
              locations={[0, 0.35, 1]}
              style={StyleSheet.absoluteFill}
            />
            <LinearGradient
              colors={['rgba(255,255,255,0.4)', 'transparent']}
              start={{ x: 0, y: 0 }}
              end={{ x: 0.8, y: 0.8 }}
              pointerEvents="none"
              style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={[styles.glassEdge, { borderRadius: s(19) }]} />
            <Monitor size={s(36)} color="rgba(255,255,255,0.92)" strokeWidth={1.5} style={styles.cardIcon} />
            <View style={[styles.chip, { right: s(10), bottom: s(10), borderRadius: s(12), paddingHorizontal: s(10), paddingVertical: s(6), gap: s(8) }]}>
              <View style={{ width: s(7), height: s(7), borderRadius: s(3.5), backgroundColor: reachable ? colors.success : colors.text4 }} />
              <T size={10.9} weight="bold">{reachable ? 'Trực tuyến' : 'Ngoại tuyến'}</T>
            </View>
          </View>
        </Press>
      </FocusScroll>
    </View>
  );
});

const useStyles = makeStyles(({ glass, colors }) => ({
  play: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.48)',
    shadowColor: colors.primaryHover,
    shadowOpacity: 0.55,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.cardBorderActive,
    backgroundColor: alpha(colors.card, 0.85),
    shadowColor: colors.primaryDeep,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  glassEdge: {
    ...StyleSheet.absoluteFill,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: glass.cardInnerEdge,
  },
  cardIcon: { position: 'absolute', left: 16, top: 16 },
  chip: {
    position: 'absolute',
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
    backgroundColor: alpha(colors.panelSolid, 0.65),
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 4,
  },
  error: {
    borderWidth: 1,
    borderColor: 'rgba(254,202,202,0.3)',
    backgroundColor: 'rgba(80,12,12,0.65)',
    shadowColor: '#f87171',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
}));
