import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { ChevronRight, Gamepad2, Info, Newspaper, ShoppingBag, Trash2, Trophy, type LucideIcon } from 'lucide-react-native';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { isSteamAppId } from '@/features/library/format';
import type { LibraryPanel, PcGame } from '@/features/library/types';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { openExternal } from '@/lib/open-external';
import { makeStyles, useTheme } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { PanelHeader } from '@/ui/PanelHeader';
import { useMotion } from '@/ui/motion';

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
  const { glass, colors } = useTheme();
  const { s } = useUi();
  const tint = danger ? colors.danger : iconColor || colors.accentSoft;

  return (
    <Press
      disabled={disabled}
      onPress={onPress}
      autoFocus={autoFocus}
      sound={danger ? 'confirm' : 'navigate'}
      focusTint={danger ? 'danger' : 'accent'}
      pressScale={0.975}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: s(12),
        paddingVertical: s(8.5),
        marginHorizontal: s(10),
        marginVertical: s(2),
        borderRadius: s(12),
        backgroundColor: glass.surfaceThin,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: glass.borderSubtle,
        opacity: disabled ? 0.5 : 1,
        overflow: 'hidden',
      }}
    >
      {/* Specular top sheen */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: StyleSheet.hairlineWidth,
          backgroundColor: glass.borderSpecular,
        }}
        pointerEvents="none"
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), flex: 1, minWidth: 0 }}>
        <View
          style={{
            width: s(30),
            height: s(30),
            borderRadius: s(8),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: danger ? 'rgba(239,68,68,0.14)' : glass.surfaceHighlight,
            borderWidth: StyleSheet.hairlineWidth,
            borderColor: danger ? 'rgba(239,68,68,0.24)' : glass.borderAccent,
          }}
        >
          <Icon size={s(15)} color={tint} strokeWidth={2} />
        </View>
        <T size={12.2} weight="medium" color={danger ? '#fca5a5' : 'rgba(255,255,255,0.95)'} numberOfLines={1}>
          {label}
        </T>
      </View>
      <ChevronRight size={s(14)} color={danger ? '#f87171' : 'rgba(255,255,255,0.35)'} strokeWidth={1.8} />
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
  const { colors } = useTheme();
  const { reduceMotion } = useMotion();
  const styles = useStyles();
  const { s, width, height, insets } = useUi();
  const [enter] = useState(() => new Animated.Value(0));
  const closingRef = useRef(false);

  const closeWithAnimation = useCallback((after?: () => void) => {
    if (closingRef.current) return;
    closingRef.current = true;
    enter.stopAnimation();
    Animated.timing(enter, {
      toValue: 0,
      duration: reduceMotion ? 0 : 150,
      easing: Easing.bezier(0.4, 0, 1, 1),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) {
        closingRef.current = false;
        return;
      }
      onClose();
      after?.();
    });
  }, [enter, onClose, reduceMotion]);

  useBack(() => closeWithAnimation());

  useEffect(() => {
    closingRef.current = false;
    enter.setValue(0);
    const animation = Animated.timing(enter, {
      toValue: 1,
      duration: reduceMotion ? 0 : 220,
      easing: Easing.bezier(0.16, 1, 0.3, 1),
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  const choose = (panel: LibraryPanel) => {
    closeWithAnimation(() => onOpenPanel(panel));
  };

  const handleStore = () => {
    closeWithAnimation(() => {
      if (game.storeUrl) void openExternal(game.storeUrl);
    });
  };

  const handleUninstall = () => {
    closeWithAnimation(onUninstall);
  };

  const cardWidth = Math.min(s(380), width - s(32) - insets.left - insets.right);
  const cardMaxHeight = Math.min(s(440), height - s(24) - insets.top - insets.bottom);
  const artwork = game.artworkUrl || game.heroUrl;

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, styles.layer]}>
        {/* Nền mờ nhận chạm để đóng */}
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: enter }]}>
          <GlassBackdrop material="scrim" />
          <Pressable style={StyleSheet.absoluteFill} onPress={() => { playUiSound('back'); closeWithAnimation(); }} accessibilityLabel="Đóng tùy chọn" />
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
                    outputRange: [0.975, 1],
                  }),
                },
              ],
            },
          ]}
        >
          <GlassBackdrop material="panel" radius={s(22)} />

          {/* Header với ảnh bìa nhỏ, tên game và nút đóng */}
          <PanelHeader title={game.title} subtitle="Tùy chọn trò chơi" onClose={() => closeWithAnimation()}
            leading={
              <View style={[styles.avatar, { width: s(38), height: s(38), borderRadius: s(10) }]}>
                {artwork ? (
                  <Img source={{ uri: artwork }} style={StyleSheet.absoluteFill} contentFit="cover" />
                ) : (
                  <Gamepad2 size={s(20)} color={colors.accent} strokeWidth={1.8} />
                )}
              </View>
            } />

          <ScrollView
            style={{ flexShrink: 1 }}
            showsVerticalScrollIndicator={false}
            bounces={false}
            contentContainerStyle={{ paddingTop: s(4), paddingBottom: s(12) }}
          >
            <ActionItem
              icon={Info}
              label="Thông tin game"
              autoFocus
              onPress={() => choose('info')}
            />

            {game.steamAppId ? (
              <ActionItem
                icon={Newspaper}
                iconColor={colors.accent}
                label="Cập nhật & bản sửa lỗi"
                onPress={() => choose('news')}
              />
            ) : null}

            {game.steamAppId ? (
              <ActionItem
                icon={Trophy}
                label="Thành tựu"
                onPress={() => choose('achievements')}
              />
            ) : null}

            {game.storeUrl ? (
              <ActionItem
                icon={ShoppingBag}
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

const useStyles = makeStyles(({ glass }) => ({
  layer: {
    zIndex: 70,
    elevation: 70,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrim: {
    backgroundColor: 'transparent',
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.panelBorder,
    backgroundColor: glass.modal,
    shadowColor: '#000',
    shadowOpacity: 0.58,
    shadowRadius: 30,
    shadowOffset: { width: 0, height: 14 },
    elevation: 20,
  },
  avatar: {
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: glass.surface,
    borderWidth: 1,
    borderColor: glass.border,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: glass.border,
  },
}));
