// Trang chi tiết game Steam Store, bố cục theo trang ứng dụng của App Store:
// bìa + logo, hàng chỉ số, tin cập nhật, ảnh, mô tả, nhận xét, thông tin.
// Nội dung dài mở trong một hộp thoại ở giữa màn hình. Bản native của
// components/StoreGameDetail.tsx + components/store-detail/*.

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, ScrollView } from 'react-native';
import { FocusScroll, FocusLayer } from '@/features/gamepad/focus';
import { LinearGradient } from 'expo-linear-gradient';
import {
  ArrowUpRight, Building2, Check, ChevronDown, ChevronLeft, ChevronRight, Download, Gamepad2, Gift, Loader, Monitor,
  Play, ShoppingCart, SquarePen, ThumbsDown, ThumbsUp, Trophy, X,
} from 'lucide-react-native';

import { useBack, useGamepadTabs } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import type { DetailSheet, DetailView, SteamStoreGameDetail, StoreDetailItem } from '@/features/library/detail-types';
import { formatCompact, formatNumber, formatRelative } from '@/features/library/format';
import { openExternal } from '@/lib/open-external';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { Skeleton } from '@/ui/Skeleton';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const PAGE_BG = '#0b121b';
const DIVIDER = 'rgba(255,255,255,0.09)';

function platformNames(platforms: SteamStoreGameDetail['platforms']): string {
  return [platforms.windows && 'Windows', platforms.mac && 'macOS', platforms.linux && 'Linux'].filter(Boolean).join(', ');
}

function languageCode(name: string): string {
  if (/việt/i.test(name)) return 'VI';
  if (/anh|english/i.test(name)) return 'EN';
  return name.replace(/^tiếng\s+/i, '').slice(0, 2).toUpperCase();
}

function SectionHeading({ title, onOpen }: { title: string; onOpen?: () => void }) {
  const { s } = useUi();
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
      <T size={16.8} weight="bold" tracking={-0.02}>{title}</T>
      {onOpen ? <ChevronRight size={s(17)} color="rgba(255,255,255,0.4)" strokeWidth={2.4} /> : null}
    </View>
  );
  return onOpen ? <Press onPress={onOpen} pressScale={0.98} style={{ alignSelf: 'flex-start' }}>{content}</Press> : content;
}

/** Đoạn văn cắt theo số dòng; chỉ hiện "thêm" khi chữ thật sự bị cắt. */
function ClampText({ text, lines, onMore }: { text: string; lines: number; onMore: () => void }) {
  const { s } = useUi();
  const [clamped, setClamped] = useState(false);
  return (
    <View>
      <T
        size={11.8}
        color="rgba(255,255,255,0.8)"
        leading={1.6}
        numberOfLines={lines}
        onTextLayout={(event) => setClamped(event.nativeEvent.lines.length >= lines)}
      >
        {text}
      </T>
      {clamped ? (
        <Press onPress={onMore} style={{ position: 'absolute', right: 0, bottom: 0, paddingLeft: s(28) }}>
          <LinearGradient
            colors={['rgba(11,18,27,0)', PAGE_BG]} locations={[0, 0.4]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
            style={StyleSheet.absoluteFill}
          />
          <T size={11.8} weight="semibold" color={colors.accent} leading={1.6}>thêm</T>
        </Press>
      ) : null}
    </View>
  );
}

function StatCell({ label, value, caption, onPress }: { label: string; value: ReactNode; caption: string; onPress?: () => void }) {
  const { s } = useUi();
  const body = (
    <View style={{ minWidth: s(116), paddingHorizontal: s(12), alignItems: 'center' }}>
      <T size={8.6} weight="semibold" color="rgba(255,255,255,0.38)" tracking={0.07} numberOfLines={1}>{label.toUpperCase()}</T>
      <View style={{ height: s(28), marginTop: s(4), justifyContent: 'center' }}>
        {typeof value === 'string' || typeof value === 'number'
          ? <T size={19} weight="bold" tracking={-0.02} color="rgba(255,255,255,0.7)" tabular>{value}</T>
          : value}
      </View>
      <T size={10} weight="medium" color="rgba(255,255,255,0.42)" numberOfLines={1} style={{ marginTop: s(2) }}>{caption}</T>
    </View>
  );
  return onPress ? <Press onPress={onPress} pressScale={0.97}>{body}</Press> : body;
}

function StatsRow({ view, onShowReviews }: { view: DetailView; onShowReviews: () => void }) {
  const { s } = useUi();
  const { detail, genres, languages, hasVietnamese, summary, positivePercent, openSheet } = view;
  const cells: ReactNode[] = [];
  if (summary && positivePercent !== null) {
    cells.push(<StatCell key="rating" label={`${formatCompact(summary.total)} đánh giá`} value={`${positivePercent}%`} caption={summary.label || 'tích cực'} onPress={onShowReviews} />);
  }
  if (detail.metacriticScore !== null) cells.push(<StatCell key="meta" label="Metacritic" value={detail.metacriticScore} caption="/ 100 điểm" />);
  if (detail.requiredAge) {
    cells.push(<StatCell key="age" label="Độ tuổi" value={`${detail.requiredAge}+`} caption="Tuổi" onPress={detail.contentNotice ? () => openSheet({ kind: 'content' }) : undefined} />);
  }
  if (genres[0]) cells.push(<StatCell key="genre" label="Thể loại" value={<Gamepad2 size={s(24)} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />} caption={genres[0]} />);
  if (detail.developers[0]) cells.push(<StatCell key="dev" label="Nhà phát triển" value={<Building2 size={s(24)} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />} caption={detail.developers[0]} />);
  if (languages.length) {
    cells.push(
      <StatCell
        key="lang" label="Ngôn ngữ" value={hasVietnamese ? 'VI' : languageCode(languages[0].name)}
        caption={languages.length > 1 ? `+ ${languages.length - 1} ngôn ngữ` : languages[0].name}
        onPress={() => openSheet({ kind: 'languages' })}
      />,
    );
  }
  if (detail.storageSize) cells.push(<StatCell key="size" label="Dung lượng" value={detail.storageSize.split(' ')[0]} caption={detail.storageSize.split(' ')[1] ?? ''} />);
  if (detail.achievementCount) {
    cells.push(<StatCell key="ach" label="Thành tựu" value={<Trophy size={s(24)} color="rgba(255,255,255,0.7)" strokeWidth={1.8} />} caption={`${detail.achievementCount} thành tựu`} />);
  }
  return (
    <View style={{ marginHorizontal: s(20), marginTop: s(20), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER, paddingTop: s(12) }}>
      <FocusScroll horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -s(20) }} contentContainerStyle={{ paddingHorizontal: s(8) }}>
        {cells.map((cell, index) => (
          <View key={index} style={{ borderLeftWidth: index ? StyleSheet.hairlineWidth : 0, borderLeftColor: DIVIDER }}>{cell}</View>
        ))}
      </FocusScroll>
    </View>
  );
}

