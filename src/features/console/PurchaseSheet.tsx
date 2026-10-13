// Bảng "Mua" của Store: tóm tắt giá rồi chuyển việc thanh toán sang Steam client
// trên PC (giao diện chính chủ, xem qua stream). App chỉ theo dõi tới khi game vào
// thư viện rồi mời Tải về — không bao giờ thấy thông tin thẻ hay bấm mua thay.

import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, Pressable, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Check, CircleCheck, Download, ExternalLink, Gift, Lock, MonitorPlay, Play, RefreshCw, ShieldCheck,
  ShoppingCart, TriangleAlert, X,
} from 'lucide-react-native';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { formatStorePrice } from '@/features/library/format';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { openExternal } from '@/lib/open-external';
import {
  type PurchaseOffer, type PurchaseState, type PurchaseTarget, purchaseKind, purchaseSavings, steamWebUrl,
} from '@/lib/steam-purchase';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

const CARD_BG = '#0d1520';
const STEPS = ['Mở Steam trên máy tính', 'Thanh toán trên Steam', 'Tải về máy'] as const;

function money(offer: PurchaseOffer, amount: number | null): string {
  return formatStorePrice({ finalPrice: amount, currency: offer.currency });
}

function usePulse(active: boolean) {
  const value = useState(() => new Animated.Value(1))[0];
  useEffect(() => {
    if (!active) { value.setValue(1); return; }
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 0.3, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(value, { toValue: 1, duration: 700, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [active, value]);
  return value;
}

/** Bước hiện tại trên thanh tiến trình: -1 là chưa bắt đầu. */
function stepIndex(state: PurchaseState): number {
  switch (state.phase) {
    case 'review': return -1;
    case 'opening': case 'failed': return 0;
    case 'checkout': case 'stalled': return 1;
    case 'owned': return 2;
  }
}

function Stepper({ state }: { state: PurchaseState }) {
  const { s } = useUi();
  const current = stepIndex(state);
  const waiting = state.phase === 'opening' || state.phase === 'checkout';
  const pulse = usePulse(waiting);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
      {STEPS.map((label, index) => {
        const done = index < current;
        const active = index === current && state.phase !== 'owned';
        const failed = active && state.phase === 'failed';
        const ready = state.phase === 'owned' && index === 2;
        const tone = failed ? colors.danger : done || active || ready ? colors.accent : 'rgba(255,255,255,0.22)';
        return (
          <View key={label} style={{ flex: 1, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', alignSelf: 'stretch' }}>
              <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: index === 0 ? 'transparent' : index <= current ? colors.accent : 'rgba(255,255,255,0.1)' }} />
              <View style={[styles.dot, { width: s(22), height: s(22), borderRadius: s(11), borderColor: tone }, (done || ready) && { backgroundColor: colors.accent }]}>
                {done ? <Check size={s(12)} color={colors.onAccent} strokeWidth={3} />
                  : ready ? <Download size={s(11)} color={colors.onAccent} strokeWidth={2.6} />
                    : failed ? <X size={s(11)} color={colors.danger} strokeWidth={3} />
                      : active ? <Animated.View style={{ width: s(8), height: s(8), borderRadius: s(4), backgroundColor: colors.accent, opacity: pulse }} />
                        : <T size={9} weight="bold" color="rgba(255,255,255,0.42)" tabular>{index + 1}</T>}
              </View>
              <View style={{ flex: 1, height: 2, borderRadius: 1, backgroundColor: index === STEPS.length - 1 ? 'transparent' : index < current ? colors.accent : 'rgba(255,255,255,0.1)' }} />
            </View>
            <T
              size={9.2}
              weight={active || ready ? 'semibold' : 'medium'}
              color={active || ready ? colors.text : done ? colors.text2 : colors.text4}
              numberOfLines={1}
              style={{ marginTop: s(6) }}
            >
              {label}
            </T>
          </View>
        );
      })}
    </View>
  );
}

function PriceBlock({ offer }: { offer: PurchaseOffer }) {
  const { s } = useUi();
  const kind = purchaseKind(offer);
  const saved = purchaseSavings(offer);
  if (kind === 'free') {
    return (
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <Gift size={s(18)} color={colors.success} strokeWidth={2} />
        <T size={22} weight="bold" tracking={-0.03} color={colors.text}>Miễn phí</T>
      </View>
    );
  }
  if (kind === 'unavailable') {
    return <T size={16} weight="bold" color={colors.text2}>Sắp ra mắt</T>;
  }
  return (
    <View>
      {saved !== null ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8), marginBottom: s(2) }}>
          <View style={{ backgroundColor: colors.accent, borderRadius: s(6), paddingHorizontal: s(6), paddingVertical: s(2) }}>
            <T size={10} weight="bold" color={colors.onAccent} tabular>-{offer.discountPercent}%</T>
          </View>
          <T size={11.4} color={colors.text4} tabular style={{ textDecorationLine: 'line-through' }}>{money(offer, offer.original)}</T>
        </View>
      ) : null}
      <T size={26} weight="bold" tracking={-0.035} tabular>{money(offer, offer.final)}</T>
      {saved !== null ? <T size={10.4} weight="semibold" color={colors.success} tabular style={{ marginTop: s(2) }}>Tiết kiệm {money(offer, saved)}</T> : null}
    </View>
  );
}

