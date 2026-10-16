import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { FocusScroll, FocusLayer } from '@/features/gamepad/focus';
import { Clock3, Gamepad2, LockKeyhole, Play, Trophy, Users, X, ArrowUpRight } from 'lucide-react-native';

import { openExternal } from '@/lib/open-external';
import { alpha, makeStyles, useTheme } from '@/theme';
import { Img } from '@/ui/Img';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { PanelMessage, SidePanel, SteamLink } from '@/ui/SidePanel';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';

import { PERSONA_STATE_LABEL, formatHours, formatNumber, formatStorePrice } from './format';
import { GameScreenshots } from './GameScreenshots';
import type { ProfileAchievement, SteamProfile, SteamPromotion, SteamStoreItem, SteamUserDetails } from './types';
import type { SteamProfileState } from './useSteamProfile';

const COUNTRY_NAMES: Record<string, string> = {
  VN: 'Việt Nam', US: 'Hoa Kỳ', JP: 'Nhật Bản', KR: 'Hàn Quốc', CN: 'Trung Quốc', SG: 'Singapore',
  TH: 'Thái Lan', GB: 'Vương quốc Anh', DE: 'Đức', FR: 'Pháp', AU: 'Úc', CA: 'Canada',
};

function ProfileIdentity({ profile }: { profile: SteamUserDetails }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const status = profile.gameExtraInfo
    ? `Đang chơi ${profile.gameExtraInfo}`
    : PERSONA_STATE_LABEL[profile.personState] || PERSONA_STATE_LABEL[0];
  const country = profile.countryCode ? COUNTRY_NAMES[profile.countryCode] || profile.countryCode : null;
  const online = profile.personState > 0 || Boolean(profile.gameExtraInfo);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(14) }}>
      <View style={{ width: s(72), height: s(72) }}>
        <View style={[styles.avatar, { borderRadius: s(16) }]}>
          {profile.avatarUrl ? (
            <Img source={{ uri: profile.avatarUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          ) : (
            <Gamepad2 size={s(24)} color={colors.text3} />
          )}
        </View>
        {profile.level !== null ? (
          <View style={[styles.level, { right: -s(6), bottom: -s(6), borderRadius: s(10), paddingHorizontal: s(6), paddingVertical: s(4) }]}>
            <T size={10.5} weight="bold" tabular>LV {profile.level}</T>
          </View>
        ) : null}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={18} weight="semibold" tracking={-0.03} numberOfLines={1}>{profile.personaName}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(2) }}>
          <View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: online ? colors.accent : 'rgba(255,255,255,0.35)' }} />
          <T size={11} color={colors.text2} numberOfLines={1} style={{ flex: 1 }}>{status}</T>
        </View>
        {profile.realName || country ? (
          <T size={10.5} color={colors.text4} numberOfLines={1} style={{ marginTop: s(2) }}>
            {[profile.realName, country].filter(Boolean).join(', ')}
          </T>
        ) : null}
      </View>
    </View>
  );
}