function Rule({ children, style }: { children: ReactNode; style?: object }) {
  const { s } = useUi();
  return <View style={[{ marginHorizontal: s(20), marginTop: s(24), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER, paddingTop: s(20) }, style]}>{children}</View>;
}

function LatestNews({ view }: { view: DetailView }) {
  const { s } = useUi();
  const latest = view.detail.news[0];
  if (!latest) return null;
  return (
    <Rule>
      <SectionHeading title="Tính năng mới" onOpen={() => view.openSheet({ kind: 'news', index: null })} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: s(16), marginTop: s(10) }}>
        <T size={10.9} color="rgba(255,255,255,0.44)" numberOfLines={1} style={{ flex: 1 }}>{latest.title}</T>
        <T size={10.9} color="rgba(255,255,255,0.44)">{formatRelative(latest.publishedAt)}</T>
      </View>
      {latest.summary ? <View style={{ marginTop: s(6) }}><ClampText text={latest.summary} lines={3} onMore={() => view.openSheet({ kind: 'news', index: 0 })} /></View> : null}
    </Rule>
  );
}

function Screenshots({ view }: { view: DetailView }) {
  const { s, width } = useUi();
  const { detail, controllerSupport, openSheet } = view;
  if (!detail.screenshots.length) return null;
  const platforms = platformNames(detail.platforms);
  const itemWidth = Math.min(s(384), width * 0.6);
  return (
    <View style={{ marginTop: s(24), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER, paddingTop: s(20) }}>
      <View style={{ paddingHorizontal: s(20) }}><SectionHeading title="Xem trước" /></View>
      <FocusScroll horizontal showsHorizontalScrollIndicator={false} snapToInterval={itemWidth + s(12)} decelerationRate="fast"
        style={{ marginTop: s(12) }} contentContainerStyle={{ paddingHorizontal: s(20), gap: s(12) }}
      >
        {detail.screenshots.map((shot, index) => (
          <Press key={`${shot.id}-${shot.full}`} onPress={() => openSheet({ kind: 'screenshots', index })} pressScale={0.99}
            accessibilityLabel={`Xem ảnh ${index + 1} trong game`}
            style={{ width: itemWidth, aspectRatio: 16 / 9, borderRadius: s(16), overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line, backgroundColor: colors.card }}
          >
            <Img source={{ uri: shot.thumbnail }} style={{ width: '100%', height: '100%' }} contentFit="cover" recyclingKey={`${shot.id}`} />
          </Press>
        ))}
      </FocusScroll>
      <View style={{ marginHorizontal: s(20), marginTop: s(12), flexDirection: 'row', alignItems: 'center', gap: s(16), paddingBottom: s(12), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: DIVIDER }}>
        {platforms ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
            <Monitor size={s(16)} color="rgba(255,255,255,0.48)" strokeWidth={1.8} />
            <T size={10.9} weight="medium" color="rgba(255,255,255,0.48)">{platforms}</T>
          </View>
        ) : null}
        {controllerSupport ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
            <Gamepad2 size={s(16)} color="rgba(255,255,255,0.48)" strokeWidth={1.8} />
            <T size={10.9} weight="medium" color="rgba(255,255,255,0.48)">
              {controllerSupport === 'full' ? 'Hỗ trợ đầy đủ tay cầm' : 'Hỗ trợ một phần tay cầm'}
            </T>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function About({ view }: { view: DetailView }) {
  const { s } = useUi();
  const { detail, openSheet } = view;
  const description = detail.about || detail.shortDescription || null;
  return (
    <>
      {description ? <View style={{ marginHorizontal: s(20), marginTop: s(16) }}><ClampText text={description} lines={3} onMore={() => openSheet({ kind: 'about' })} /></View> : null}
      {detail.developers[0] ? (
        <Press
          onPress={() => void openExternal(`https://store.steampowered.com/search/?developer=${encodeURIComponent(detail.developers[0])}`)}
          pressScale={0.99}
          style={{ marginHorizontal: s(20), marginTop: s(20), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(12) }}
        >
          <View style={{ flex: 1 }}>
            <T size={12.2} weight="semibold" color={colors.accent} numberOfLines={1}>{detail.developers.join(', ')}</T>
            <T size={9.9} color="rgba(255,255,255,0.42)" style={{ marginTop: s(2) }}>Nhà phát triển</T>
          </View>
          <ChevronRight size={s(16)} color="rgba(255,255,255,0.32)" />
        </Press>
      ) : null}
    </>
  );
}

function ReviewVerdict({ recommended }: { recommended: boolean }) {
  const { s } = useUi();
  const Icon = recommended ? ThumbsUp : ThumbsDown;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
      <Icon size={s(16)} color={recommended ? colors.accent : '#ff8a80'} strokeWidth={2.2} />
      <T size={12.8} weight="bold">{recommended ? 'Đề xuất' : 'Không đề xuất'}</T>
    </View>
  );
}

function reviewMeta(review: SteamStoreGameDetail['reviews'][number]): string {
  return [formatRelative(review.postedAt), review.author, review.playtimeHours ? `${formatNumber(review.playtimeHours)} giờ chơi` : null].filter(Boolean).join(' · ');
}

function Reviews({ view, onLayout }: { view: DetailView; onLayout: (y: number) => void }) {
  const { s, width } = useUi();
  const { detail, summary, positivePercent, openSheet } = view;
  if (!summary && !detail.reviews.length) return null;
  const cardWidth = Math.min(s(336), width * 0.82);
  return (
    <View
      onLayout={(event) => onLayout(event.nativeEvent.layout.y)}
      style={{ marginTop: s(28), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: DIVIDER, paddingTop: s(20) }}
    >
      <View style={{ paddingHorizontal: s(20) }}>
        <SectionHeading title="Xếp hạng & nhận xét" onOpen={detail.reviews.length ? () => openSheet({ kind: 'reviews' }) : undefined} />
        {summary && positivePercent !== null ? (
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: s(24), marginTop: s(8) }}>
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end' }}>
                <T size={51} weight="bold" tracking={-0.05} leading={1} tabular>{positivePercent}</T>
                <T size={25} weight="bold" tracking={-0.02} tabular style={{ marginBottom: s(4) }}>%</T>
              </View>
              <T size={10.9} weight="semibold" color="rgba(255,255,255,0.56)" style={{ marginTop: s(4) }}>{summary.label || 'Tích cực'}</T>
            </View>
            <View style={{ width: '45%', maxWidth: s(224), paddingBottom: s(4) }}>
              <View style={{ height: s(6), borderRadius: s(3), overflow: 'hidden', backgroundColor: 'rgba(255,138,128,0.7)' }}>
                <View style={{ width: `${positivePercent}%`, height: '100%', borderRadius: s(3), backgroundColor: colors.accent }} />
              </View>
              <T size={10.5} weight="semibold" color="rgba(255,255,255,0.48)" style={{ marginTop: s(6), textAlign: 'right' }}>{formatCompact(summary.total)} đánh giá</T>
            </View>
          </View>
        ) : null}
      </View>

      {detail.reviews.length ? (
        <>
          <T size={13} weight="bold" color="rgba(255,255,255,0.92)" style={{ marginTop: s(20), paddingHorizontal: s(20) }}>Nhận xét hữu ích nhất</T>
          <FocusScroll horizontal showsHorizontalScrollIndicator={false} snapToInterval={cardWidth + s(12)} decelerationRate="fast"
            style={{ marginTop: s(10) }} contentContainerStyle={{ paddingHorizontal: s(20), gap: s(12) }}
          >
            {detail.reviews.map((review) => (
              <Press key={review.id} onPress={() => openSheet({ kind: 'review', id: review.id })} pressScale={0.99}
                style={{ width: cardWidth, height: s(168), padding: s(16), borderRadius: s(16), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.045)' }}
              >
                <ReviewVerdict recommended={review.recommended} />
                <T size={9.9} color="rgba(255,255,255,0.44)" numberOfLines={1} style={{ marginTop: s(4) }}>{reviewMeta(review)}</T>
                <T size={11.2} color="rgba(255,255,255,0.62)" leading={1.55} numberOfLines={4} style={{ marginTop: s(8) }}>{review.text}</T>
              </Press>
            ))}
          </FocusScroll>
        </>
      ) : null}

      <Press
        onPress={() => void openExternal(`${detail.storeUrl}#app_reviews_hash`)}
        pressScale={0.99}
        style={{ marginHorizontal: s(20), marginTop: s(16), height: s(44), borderRadius: s(16), flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: s(8), backgroundColor: 'rgba(255,255,255,0.08)' }}
      >
        <SquarePen size={s(16)} color="rgba(255,255,255,0.86)" strokeWidth={2} />
        <T size={11.8} weight="semibold" color="rgba(255,255,255,0.86)">Viết nhận xét trên Steam</T>
      </Press>
    </View>
  );
}