function Button({ label, icon, onPress, primary, busy, disabled, autoFocus, sound = 'select' }: {
  label: string; icon?: ReactNode; onPress: () => void; primary?: boolean; busy?: boolean; disabled?: boolean; autoFocus?: boolean;
  sound?: 'select' | 'confirm' | 'back';
}) {
  const { s } = useUi();
  return (
    <Press
      onPress={onPress}
      disabled={disabled || busy}
      autoFocus={autoFocus}
      sound={sound}
      style={[
        primary ? styles.primary : styles.secondary,
        { height: s(40), paddingHorizontal: s(primary ? 20 : 16), borderRadius: s(20), gap: s(7) },
        primary && { flexGrow: 1 },
        disabled && { opacity: 0.45 },
      ]}
    >
      {busy ? <ActivityIndicator size="small" color={primary ? '#0a111c' : colors.text2} /> : icon}
      <T size={11.8} weight={primary ? 'bold' : 'semibold'} color={primary ? '#0a111c' : colors.text2} numberOfLines={1}>{label}</T>
    </Press>
  );
}

/** Ô trạng thái giữa bảng: đang chờ, lỗi, đã mua. */
function StatusPanel({ tone, icon, title, body }: { tone: 'wait' | 'error' | 'success'; icon: ReactNode; title: string; body: string }) {
  const { s } = useUi();
  const palette = tone === 'error'
    ? { border: 'rgba(248,113,113,0.28)', bg: 'rgba(127,29,29,0.28)' }
    : tone === 'success'
      ? { border: 'rgba(74,222,128,0.26)', bg: 'rgba(20,83,45,0.3)' }
      : { border: 'rgba(102,168,255,0.26)', bg: 'rgba(31,111,235,0.12)' };
  return (
    <View style={{ flexDirection: 'row', gap: s(12), padding: s(12), borderRadius: s(14), borderWidth: 1, borderColor: palette.border, backgroundColor: palette.bg }}>
      <View style={{ width: s(28), alignItems: 'center', paddingTop: s(1) }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <T size={12} weight="semibold" color={colors.text}>{title}</T>
        <T size={10.2} color={colors.text3} leading={1.45} style={{ marginTop: s(3) }}>{body}</T>
      </View>
    </View>
  );
}

function SuccessMark() {
  const { s } = useUi();
  const pop = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(pop, { toValue: 1, stiffness: 260, damping: 14, mass: 0.7, useNativeDriver: true }).start();
  }, [pop]);
  return (
    <Animated.View style={{ opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }] }}>
      <CircleCheck size={s(24)} color={colors.success} strokeWidth={2.2} />
    </Animated.View>
  );
}