function AchievementCard({ achievement }: { achievement: ProfileAchievement }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  return (
    <View style={[styles.activityCard, { width: s(172), padding: s(10), gap: s(10), borderRadius: s(16) }]}>
      <View style={[styles.iconBox, { width: s(40), height: s(40), borderRadius: s(12) }]}>
        {achievement.iconUrl ? (
          <Img source={{ uri: achievement.iconUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
        ) : (
          <Trophy size={s(16)} color={colors.accent} strokeWidth={1.7} />
        )}
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={11} weight="semibold" numberOfLines={1}>{achievement.name}</T>
        <T size={9.5} color={colors.text3} numberOfLines={1} style={{ marginTop: s(2) }}>{achievement.gameName}</T>
      </View>
    </View>
  );
}

function RecentActivity({ profile, state }: { profile: SteamUserDetails; state: SteamProfileState }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const { achievements, achievementsLoading, achievementsError } = state;
  const playing = profile.gameExtraInfo;
  const recent = playing
    ? profile.recentGames.find((game) => game.name.toLocaleLowerCase('vi') === playing.toLocaleLowerCase('vi'))
    : null;
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <T size={11.5} weight="semibold" color="rgba(255,255,255,0.76)">Hoạt động gần đây</T>
        {achievements.length > 0 ? (
          <T size={9.5} color={colors.text3} tabular>{achievements.length} achievement mới</T>
        ) : null}
      </View>
      <FocusScroll
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginTop: s(6), marginHorizontal: -s(4) }}
        contentContainerStyle={{ gap: s(8), paddingHorizontal: s(4), paddingVertical: s(6) }}
      >
        {playing ? (
          <View style={[styles.nowPlaying, { width: s(156), padding: s(10), gap: s(10), borderRadius: s(16) }]}>
            <View style={[styles.iconBox, { width: s(40), height: s(40), borderRadius: s(12) }]}>
              {recent?.iconUrl ? (
                <Img source={{ uri: recent.iconUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
              ) : (
                <Play size={s(16)} color={colors.accent} fill={colors.accent} />
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <T size={9.5} weight="semibold" color={colors.accentSoft}>Đang chơi</T>
              <T size={11} weight="semibold" numberOfLines={1} style={{ marginTop: s(2) }}>{playing}</T>
            </View>
          </View>
        ) : null}
        {achievementsLoading ? [0, 1].map((item) => <Skeleton key={item} width={s(172)} height={s(62)} radius={s(16)} tone={0.055} />) : null}
        {!achievementsLoading
          ? achievements.map((achievement) => (
            <AchievementCard key={`${achievement.appId}:${achievement.apiName}`} achievement={achievement} />
          ))
          : null}
        {!playing && !achievementsLoading && achievements.length === 0 ? (
          <View style={[styles.emptyActivity, { height: s(62), paddingHorizontal: s(12), borderRadius: s(16) }]}>
            <T size={10.5} color={colors.text3}>{achievementsError || 'Chưa có achievement mới từ các game đã cài.'}</T>
          </View>
        ) : null}
      </FocusScroll>
    </View>
  );
}

function ProfileStats({ profile }: { profile: SteamUserDetails }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  const stats = [
    { label: 'Số game', value: profile.ownedGames !== null ? formatNumber(profile.ownedGames) : null, icon: Gamepad2 },
    { label: 'Tổng giờ chơi', value: formatHours(profile.totalPlaytimeMinutes), icon: Clock3 },
    { label: 'Bạn bè', value: profile.friends !== null ? formatNumber(profile.friends) : null, icon: Users },
  ];
  return (
    <View style={[styles.stats, { borderRadius: s(16) }]}>
      {stats.map(({ label, value, icon: Icon }, index) => (
        <View
          key={label}
          style={{
            flex: 1, alignItems: 'center', paddingVertical: s(12), paddingHorizontal: s(8), gap: s(6),
            borderLeftWidth: index ? StyleSheet.hairlineWidth : 0, borderLeftColor: colors.line,
          }}
        >
          <Icon size={s(16)} color={colors.accent} strokeWidth={1.8} />
          <T size={11.5} weight="semibold" tabular numberOfLines={1}>{value ?? 'Riêng tư'}</T>
          <T size={9.5} color={colors.text3} numberOfLines={1}>{label}</T>
        </View>
      ))}
    </View>
  );
}

export function SteamProfilePanel({
  state,
  fallbackProfile,
  onClose,
}: {
  state: SteamProfileState;
  fallbackProfile?: SteamProfile | null;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { s } = useUi();
  const profile = state.details;
  const displayProfile: SteamUserDetails | null = profile ?? (fallbackProfile ? {
    steamId: fallbackProfile.steamId,
    personaName: fallbackProfile.personaName,
    profileUrl: fallbackProfile.profileUrl,
    avatarUrl: fallbackProfile.avatarUrl,
    personState: fallbackProfile.personState,
    gameExtraInfo: fallbackProfile.gameExtraInfo,
    lastLogoff: fallbackProfile.lastLogoff,
    realName: null,
    countryCode: null,
    createdAt: null,
    profilePublic: true,
    level: null,
    xp: null,
    xpForCurrentLevel: null,
    xpNeededToLevelUp: null,
    ownedGames: null,
    totalPlaytimeMinutes: null,
    friends: null,
    recentGames: [],
  } : null);

  return (
    <SidePanel title="Hồ sơ Steam" onClose={onClose} width={440}>
      {state.loading && !displayProfile ? (
        <View style={{ gap: s(12) }}>
          <Skeleton height={s(72)} radius={s(16)} tone={0.07} />
          <Skeleton height={s(64)} radius={s(16)} tone={0.06} />
          <Skeleton height={s(96)} radius={s(16)} tone={0.06} />
        </View>
      ) : state.error && !displayProfile ? (
        <PanelMessage icon={LockKeyhole} message={state.error} />
      ) : displayProfile ? (
        <View style={{ gap: s(16) }}>
          <ProfileIdentity profile={displayProfile} />
          {profile ? (
            <>
              <RecentActivity profile={profile} state={state} />
              <ProfileStats profile={profile} />
              {!profile.profilePublic ? (
                <View style={[styles.notice, { padding: s(10), borderRadius: s(12) }]}>
                  <T size={10.5} color="rgba(254,243,199,0.7)" leading={1.5}>
                    Hồ sơ Steam đang riêng tư nên một số mục không đọc được. Đặt Game details và Friends list thành Public trong Steam để hiện đủ.
                  </T>
                </View>
              ) : null}
              {profile.profileUrl ? <SteamLink href={profile.profileUrl}>Mở hồ sơ trên Steam</SteamLink> : null}
            </>
          ) : (
            <View style={{ gap: s(12), marginTop: s(8) }}>
              <Skeleton height={s(64)} radius={s(16)} tone={0.06} />
              <Skeleton height={s(96)} radius={s(16)} tone={0.06} />
            </View>
          )}
        </View>
      ) : null}
      <View style={{ marginTop: s(16) }}>
        <GameScreenshots />
      </View>
    </SidePanel>
  );
}

// ---------------------------------------------------------------- khuyến mãi

function DiscountedGameRow({ item, onOpen }: { item: SteamStoreItem; onOpen: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s } = useUi();
  return (
    <Press onPress={onOpen} pressScale={0.99} style={[styles.activityCard, { flex: 1, padding: s(8), gap: s(10), borderRadius: s(12) }]}>
      <View style={{ width: s(96), aspectRatio: 16 / 9, borderRadius: s(8), overflow: 'hidden', backgroundColor: colors.card }}>
        <Img source={{ uri: item.smallImage }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={10.5} weight="semibold" color="rgba(255,255,255,0.86)" numberOfLines={1}>{item.name}</T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6), marginTop: s(4) }}>
          {item.discounted ? (
            <View style={[styles.badge, { borderRadius: s(6), paddingHorizontal: s(6), paddingVertical: s(2) }]}>
              <T size={9} weight="bold" color={colors.onAccent} tabular>-{item.discountPercent}%</T>
            </View>
          ) : null}
          <T size={9} color={colors.text3}>{formatStorePrice(item)}</T>
        </View>
      </View>
    </Press>
  );
}

/** Ngăn kéo khuyến mãi: ảnh chiến dịch cùng các game đang giảm giá mà app đã có. */
export function PromotionPanel({ promotion, specials, onOpenGame, onClose }: {
  promotion: SteamPromotion;
  specials: SteamStoreItem[];
  onOpenGame: (item: SteamStoreItem) => void;
  onClose: () => void;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s, width, height, insets } = useUi();
  useBack(() => { onClose(); });
  const [enter] = useState(() => new Animated.Value(0));
  const { reduceMotion } = useMotion();

  useEffect(() => {
    const animation = Animated.timing(enter, { toValue: 1, duration: reduceMotion ? 0 : 260, easing: Easing.out(Easing.cubic), useNativeDriver: true, isInteraction: false });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  const panelWidth = Math.min(s(560), width * 0.78);
  const items = specials.slice(0, 8);
  const rows: SteamStoreItem[][] = [];
  for (let index = 0; index < items.length; index += 2) rows.push(items.slice(index, index + 2));
  return (
    <FocusLayer>
    <View style={[StyleSheet.absoluteFill, { zIndex: 50, elevation: 50 }]}>
      <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(colors.bg, 0.76), opacity: enter }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { playUiSound('back'); onClose(); }} accessibilityLabel="Đóng" />
      </Animated.View>
      <Animated.View
        style={[
          styles.promoPanel,
          {
            width: panelWidth + insets.right,
            paddingRight: insets.right,
            transform: [{ translateX: enter.interpolate({ inputRange: [0, 1], outputRange: [panelWidth * 0.4, 0] }) }],
            opacity: enter,
          },
        ]}
      >
        <View style={{ height: Math.max(s(120), height * 0.33), backgroundColor: colors.card }}>
          <Img source={{ uri: promotion.image }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <View style={[StyleSheet.absoluteFill, { backgroundColor: alpha(colors.panelSolid, 0.5) }]} />
          <View style={{ position: 'absolute', left: s(16), right: s(56), bottom: s(14) }}>
            <T size={9.5} weight="semibold" color="#8bbdff">Khuyến mãi Steam</T>
            <T size={22} weight="semibold" tracking={-0.035} leading={1.1} numberOfLines={2} style={{ marginTop: s(4) }}>{promotion.name}</T>
          </View>
          <Press onPress={onClose} sound="back" accessibilityLabel="Đóng khuyến mãi" style={[styles.promoClose, { top: s(12), right: s(12), width: s(32), height: s(32), borderRadius: s(16) }]}>
            <X size={s(16)} color={colors.text2} />
          </Press>
        </View>
        <FocusScroll contentContainerStyle={{ padding: s(16), paddingBottom: s(24) + insets.bottom }} showsVerticalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(16) }}>
            <View style={{ flex: 1 }}>
              <T size={12} weight="semibold" color="rgba(255,255,255,0.9)">Game đang giảm giá</T>
              <T size={10} color={colors.text4} style={{ marginTop: s(2) }}>Chọn game để xem thông tin ngay trong ứng dụng.</T>
            </View>
            <Press
              onPress={() => void openExternal(promotion.storeUrl)}
              style={[styles.pillButton, { height: s(32), paddingHorizontal: s(12), borderRadius: s(16), gap: s(6) }]}
            >
              <T size={10} weight="semibold" color={colors.text2}>Xem chương trình</T>
              <ArrowUpRight size={s(14)} color={colors.text2} strokeWidth={1.8} />
            </Press>
          </View>
          <View style={{ marginTop: s(12), gap: s(10) }}>
            {rows.map((row, index) => (
              <View key={index} style={{ flexDirection: 'row', gap: s(10) }}>
                {row.map((item) => <DiscountedGameRow key={item.appId} item={item} onOpen={() => onOpenGame(item)} />)}
                {row.length === 1 ? <View style={{ flex: 1 }} /> : null}
              </View>
            ))}
          </View>
        </FocusScroll>
      </Animated.View>
    </View>
    </FocusLayer>
  );
}

const useStyles = makeStyles(({ colors }) => ({
  avatar: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  level: {
    position: 'absolute',
    minWidth: 32,
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: colors.accent,
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 3,
  },
  activityCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  nowPlaying: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: alpha(colors.accent, 0.35),
    backgroundColor: alpha(colors.accent, 0.12),
    shadowColor: colors.accent,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 2,
  },
  iconBox: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(17,28,41,0.8)',
  },
  emptyActivity: {
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(255,255,255,0.15)',
  },
  stats: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  notice: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(253,230,138,0.2)',
    backgroundColor: 'rgba(252,211,77,0.08)',
  },
  badge: { backgroundColor: colors.accent },
  promoPanel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: alpha(colors.panelSolid, 0.92),
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(255,255,255,0.14)',
  },
  promoClose: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  pillButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
}));