function InfoRow({ label, value, onOpen }: { label: string; value: string; onOpen?: () => void }) {
  const { s } = useUi();
  const body = (
    <View style={{ minHeight: s(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(16), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)', paddingVertical: s(10) }}>
      <T size={11.8} color="rgba(255,255,255,0.44)">{label}</T>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: s(6) }}>
        <T size={11.8} weight="medium" color="rgba(255,255,255,0.86)" numberOfLines={1} style={{ flexShrink: 1, textAlign: 'right' }}>{value}</T>
        {onOpen ? <ChevronDown size={s(14)} color="rgba(255,255,255,0.4)" strokeWidth={2.2} /> : null}
      </View>
    </View>
  );
  return onOpen ? <Press onPress={onOpen} pressScale={0.995}>{body}</Press> : body;
}

function Info({ view }: { view: DetailView }) {
  const { s } = useUi();
  const { detail, genres, controllerSupport, languages, hasVietnamese, openSheet } = view;
  const platforms = platformNames(detail.platforms);
  const hasRequirements = Boolean(detail.requirements.minimum.length || detail.requirements.recommended.length);
  const links = [
    detail.website && { label: 'Trang web nhà phát triển', href: detail.website },
    { label: 'Trang Steam', href: detail.storeUrl },
    detail.metacriticUrl && { label: 'Metacritic', href: detail.metacriticUrl },
  ].filter((link): link is { label: string; href: string } => Boolean(link));
  return (
    <Rule style={{ marginTop: s(28) }}>
      <SectionHeading title="Thông tin" />
      <View style={{ marginTop: s(6) }}>
        {detail.publishers[0] ? <InfoRow label="Nhà phát hành" value={detail.publishers.join(', ')} /> : null}
        {detail.developers[0] ? <InfoRow label="Nhà phát triển" value={detail.developers.join(', ')} /> : null}
        {detail.storageSize ? <InfoRow label="Dung lượng" value={detail.storageSize} /> : null}
        {genres.length ? <InfoRow label="Thể loại" value={genres.slice(0, 3).join(', ')} /> : null}
        <InfoRow label="Phát hành" value={detail.releaseDate || (detail.comingSoon ? 'Sắp ra mắt' : 'Chưa công bố')} />
        {platforms ? <InfoRow label="Nền tảng" value={platforms} /> : null}
        {controllerSupport ? <InfoRow label="Tay cầm" value={controllerSupport === 'full' ? 'Hỗ trợ đầy đủ' : 'Hỗ trợ một phần'} /> : null}
        {languages.length ? (
          <InfoRow label="Ngôn ngữ" value={hasVietnamese ? 'Tiếng Việt' : languages[0].name} onOpen={languages.length > 1 ? () => openSheet({ kind: 'languages' }) : undefined} />
        ) : null}
        {detail.requiredAge || detail.contentNotice ? (
          <InfoRow label="Độ tuổi" value={detail.requiredAge ? `${detail.requiredAge}+` : 'Có nội dung nhạy cảm'} onOpen={detail.contentNotice ? () => openSheet({ kind: 'content' }) : undefined} />
        ) : null}
        {hasRequirements ? <InfoRow label="Cấu hình" value="Tối thiểu & khuyến nghị" onOpen={() => openSheet({ kind: 'requirements' })} /> : null}
        {detail.legalNotice ? <InfoRow label="Bản quyền" value={detail.legalNotice.split('\n')[0]} onOpen={() => openSheet({ kind: 'legal' })} /> : null}
      </View>
      <View style={{ marginTop: s(4) }}>
        {links.map((link) => (
          <Press key={link.label} onPress={() => void openExternal(link.href)} pressScale={0.995}
            style={{ minHeight: s(44), flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(12), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)', paddingVertical: s(10) }}
          >
            <T size={11.8} weight="medium" color={colors.accent}>{link.label}</T>
            <ArrowUpRight size={s(16)} color={colors.accent} strokeWidth={2} />
          </Press>
        ))}
      </View>
    </Rule>
  );
}

// ---------------------------------------------------------------- hộp thoại

function DetailModal({ title, subtitle, onClose, onBack, wide, children }: {
  title: string; subtitle?: string | null; onClose: () => void; onBack?: () => void; wide?: boolean; children: ReactNode;
}) {
  const { s, width, height } = useUi();
  useBack(() => { if (onBack) onBack(); else onClose(); });
  return (
    <FocusLayer>
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: s(16), zIndex: 60, elevation: 60 }]}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,14,0.72)' }]} onPress={() => { playUiSound('back'); onClose(); }} />
      <View style={{ width: Math.min(s(wide ? 896 : 544), width - s(32)), maxHeight: height - s(32), borderRadius: s(22), overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: '#101924' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), paddingLeft: s(12), paddingRight: s(10), paddingVertical: s(10), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
          {onBack ? (
            <Press onPress={onBack} sound="back" accessibilityLabel="Quay lại" style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center' }}>
              <ChevronLeft size={s(18)} color={colors.text2} />
            </Press>
          ) : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <T size={14} weight="bold" numberOfLines={1}>{title}</T>
            {subtitle ? <T size={10} color="rgba(255,255,255,0.44)" numberOfLines={1}>{subtitle}</T> : null}
          </View>
          <Press onPress={onClose} sound="back" accessibilityLabel="Đóng" style={{ width: s(32), height: s(32), borderRadius: s(16), alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <X size={s(16)} color={colors.text2} />
          </Press>
        </View>
        <FocusScroll contentContainerStyle={{ padding: s(16) }} showsVerticalScrollIndicator={false}>{children}</FocusScroll>
      </View>
    </View>
    </FocusLayer>
  );
}

function Para({ children, strong }: { children: ReactNode; strong?: boolean }) {
  const { s } = useUi();
  return <T size={strong ? 12.4 : 11.6} weight={strong ? 'medium' : 'regular'} color={strong ? 'rgba(255,255,255,0.88)' : 'rgba(255,255,255,0.7)'} leading={1.7} style={{ marginTop: strong ? 0 : s(12) }}>{children}</T>;
}

function ScreenshotModal({
  view,
  index,
  onIndex,
  onClose,
}: {
  view: DetailView;
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const { s, width, height } = useUi();
  const [fitMode, setFitMode] = useState<'cover' | 'contain'>('cover');
  const shots = view.detail.screenshots;
  const shot = shots[index];

  useBack(onClose);
  useGamepadTabs((direction) => {
    if (direction === -1 && index > 0) {
      playUiSound('navigate');
      onIndex(index - 1);
      return true;
    }
    if (direction === 1 && index < shots.length - 1) {
      playUiSound('navigate');
      onIndex(index + 1);
      return true;
    }
  });

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  if (!shot) return null;

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', padding: s(16), zIndex: 60, elevation: 60 }]}>
        <Pressable
          style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,14,0.76)' }]}
          onPress={() => {
            playUiSound('back');
            onClose();
          }}
        />
        <View
          style={{
            width: Math.min(s(896), width - s(32)),
            height: height - s(32),
            borderRadius: s(22),
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: '#05080d',
          }}
          onTouchStart={(e) => {
            touchStartX.current = e.nativeEvent.pageX;
            touchStartY.current = e.nativeEvent.pageY;
          }}
          onTouchEnd={(e) => {
            if (touchStartX.current !== null && touchStartY.current !== null) {
              const dx = e.nativeEvent.pageX - touchStartX.current;
              const dy = e.nativeEvent.pageY - touchStartY.current;
              touchStartX.current = null;
              touchStartY.current = null;
              if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 35) {
                if (dx > 0 && index > 0) {
                  playUiSound('navigate');
                  onIndex(index - 1);
                } else if (dx < 0 && index < shots.length - 1) {
                  playUiSound('navigate');
                  onIndex(index + 1);
                }
              }
            }
          }}
        >
          {/* Ảnh toàn khung modal (chỗ khoanh vàng) */}
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={() => {
              setFitMode((prev) => (prev === 'cover' ? 'contain' : 'cover'));
            }}
          >
            <Img
              source={{ uri: shot.full }}
              placeholder={{ uri: shot.thumbnail }}
              style={StyleSheet.absoluteFill}
              contentFit={fitMode}
              priority="high"
            />
          </Pressable>

          {/* Dấu (x) đóng ở góc như cũ đè lên ảnh */}
          <Press
            onPress={onClose}
            sound="back"
            accessibilityLabel="Đóng xem trước"
            style={{
              position: 'absolute',
              top: s(12),
              right: s(12),
              zIndex: 20,
              width: s(34),
              height: s(34),
              borderRadius: s(17),
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'rgba(10, 16, 26, 0.72)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.18)',
            }}
          >
            <X size={s(17)} color="#fff" />
          </Press>

          {/* Nút lùi ảnh bên trái */}
          {index > 0 ? (
            <Press
              onPress={() => onIndex(index - 1)}
              sound="navigate"
              accessibilityLabel="Ảnh trước"
              style={{
                position: 'absolute',
                left: s(12),
                top: '50%',
                marginTop: -s(20),
                zIndex: 20,
                width: s(40),
                height: s(40),
                borderRadius: s(20),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(10, 16, 26, 0.72)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.18)',
              }}
            >
              <ChevronLeft size={s(20)} color="#fff" />
            </Press>
          ) : null}

          {/* Nút tiến ảnh bên phải */}
          {index < shots.length - 1 ? (
            <Press
              onPress={() => onIndex(index + 1)}
              sound="navigate"
              accessibilityLabel="Ảnh kế tiếp"
              style={{
                position: 'absolute',
                right: s(12),
                top: '50%',
                marginTop: -s(20),
                zIndex: 20,
                width: s(40),
                height: s(40),
                borderRadius: s(20),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(10, 16, 26, 0.72)',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.18)',
              }}
            >
              <ChevronRight size={s(20)} color="#fff" />
            </Press>
          ) : null}

          {/* Thanh số thứ tự ảnh ở dưới giữa */}
          <View
            style={{
              position: 'absolute',
              bottom: s(12),
              alignSelf: 'center',
              zIndex: 20,
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(10),
              paddingHorizontal: s(12),
              paddingVertical: s(6),
              borderRadius: s(16),
              backgroundColor: 'rgba(10, 16, 26, 0.72)',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.18)',
            }}
          >
            <Press
              disabled={index === 0}
              onPress={() => onIndex(index - 1)}
              sound="navigate"
              accessibilityLabel="Ảnh trước"
              style={{
                opacity: index === 0 ? 0.35 : 1,
                width: s(26),
                height: s(26),
                borderRadius: s(13),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <ChevronLeft size={s(15)} color="#fff" />
            </Press>
            <T size={11} color="rgba(255, 255, 255, 0.9)" weight="semibold" tabular>
              {index + 1} / {shots.length}
            </T>
            <Press
              disabled={index === shots.length - 1}
              onPress={() => onIndex(index + 1)}
              sound="navigate"
              accessibilityLabel="Ảnh kế tiếp"
              style={{
                opacity: index === shots.length - 1 ? 0.35 : 1,
                width: s(26),
                height: s(26),
                borderRadius: s(13),
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'rgba(255,255,255,0.08)',
              }}
            >
              <ChevronRight size={s(15)} color="#fff" />
            </Press>
          </View>
        </View>
      </View>
    </FocusLayer>
  );
}