function WaitingMark() {
  const { s } = useUi();
  const pulse = usePulse(true);
  return (
    <View style={{ width: s(24), height: s(24), alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', width: s(24), height: s(24), borderRadius: s(12), backgroundColor: colors.accent, opacity: pulse.interpolate({ inputRange: [0.3, 1], outputRange: [0.08, 0.28] }) }} />
      <View style={{ width: s(9), height: s(9), borderRadius: s(5), backgroundColor: colors.accent }} />
    </View>
  );
}

export function PurchaseSheet({
  state, installing, notice, onCheckout, onOpenStream, onInstall, onPlay, onRecheck, onBack, onClose,
}: {
  state: PurchaseState;
  installing: boolean;
  /** Lý do lượt cài sau khi mua chưa bắt đầu được. */
  notice: string | null;
  onCheckout: (target: PurchaseTarget) => void;
  onOpenStream: () => void;
  onInstall: () => void;
  onPlay: () => void;
  onRecheck: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const { s, width, height } = useUi();
  const { offer, phase } = state;
  const kind = purchaseKind(offer);
  const enter = useState(() => new Animated.Value(0))[0];
  useBack(() => { onClose(); });
  useEffect(() => {
    Animated.timing(enter, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enter]);

  const cardWidth = Math.min(s(680), width - s(48));
  const artWidth = cardWidth >= s(560) ? s(196) : 0;
  const checkoutLabel = kind === 'free' ? 'Nhận trên Steam' : `Thanh toán · ${money(offer, offer.final)}`;

  let status: ReactNode = null;
  let actions: ReactNode;
  switch (phase) {
    case 'review':
    case 'opening':
      status = (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(10), paddingVertical: s(10), borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line }}>
          <ShieldCheck size={s(18)} color={colors.accent} strokeWidth={2} />
          <View style={{ flex: 1 }}>
            <T size={11.2} weight="semibold" color={colors.text}>Thanh toán trên giao diện chính chủ của Steam</T>
            <T size={9.8} color={colors.text3} leading={1.4} style={{ marginTop: s(2) }}>
              Steam mở trên máy tính và hiện ngay trong app. Bạn chọn phương thức và xác nhận ở đó — Jetsona không lưu và không thấy thông tin thanh toán.
            </T>
          </View>
        </View>
      );
      actions = (
        <>
          <Button
            label="Giỏ hàng"
            icon={<ShoppingCart size={s(15)} color={colors.text2} strokeWidth={2} />}
            onPress={() => onCheckout('cart')}
            disabled={phase === 'opening' || kind === 'unavailable'}
          />
          <Button
            primary
            autoFocus
            sound="confirm"
            label={phase === 'opening' ? 'Đang mở Steam…' : kind === 'unavailable' ? 'Chưa mở bán' : checkoutLabel}
            icon={<Lock size={s(14)} color="#0a111c" strokeWidth={2.4} />}
            busy={phase === 'opening'}
            disabled={kind === 'unavailable'}
            onPress={() => onCheckout('store')}
          />
        </>
      );
      break;
    case 'checkout':
      status = (
        <StatusPanel
          tone="wait"
          icon={<WaitingMark />}
          title="Đang chờ Steam xác nhận thanh toán"
          body={state.target === 'cart'
            ? 'Giỏ hàng Steam đã mở trên máy tính. Hoàn tất thanh toán ở đó — app tự nhận ra khi game vào thư viện.'
            : 'Trang game đã mở trong Steam trên máy tính. Bấm Thêm vào giỏ → Mua cho bản thân → xác nhận. App tự nhận ra khi game vào thư viện.'}
        />
      );
      actions = (
        <>
          <Button label="Ẩn" onPress={onClose} sound="back" />
          <Button primary autoFocus label="Mở màn hình máy tính" icon={<MonitorPlay size={s(15)} color="#0a111c" strokeWidth={2.2} />} onPress={onOpenStream} />
        </>
      );
      break;
    case 'stalled':
      status = (
        <StatusPanel
          tone="wait"
          icon={<RefreshCw size={s(18)} color={colors.accent} strokeWidth={2} />}
          title="Chưa thấy giao dịch"
          body="Steam chưa báo game này vào thư viện. Nếu bạn vừa thanh toán xong, kiểm tra lại sau ít giây."
        />
      );
      actions = (
        <>
          <Button label="Quay lại" onPress={onBack} sound="back" />
          <Button label="Màn hình máy tính" icon={<MonitorPlay size={s(15)} color={colors.text2} strokeWidth={2} />} onPress={onOpenStream} />
          <Button primary autoFocus label="Kiểm tra lại" icon={<RefreshCw size={s(14)} color="#0a111c" strokeWidth={2.4} />} onPress={onRecheck} />
        </>
      );
      break;
    case 'failed':
      status = (
        <StatusPanel
          tone="error"
          icon={<TriangleAlert size={s(18)} color={colors.danger} strokeWidth={2} />}
          title={state.error || 'Không mở được Steam trên máy tính.'}
          body="Kiểm tra máy tính đã bật và Steam đã đăng nhập, rồi thử lại. Bạn cũng có thể mua trên trình duyệt."
        />
      );
      actions = (
        <>
          <Button
            label="Trình duyệt"
            icon={<ExternalLink size={s(14)} color={colors.text2} strokeWidth={2} />}
            onPress={() => void openExternal(steamWebUrl(offer.appId, state.target))}
          />
          <Button primary autoFocus label="Thử lại" icon={<RefreshCw size={s(14)} color="#0a111c" strokeWidth={2.4} />} onPress={onBack} />
        </>
      );
      break;
    case 'owned':
      status = (
        <StatusPanel
          tone="success"
          icon={<SuccessMark />}
          title={state.installed ? 'Đã có trên máy tính' : 'Đã thêm vào thư viện Steam'}
          body={state.installed ? 'Trò chơi đã được cài, sẵn sàng để chơi.' : 'Tải về máy tính ngay để chơi — bạn chọn ổ đĩa ngay trong app.'}
        />
      );
      actions = (
        <>
          <Button label="Để sau" onPress={onClose} sound="back" />
          {state.installed ? (
            <Button primary autoFocus sound="confirm" label="Chơi ngay" icon={<Play size={s(14)} color="#0a111c" fill="#0a111c" />} onPress={onPlay} />
          ) : (
            <Button primary autoFocus sound="confirm" label={installing ? 'Đang mở Steam…' : 'Tải về máy'} busy={installing} icon={<Download size={s(15)} color="#0a111c" strokeWidth={2.4} />} onPress={onInstall} />
          )}
        </>
      );
      break;
  }

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 70, elevation: 70 }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,14,0.76)' }]} onPress={() => { playUiSound('back'); onClose(); }} />
        <Animated.View
          style={[
            styles.card,
            {
              width: cardWidth, maxHeight: height - s(24), borderRadius: s(24),
              opacity: enter,
              transform: [{ translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }, { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.98, 1] }) }],
            },
          ]}
        >
          {artWidth ? (
            <View style={{ width: artWidth, alignSelf: 'stretch', backgroundColor: '#152130' }}>
              {offer.imageUrl ? <Img source={{ uri: offer.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
              <LinearGradient colors={['rgba(13,21,32,0)', 'rgba(13,21,32,0.15)', CARD_BG]} locations={[0, 0.6, 1]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
              <LinearGradient colors={['rgba(13,21,32,0)', 'rgba(13,21,32,0.85)']} locations={[0.55, 1]} style={StyleSheet.absoluteFill} />
              <View style={[styles.steamTag, { left: s(12), bottom: s(12), paddingHorizontal: s(8), paddingVertical: s(4), borderRadius: s(8), gap: s(5) }]}>
                <ShieldCheck size={s(11)} color={colors.text2} strokeWidth={2.2} />
                <T size={8.8} weight="semibold" color={colors.text2} tracking={0.04}>STEAM</T>
              </View>
            </View>
          ) : null}

          <View style={{ flex: 1, padding: s(20), paddingTop: s(18), gap: s(14) }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: s(12) }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={9.2} weight="semibold" color={colors.text3} tracking={0.08}>{phase === 'owned' ? 'ĐÃ SỞ HỮU' : kind === 'free' ? 'NHẬN MIỄN PHÍ' : 'MUA TRÒ CHƠI'}</T>
                <T size={17} weight="bold" tracking={-0.02} numberOfLines={2} style={{ marginTop: s(3) }}>{offer.name}</T>
              </View>
              <Press onPress={onClose} sound="back" accessibilityLabel="Đóng" style={[styles.close, { width: s(30), height: s(30), borderRadius: s(15) }]}>
                <X size={s(14)} color={colors.text3} />
              </Press>
            </View>

            {phase !== 'owned' ? <PriceBlock offer={offer} /> : null}
            <Stepper state={state} />
            {status}
            {notice && phase === 'owned' ? <T size={10} color="#fecaca" leading={1.4}>{notice}</T> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(10) }}>{actions}</View>
          </View>
        </Animated.View>
      </View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: CARD_BG,
  },
  close: { alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  dot: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, backgroundColor: CARD_BG },
  steamTag: { position: 'absolute', flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(5,8,13,0.62)', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
  secondary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong },
});
