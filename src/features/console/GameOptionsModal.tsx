import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronRight, Gamepad2, Info, Newspaper, ShoppingBag, Trash2, Trophy, X, type LucideIcon } from 'lucide-react-native';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { isSteamAppId } from '@/features/library/format';
import type { LibraryPanel, PcGame } from '@/features/library/types';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { openExternal } from '@/lib/open-external';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export type GameOptionsModalProps = {
  game: PcGame;
  uninstalling: boolean;
  onClose: () => void;
  onOpenPanel: (panel: LibraryPanel) => void;
  onUninstall: () => void;
};

function ActionItem({
  icon: Icon,
  iconColor,
  label,
  onPress,
  danger = false,
  disabled = false,
  autoFocus = false,
}: {
  icon: LucideIcon;
  iconColor?: string;
  label: string;
  onPress: () => void;
  danger?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  const { s } = useUi();
  const tint = danger ? '#f87171' : iconColor || 'rgba(255,255,255,0.88)';

  return (
    <Press
      disabled={disabled}
      onPress={onPress}
      autoFocus={autoFocus}
      sound={danger ? 'confirm' : 'navigate'}
      pressScale={0.98}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: s(12),
        paddingVertical: s(9),
        marginHorizontal: s(10),
        marginVertical: s(2.5),
        borderRadius: s(12),
        backgroundColor: danger ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: danger ? 'rgba(239,68,68,0.22)' : 'rgba(255,255,255,0.06)',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), flex: 1, minWidth: 0 }}>
        <View
          style={{
            width: s(30),
            height: s(30),
            borderRadius: s(8),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: danger ? 'rgba(239,68,68,0.14)' : 'rgba(255,255,255,0.07)',
          }}
        >
          <Icon size={s(15)} color={tint} strokeWidth={1.9} />
        </View>
        <T size={12} weight="medium" color={danger ? '#fca5a5' : 'rgba(255,255,255,0.92)'} numberOfLines={1}>
          {label}
        </T>
      </View>
      <ChevronRight size={s(14)} color={danger ? '#f87171' : 'rgba(255,255,255,0.28)'} strokeWidth={1.8} />
    </Press>
  );
}

/**
 * Hộp thoại tùy chọn game phong cách Console (Steam Deck / PS5 Quick Menu):
 * - Hiển thị dạng modal nổi ở giữa màn hình ngang với lớp nền tối mờ tinh tế.
 * - Tự động co giãn theo chiều cao mọi kích thước màn hình nhỏ, có ScrollView chống tràn.
 * - Hỗ trợ đầy đủ phím Back / phím B tay cầm và điều hướng D-pad.
 */
export function GameOptionsModal({
  game,
  uninstalling,
  onClose,
  onOpenPanel,
  onUninstall,
}: GameOptionsModalProps) {
  const { s, width, height, insets } = useUi();
  const [enter] = useState(() => new Animated.Value(0));

  useBack(onClose);

  useEffect(() => {
    Animated.timing(enter, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [enter]);

  const choose = (panel: LibraryPanel) => {
    onClose();
    onOpenPanel(panel);
  };

  const handleStore = () => {
    onClose();
    if (game.storeUrl) {
      void openExternal(game.storeUrl);
    }
  };

  const handleUninstall = () => {
    onClose();
    onUninstall();
  };

  const cardWidth = Math.min(s(390), width - s(32) - insets.left - insets.right);
  const cardMaxHeight = Math.min(s(360), height - s(20) - insets.top - insets.bottom);
  const artwork = game.artworkUrl || game.heroUrl;

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, styles.layer]}>
        {/* Nền mờ nhận chạm để đóng */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: enter }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { playUiSound('back'); onClose(); }} accessibilityLabel="Đóng tùy chọn" />
        </Animated.View>

        {/* Khung nội dung modal */}
        <Animated.View
          style={[
            styles.card,
            {
              width: cardWidth,
              maxHeight: cardMaxHeight,
              borderRadius: s(20),
              opacity: enter,
              transform: [
                {
                  scale: enter.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.93, 1],
                  }),
                },
              ],
            },
          ]}
        >
          {/* Header với ảnh bìa nhỏ, tên game và nút đóng */}
          <View style={[styles.header, { paddingHorizontal: s(16), paddingTop: s(14), paddingBottom: s(12) }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), flex: 1, minWidth: 0 }}>
              <View style={[styles.avatar, { width: s(40), height: s(40), borderRadius: s(10) }]}>
                {artwork ? (
                  <Img source={{ uri: artwork }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Gamepad2 size={s(20)} color={colors.accent} strokeWidth={1.8} />
                )}
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={14.5} weight="semibold" numberOfLines={1} tracking={-0.02}>
                  {game.title}
                </T>
                <T size={10} color={colors.text3} numberOfLines={1} style={{ marginTop: s(1.5) }}>
                  Tùy chọn trò chơi
                </T>
              </View>
            </View>

            <Press
              onPress={() => { playUiSound('back'); onClose(); }}
              sound="back"
              accessibilityLabel="Đóng"
              style={[styles.close, { width: s(28), height: s(28), borderRadius: s(14) }]}
            >
              <X size={s(14)} color={colors.text3} strokeWidth={2} />
            </Press>
          </View>

          <View style={styles.divider} />

          {/* Danh sách hành động hỗ trợ cuộn nếu màn hình quá nhỏ */}
          <ScrollView
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingVertical: s(6) }}
          >
            <ActionItem
              icon={Info}
              iconColor="#38bdf8"
              label="Thông tin game"
              autoFocus
              onPress={() => choose('info')}
            />

            {game.steamAppId ? (
              <ActionItem
                icon={Newspaper}
                iconColor="#60a5fa"
                label="Cập nhật & bản sửa lỗi"
                onPress={() => choose('news')}
              />
            ) : null}

            {game.steamAppId ? (
              <ActionItem
                icon={Trophy}
                iconColor="#facc15"
                label="Thành tựu"
                onPress={() => choose('achievements')}
              />
            ) : null}

            {game.storeUrl ? (
              <ActionItem
                icon={ShoppingBag}
                iconColor="#a78bfa"
                label="Cửa hàng Steam"
                onPress={handleStore}
              />
            ) : null}

            {game.installed !== false && isSteamAppId(game.steamAppId) ? (
              <>
                <View style={[styles.divider, { marginVertical: s(4), marginHorizontal: s(12) }]} />
                <ActionItem
                  icon={Trash2}
                  label={uninstalling ? 'Đang gỡ cài đặt…' : 'Gỡ cài đặt'}
                  danger
                  disabled={uninstalling}
                  onPress={handleUninstall}
                />
              </>
            ) : null}
          </ScrollView>
        </Animated.View>
      </View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 70,
    elevation: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    backgroundColor: 'rgba(2, 6, 14, 0.72)',
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: '#0d1522',
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 14 },
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  close: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});