function SheetView({ sheet, view, onClose }: { sheet: DetailSheet; view: DetailView; onClose: () => void }) {
  const { s } = useUi();
  const { detail, name, languages, openSheet, summary, positivePercent } = view;
  switch (sheet.kind) {
    case 'about':
      return (
        <DetailModal title="Giới thiệu" subtitle={name} onClose={onClose}>
          {detail.shortDescription ? <Para strong>{detail.shortDescription}</Para> : null}
          {detail.about && detail.about !== detail.shortDescription ? <Para>{detail.about}</Para> : null}
          {detail.contentNotice ? <View style={{ marginTop: s(16), padding: s(12), borderRadius: s(12), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.03)' }}><T size={10.4} color="rgba(255,255,255,0.5)" leading={1.5}>{detail.contentNotice}</T></View> : null}
        </DetailModal>
      );
    case 'news': {
      if (sheet.index === null) {
        return (
          <DetailModal title="Tính năng mới" subtitle={name} onClose={onClose}>
            {detail.news.map((news, index) => (
              <Press key={news.id} onPress={() => openSheet({ kind: 'news', index, fromList: true })} pressScale={0.99}
                style={{ flexDirection: 'row', alignItems: 'center', gap: s(12), paddingVertical: s(12), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }}
              >
                <View style={{ flex: 1 }}>
                  <T size={12} weight="semibold" color="rgba(255,255,255,0.88)" numberOfLines={2}>{news.title}</T>
                  <T size={10} color="rgba(255,255,255,0.42)" style={{ marginTop: s(2) }}>{formatRelative(news.publishedAt)}</T>
                </View>
                <ChevronRight size={s(16)} color="rgba(255,255,255,0.32)" />
              </Press>
            ))}
          </DetailModal>
        );
      }
      const news = detail.news[sheet.index];
      if (!news) return null;
      return (
        <DetailModal
          title={news.title}
          subtitle={[formatRelative(news.publishedAt), news.author].filter(Boolean).join(' · ')}
          onClose={onClose}
          onBack={sheet.fromList ? () => openSheet({ kind: 'news', index: null }) : undefined}
        >
          <Para strong>{news.summary || 'Bài viết này không có nội dung tóm tắt.'}</Para>
          {news.url ? (
            <Press onPress={() => void openExternal(news.url!)} style={{ marginTop: s(16), alignSelf: 'flex-start', height: s(36), paddingHorizontal: s(14), borderRadius: s(18), flexDirection: 'row', alignItems: 'center', gap: s(6), backgroundColor: 'rgba(255,255,255,0.09)' }}>
              <T size={10.9} weight="semibold" color="rgba(255,255,255,0.86)">Đọc trên Steam</T>
              <ArrowUpRight size={s(14)} color="rgba(255,255,255,0.86)" />
            </Press>
          ) : null}
        </DetailModal>
      );
    }
    case 'reviews':
      return (
        <DetailModal title="Xếp hạng & nhận xét" subtitle={name} onClose={onClose}>
          {summary && positivePercent !== null ? (
            <T size={11.2} color="rgba(255,255,255,0.52)" style={{ marginBottom: s(12) }}>
              <T size={11.2} weight="bold" color="rgba(255,255,255,0.86)">{positivePercent}% tích cực</T>
              {` trong ${formatNumber(summary.total)} đánh giá${summary.label ? ` · ${summary.label}` : ''}`}
            </T>
          ) : null}
          <View style={{ gap: s(10) }}>
            {detail.reviews.map((review) => (
              <View key={review.id} style={{ padding: s(14), borderRadius: s(16), borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)', backgroundColor: 'rgba(255,255,255,0.035)' }}>
                <ReviewVerdict recommended={review.recommended} />
                <T size={9.9} color="rgba(255,255,255,0.44)" style={{ marginTop: s(4) }}>{reviewMeta(review)}</T>
                <T size={11.5} color="rgba(255,255,255,0.72)" leading={1.6} style={{ marginTop: s(8) }}>{review.text}</T>
              </View>
            ))}
          </View>
        </DetailModal>
      );
    case 'review': {
      const review = detail.reviews.find((entry) => entry.id === sheet.id);
      if (!review) return null;
      return (
        <DetailModal title={review.author || 'Người chơi Steam'} subtitle={formatRelative(review.postedAt)} onClose={onClose}>
          <ReviewVerdict recommended={review.recommended} />
          {review.playtimeHours ? <T size={10.2} color="rgba(255,255,255,0.44)" style={{ marginTop: s(4) }}>{formatNumber(review.playtimeHours)} giờ chơi khi viết nhận xét</T> : null}
          <T size={12.2} color="rgba(255,255,255,0.8)" leading={1.7} style={{ marginTop: s(12) }}>{review.text}</T>
          {review.votesUp > 0 ? <T size={10.2} color="rgba(255,255,255,0.4)" style={{ marginTop: s(16) }}>{formatNumber(review.votesUp)} người thấy hữu ích</T> : null}
        </DetailModal>
      );
    }
    case 'screenshots':
      return (
        <ScreenshotModal
          view={view}
          index={sheet.index}
          onIndex={(index) => openSheet({ kind: 'screenshots', index })}
          onClose={onClose}
        />
      );
    case 'languages':
      return (
        <DetailModal title="Ngôn ngữ" subtitle={`${languages.length} ngôn ngữ được hỗ trợ`} onClose={onClose}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: s(16) }}>
            {languages.map((language) => (
              <View key={language.name} style={{ width: '47%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: s(8), paddingVertical: s(8), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                <T size={11.4} color="rgba(255,255,255,0.8)" numberOfLines={1} style={{ flex: 1 }}>{language.name}</T>
                {language.fullAudio ? <View style={{ paddingHorizontal: s(6), paddingVertical: s(2), borderRadius: s(6), backgroundColor: 'rgba(255,255,255,0.08)' }}><T size={8.6} weight="semibold" color="rgba(255,255,255,0.56)">Lồng tiếng</T></View> : null}
              </View>
            ))}
          </View>
        </DetailModal>
      );
    case 'requirements':
      return (
        <DetailModal title="Cấu hình máy tính" subtitle={name} onClose={onClose} wide>
          <View style={{ flexDirection: 'row', gap: s(20) }}>
            {([['Tối thiểu', detail.requirements.minimum], ['Khuyến nghị', detail.requirements.recommended]] as const)
              .filter(([, rows]) => rows.length > 0)
              .map(([title, rows]) => (
                <View key={title} style={{ flex: 1 }}>
                  <T size={11.5} weight="bold" color="rgba(255,255,255,0.9)">{title}</T>
                  {rows.map((row, index) => (
                    <View key={`${row.label}-${index}`} style={{ paddingVertical: s(8), borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(255,255,255,0.08)' }}>
                      {row.label ? <T size={10.5} color="rgba(255,255,255,0.42)">{row.label}</T> : null}
                      <T size={10.5} color="rgba(255,255,255,0.8)" leading={1.5} style={{ marginTop: row.label ? s(2) : 0 }}>{row.value}</T>
                    </View>
                  ))}
                </View>
              ))}
          </View>
        </DetailModal>
      );
    case 'legal':
      return <DetailModal title="Bản quyền" subtitle={name} onClose={onClose}><T size={11.2} color="rgba(255,255,255,0.7)" leading={1.7}>{detail.legalNotice}</T></DetailModal>;
    case 'content':
      return (
        <DetailModal title="Độ tuổi & nội dung" subtitle={name} onClose={onClose}>
          {detail.requiredAge ? <T size={11.8} weight="semibold" color="rgba(255,255,255,0.88)">Dành cho người chơi từ {detail.requiredAge} tuổi.</T> : null}
          {detail.contentNotice ? <T size={11.2} color="rgba(255,255,255,0.66)" leading={1.7} style={{ marginTop: s(8) }}>{detail.contentNotice}</T> : null}
        </DetailModal>
      );
  }
}

// ---------------------------------------------------------------- trang chính

/** Nút chính của trang: Mua / Nhận / Tải / Chơi, do màn chứa quyết định theo quyền sở hữu. */
export type StoreBuyAction = {
  label: string;
  /** Hiện cạnh nhãn ở thanh trên khi cuộn qua phần giá (ví dụ "Mua · 199.000 ₫"). */
  price?: string;
  icon: 'buy' | 'free' | 'download' | 'play' | 'wait' | 'owned';
  disabled?: boolean;
  onPress: () => void;
};

const BUY_ICONS = { buy: ShoppingCart, free: Gift, download: Download, play: Play, wait: Loader, owned: Check } as const;

function BuyButton({ action, compact }: { action: StoreBuyAction; compact?: boolean }) {
  const { s } = useUi();
  const Icon = BUY_ICONS[action.icon];
  const filled = action.icon === 'play';
  return (
    <Press
      onPress={action.onPress}
      disabled={action.disabled}
      sound="confirm"
      accessibilityLabel={action.label}
      style={{
        height: s(36), paddingHorizontal: s(compact ? 14 : 18), borderRadius: s(18), flexDirection: 'row', alignItems: 'center', gap: s(7),
        backgroundColor: colors.white, opacity: action.disabled ? 0.55 : 1,
      }}
    >
      <Icon size={s(compact ? 14 : 15)} color="#08111d" strokeWidth={2.3} fill={filled ? '#08111d' : 'none'} />
      <T size={compact ? 10.2 : 11.2} weight="bold" color="#08111d" numberOfLines={1}>{compact && action.price ? `${action.label} · ${action.price}` : action.label}</T>
    </Press>
  );
}

function DetailLoading() {
  const { s, width } = useUi();
  return (
    <View style={{ marginTop: s(24), paddingHorizontal: s(20), gap: s(12) }}>
      <Skeleton height={s(56)} radius={s(12)} />
      <Skeleton width="66%" height={s(16)} radius={s(4)} />
      <View style={{ flexDirection: 'row', gap: s(12) }}>
        {[0, 1].map((item) => <Skeleton key={item} width={Math.min(s(384), width * 0.6)} height={s(180)} radius={s(16)} />)}
      </View>
    </View>
  );
}

export function StoreGameDetail({ item, detail, loading, error, priceLabel, buyAction, onClose }: {
  item: StoreDetailItem & { discounted: boolean; discountPercent: number };
  detail: SteamStoreGameDetail | null;
  loading: boolean;
  error: string | null;
  priceLabel: string;
  buyAction?: StoreBuyAction;
  onClose: () => void;
}) {
  const { s, insets } = useUi();
  const [sheet, setSheet] = useState<DetailSheet | null>(null);
  const [compact, setCompact] = useState(false);
  const [coverFailed, setCoverFailed] = useState(false);
  const scroller = useRef<ScrollView>(null);
  const reviewsY = useRef(0);
  const enter = useRef(new Animated.Value(0)).current;

  const isFree = detail?.isFree || priceLabel.toLowerCase().includes('miễn phí') || priceLabel.toLowerCase().includes('free');
  const effectiveBuyAction: StoreBuyAction = buyAction ?? {
    label: isFree ? 'Chơi miễn phí' : 'Mở trên Steam',
    icon: isFree ? 'free' : 'buy',
    onPress: () => void openExternal(item.storeUrl || `https://store.steampowered.com/app/${item.appId}/`),
  };

  useBack(() => { if (sheet) setSheet(null); else onClose(); });
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  const name = detail?.name || item.name;
  const storeUrl = detail?.storeUrl || item.storeUrl;
  const cover = !coverFailed && (detail?.portraitImage || item.portraitImage);
  const genres = detail?.genres.length ? detail.genres : item.genres || [];
  const languages = detail?.languages || [];
  const summary = detail?.reviewSummary ?? null;
  const view: DetailView | null = detail && {
    detail,
    name,
    genres,
    controllerSupport: detail.controllerSupport ?? item.controllerSupport,
    languages,
    hasVietnamese: languages.some((language) => /việt/i.test(language.name)),
    summary,
    positivePercent: summary && summary.total > 0 ? Math.round((summary.positive / summary.total) * 100) : null,
    openSheet: setSheet,
  };

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const next = event.nativeEvent.contentOffset.y > s(150);
    setCompact((current) => (current === next ? current : next));
  };

  const logo = detail?.logo ?? item.logo ?? null;
  const coverSource = cover || detail?.headerImage || item.headerImage;
  const [failedLogo, setFailedLogo] = useState<string | null>(null);

  return (
    <FocusLayer>
    <Animated.View
      style={[StyleSheet.absoluteFill, { backgroundColor: PAGE_BG, zIndex: 50, elevation: 50, opacity: enter, transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }] }]}
    >
      <FocusScroll ref={scroller} onScroll={onScroll} scrollEventThrottle={32} showsVerticalScrollIndicator={false}>
        <View>
          <Img
            source={{ uri: detail?.backgroundImage || detail?.headerImage || item.largeImage }}
            style={{ position: 'absolute', left: 0, right: 0, top: 0, height: s(272), opacity: 0.45 }}
            contentFit="cover"
          />
          <LinearGradient colors={['rgba(11,18,27,0)', PAGE_BG]} locations={[0.1, 1]} style={{ position: 'absolute', left: 0, right: 0, top: 0, height: s(272) }} />

          <View style={{ maxWidth: s(832), width: '100%', alignSelf: 'center', paddingBottom: s(40) + insets.bottom }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: s(16), paddingHorizontal: s(20) + insets.left, paddingTop: s(64) }}>
              <View style={{ width: s(116), aspectRatio: 2 / 3, borderRadius: s(18), overflow: 'hidden', borderWidth: 1, borderColor: colors.line, backgroundColor: '#152130' }}>
                <Img source={{ uri: coverSource }} style={{ width: '100%', height: '100%' }} contentFit="cover" onError={() => setCoverFailed(true)} />
              </View>
              <View style={{ flex: 1, minWidth: 0, paddingBottom: s(2) }}>
                {logo && logo.url !== failedLogo ? (
                  <Img
                    source={{ uri: logo.url }}
                    accessibilityLabel={name}
                    style={{ width: Math.min(s(288), s(72) * (logo.width / logo.height)), height: Math.min(s(72), s(288) * (logo.height / logo.width)) }}
                    contentFit="contain" contentPosition="left"
                    onError={() => setFailedLogo(logo.url)}
                  />
                ) : (
                  <T size={26} weight="bold" tracking={-0.035} leading={1.05} numberOfLines={2}>{name}</T>
                )}
                {genres.length ? <T size={11.8} weight="medium" color="rgba(255,255,255,0.5)" numberOfLines={1} style={{ marginTop: s(6) }}>{genres.slice(0, 3).join(', ')}</T> : null}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), marginTop: s(12), flexWrap: 'wrap' }}>
                  <BuyButton action={effectiveBuyAction} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                    {item.discounted ? (
                      <View style={{ backgroundColor: colors.accent, borderRadius: s(6), paddingHorizontal: s(6), paddingVertical: s(2) }}>
                        <T size={9.6} weight="bold" color={colors.onAccent} tabular>-{item.discountPercent}%</T>
                      </View>
                    ) : null}
                    <T size={11.8} weight="semibold" tabular color="rgba(255,255,255,0.8)">{priceLabel}</T>
                  </View>
                  <Press
                    onPress={() => void openExternal(storeUrl)}
                    accessibilityLabel="Mở trang Steam trên trình duyệt"
                    style={[styles.navButton, { width: s(36), height: s(36), borderRadius: s(18) }]}
                  >
                    <ArrowUpRight size={s(15)} color="rgba(255,255,255,0.8)" strokeWidth={2} />
                  </Press>
                </View>
              </View>
            </View>

            {loading ? (
              <DetailLoading />
            ) : error ? (
              <View style={{ marginHorizontal: s(20), marginTop: s(24), padding: s(12), borderRadius: s(12), borderWidth: 1, borderColor: 'rgba(254,202,202,0.16)', backgroundColor: 'rgba(69,10,10,0.36)' }}>
                <T size={11.2} weight="semibold" color="#fee2e2">{error}</T>
                <T size={10.2} color="rgba(254,226,226,0.58)" leading={1.5} style={{ marginTop: s(4) }}>Bạn vẫn có thể mua hoặc mở trang Steam bằng các nút phía trên.</T>
              </View>
            ) : view ? (
              <>
                <StatsRow view={view} onShowReviews={() => scroller.current?.scrollTo({ y: Math.max(0, reviewsY.current - s(60)), animated: true })} />
                <LatestNews view={view} />
                <Screenshots view={view} />
                <About view={view} />
                <Reviews view={view} onLayout={(y) => { reviewsY.current = y; }} />
                <Info view={view} />
              </>
            ) : null}
          </View>
        </View>
      </FocusScroll>

      {/* Thanh điều hướng nổi: trong suốt ở đầu trang, thu gọn khi cuộn qua nút chính. */}
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute', left: 0, right: 0, top: 0, height: s(56) + insets.top, paddingTop: insets.top,
          paddingLeft: s(12) + insets.left, paddingRight: s(12) + insets.right,
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: compact ? 'rgba(11,18,27,0.9)' : 'transparent',
          borderBottomWidth: compact ? StyleSheet.hairlineWidth : 0, borderBottomColor: 'rgba(255,255,255,0.08)',
        }}
      >
        <Press onPress={onClose} sound="back" accessibilityLabel="Quay lại cửa hàng" style={[styles.navButton, { width: s(36), height: s(36), borderRadius: s(18) }]}>
          <ChevronLeft size={s(18)} color="rgba(255,255,255,0.86)" strokeWidth={2.2} />
        </Press>
        {compact ? (
          <View style={{ width: s(27), height: s(40), borderRadius: s(6), overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
            <Img source={{ uri: coverSource }} style={{ width: '100%', height: '100%' }} contentFit="cover" />
          </View>
        ) : <View />}
        {compact ? <BuyButton action={effectiveBuyAction} compact /> : (
          <Press
            onPress={() => void openExternal(storeUrl)}
            accessibilityLabel="Mở trang Steam trên trình duyệt"
            style={[styles.navButton, { width: s(36), height: s(36), borderRadius: s(18) }]}
          >
            <ArrowUpRight size={s(16)} color="rgba(255,255,255,0.86)" strokeWidth={2} />
          </Press>
        )}
      </View>

      {sheet && view ? <SheetView sheet={sheet} view={view} onClose={() => setSheet(null)} /> : null}
    </Animated.View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  navButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: 'rgba(10,17,28,0.62)',
  },
});
