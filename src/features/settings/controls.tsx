// Hàng cài đặt theo ngôn ngữ thiết kế của Apple (iOS / iPadOS Settings):
// Card nhóm Inset Grouped bo tròn viền trắng, công tắc UISwitch xanh lá cây (#34C759),
// đường phân cách thụt lề, font chữ chuẩn SF Pro / Inter với nhãn đen (#000000) và
// chi tiết màu xám (#8E8E93 / #6D6D72), dấu tích xanh (#007AFF) và mũi tên xám (#C7C7CC).

import Slider from '@react-native-community/slider';
import React, { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Check, ChevronDown, ChevronRight, Loader, type LucideIcon } from 'lucide-react-native';

import { useFocusable } from '@/features/gamepad/focus';
import { playUiSound, type UiSound } from '@/features/sound/UiSoundProvider';
import { FocusRing } from '@/ui/FocusRing';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export const appleColors = {
  // Nền & khung
  bg: '#080c12',             // Nền chính Console (#080c12 đồng bộ với toàn app)
  sidebarBg: 'rgba(10, 16, 26, 0.75)',      // Nền sidebar Console glass
  card: 'rgba(255, 255, 255, 0.045)',       // Nền card liquid glass
  cardBorder: 'rgba(255, 255, 255, 0.12)',     // Viền card tinh gọn
  separator: 'rgba(255, 255, 255, 0.07)',      // Đường kẻ phân cách giữa các hàng
  pressedBg: 'rgba(255, 255, 255, 0.08)',      // Màu phản hồi khi chạm hàng
  cardRaised: 'rgba(24, 32, 44, 0.7)',     // Nền nhóm phụ hoặc dropdown inline

  // Văn bản
  text: 'rgba(255, 255, 255, 0.95)',          // Nhãn chính màu trắng sáng
  textSecondary: 'rgba(255, 255, 255, 0.65)', // Tiêu đề nhóm, chú thích dưới card
  textTertiary: 'rgba(255, 255, 255, 0.45)',  // Giá trị bên phải, phụ đề mờ
  chevron: 'rgba(255, 255, 255, 0.35)',       // Mũi tên điều hướng phụ

  // Màu hệ thống
  blue: '#1f6feb',           // Nút, hàng chọn, dấu tích
  green: '#34c759',          // Công tắc bật (UISwitch), chấm online
  red: '#ff453a',            // Hành động xóa, cảnh báo lỗi
  orange: '#ff9f0a',         // Cảnh báo, pin yếu, icon khôi phục
  yellow: '#ffd60a',
  purple: '#bf5af2',
  indigo: '#5e5ce6',
  teal: '#40c8e0',
  pink: '#ff375f',
  gray: '#8e8e93',
  switchOff: 'rgba(255, 255, 255, 0.16)',     // Nền công tắc khi tắt
} as const;

export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const { s } = useUi();
  const rawItems = React.Children.toArray(children);
  const items = rawItems.filter(Boolean);
  if (!items.length) return null;

  return (
    <View style={{ marginTop: s(18) }}>
      {title ? (
        <T
          size={10.4}
          weight="semibold"
          color={appleColors.textSecondary}
          tracking={0.06}
          style={{ marginBottom: s(6), paddingHorizontal: s(16) }}
        >
          {title.toUpperCase()}
        </T>
      ) : null}

      <View
        style={{
          backgroundColor: appleColors.card,
          borderRadius: s(16),
          borderWidth: 1,
          borderColor: appleColors.cardBorder,
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.2,
          shadowRadius: 10,
          elevation: 2,
        }}
      >
        {/* Specular top rim highlight */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: StyleSheet.hairlineWidth,
            backgroundColor: 'rgba(255, 255, 255, 0.18)',
          }}
          pointerEvents="none"
        />

        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: appleColors.separator,
                  marginLeft: s(16),
                }}
              />
            ) : null}
            {child}
          </View>
        ))}
      </View>

      {footer ? (
        <T
          size={10.4}
          color={appleColors.textSecondary}
          leading={1.38}
          style={{ marginTop: s(6), paddingHorizontal: s(16) }}
        >
          {footer}
        </T>
      ) : null}
    </View>
  );
}

export function RowText({
  label,
  detail,
  labelColor = appleColors.text,
}: {
  label: ReactNode;
  detail?: ReactNode;
  labelColor?: string;
}) {
  const { s } = useUi();
  return (
    <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
      {typeof label === 'string' ? (
        <T size={13.2} weight="regular" color={labelColor} numberOfLines={1}>
          {label}
        </T>
      ) : (
        label
      )}
      {detail ? (
        <T
          size={10.6}
          color={appleColors.textTertiary}
          leading={1.35}
          style={{ marginTop: s(1.5) }}
        >
          {detail}
        </T>
      ) : null}
    </View>
  );
}

export function rowStyle(s: (n: number) => number, extra?: object) {
  return {
    minHeight: s(46),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: s(12),
    paddingHorizontal: s(16),
    paddingVertical: s(8),
    backgroundColor: 'transparent',
    ...extra,
  };
}

/**
 * Công tắc UISwitch chuẩn Apple (như được khoanh đỏ trong ảnh mẫu):
 * - Rộng 46dp, cao 26dp, bo tròn dạng viên thuốc.
 * - Bật: xanh lá Apple #34C759 với viền sáng và đổ bóng dịu.
 * - Tắt: xám mờ Apple.
 * - Nút tròn trắng tinh, đổ bóng chuẩn iOS.
 */
export function Switch({ checked }: { checked: boolean }) {
  const { s } = useUi();
  const [slide] = useState(() => new Animated.Value(checked ? 1 : 0));

  useEffect(() => {
    Animated.timing(slide, {
      toValue: checked ? 1 : 0,
      duration: 180,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [checked, slide]);

  const trackWidth = s(46);
  const trackHeight = s(27);
  const thumbSize = s(23);
  const thumbPadding = s(2);
  const thumbTravel = trackWidth - thumbSize - thumbPadding * 2;

  return (
    <Animated.View
      style={{
        width: trackWidth,
        height: trackHeight,
        borderRadius: trackHeight / 2,
        backgroundColor: slide.interpolate({
          inputRange: [0, 1],
          outputRange: [appleColors.switchOff, appleColors.green],
        }),
        justifyContent: 'center',
        paddingHorizontal: thumbPadding,
        shadowColor: '#34c759',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: checked ? 0.4 : 0,
        shadowRadius: 6,
        elevation: checked ? 3 : 0,
      }}
    >
      <Animated.View
        style={{
          width: thumbSize,
          height: thumbSize,
          borderRadius: thumbSize / 2,
          backgroundColor: '#FFFFFF',
          transform: [
            {
              translateX: slide.interpolate({
                inputRange: [0, 1],
                outputRange: [0, thumbTravel],
              }),
            },
          ],
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3,
          elevation: 2,
        }}
      />
    </Animated.View>
  );
}

export function ToggleRow({
  label,
  detail,
  checked,
  onChange,
}: {
  label: string;
  detail?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  const { s } = useUi();
  return (
    <Press
      onPress={() => onChange(!checked)}
      pressScale={0.995}
      accessibilityRole="switch"
      accessibilityState={{ checked }}
      style={rowStyle(s)}
    >
      <RowText label={label} detail={detail} />
      <Switch checked={checked} />
    </Press>
  );
}

export type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  description?: string;
};

/** Hàng lựa chọn kiểu iOS: bấm để mở danh sách dạng inline với dấu tích xanh #007AFF. */
export function ChoiceRow<V extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: V;
  options: ChoiceOption<V>[];
  onChange: (value: V) => void;
}) {
  const { s } = useUi();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <View>
      <Press
        onPress={() => setOpen((current) => !current)}
        pressScale={0.995}
        accessibilityState={{ expanded: open }}
        style={rowStyle(s)}
      >
        <RowText label={label} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <T size={12.6} color={appleColors.textTertiary}>
            {selected?.label}
          </T>
          <ChevronRight
            size={s(15)}
            color={appleColors.chevron}
            style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
          />
        </View>
      </Press>
      {open ? (
        <View style={{ backgroundColor: '#0c121a', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: appleColors.separator }}>
          {options.map((option, idx) => {
            const active = option.value === value;
            return (
              <Press
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                pressScale={0.995}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={{
                  minHeight: s(42),
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: s(12),
                  paddingLeft: s(24),
                  paddingRight: s(16),
                  paddingVertical: s(7),
                  borderTopWidth: idx ? StyleSheet.hairlineWidth : 0,
                  borderTopColor: appleColors.separator,
                }}
              >
                <View style={{ flex: 1 }}>
                  <T
                    size={12.6}
                    weight={active ? 'semibold' : 'regular'}
                    color={appleColors.text}
                  >
                    {option.label}
                  </T>
                  {option.description ? (
                    <T size={10.2} color={appleColors.textTertiary} leading={1.35}>
                      {option.description}
                    </T>
                  ) : null}
                </View>
                {active ? <Check size={s(16)} color={appleColors.blue} strokeWidth={2.4} /> : null}
              </Press>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

export function SliderRow({
  label,
  detail,
  value,
  min,
  max,
  step,
  format,
  onChange,
}: {
  label: string;
  detail?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  format: (value: number) => string;
  onChange: (value: number) => void;
}) {
  const { s, width } = useUi();
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  const hostRef = useRef<View>(null);
  const localRef = useRef(local);
  localRef.current = local;
  const commit = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(commit.current), []);

  const focused = useFocusable({
    ref: hostRef,
    onPress: () => {},
    adjust: (direction) => {
      const unit = Math.max(step, Math.round((max - min) / 20 / step) * step);
      const next = Math.min(max, Math.max(min, localRef.current + direction * unit));
      localRef.current = next;
      setLocal(next);
      playUiSound('focus');
      clearTimeout(commit.current);
      commit.current = setTimeout(() => onChange(next), 350);
      return true;
    },
  });

  return (
    <View ref={hostRef} style={rowStyle(s)}>
      {focused ? <FocusRing radius={s(8)} variant="row" /> : null}
      <RowText label={label} detail={detail} />
      <View
        style={{
          width: Math.min(s(224), width * 0.3),
          flexDirection: 'row',
          alignItems: 'center',
          gap: s(8),
        }}
      >
        <Slider
          style={{ flex: 1, height: s(40) }}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={local}
          minimumTrackTintColor={appleColors.blue}
          maximumTrackTintColor={appleColors.cardBorder}
          thumbTintColor="#FFFFFF"
          onValueChange={setLocal}
          onSlidingComplete={onChange}
          accessibilityLabel={label}
        />
        <T
          size={11.4}
          weight="medium"
          color={appleColors.textTertiary}
          tabular
          style={{ width: s(52), textAlign: 'right' }}
        >
          {format(local)}
        </T>
      </View>
    </View>
  );
}

export function ActionRow({
  icon: Icon,
  label,
  detail,
  onPress,
  disabled = false,
  busy = false,
  tone = 'default',
  trailing,
  iconBg,
  iconColor,
  sound,
}: {
  icon?: LucideIcon;
  label: string;
  detail?: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'default' | 'accent' | 'danger';
  trailing?: ReactNode;
  iconBg?: string;
  iconColor?: string;
  sound?: UiSound | false;
}) {
  const { s } = useUi();
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!busy) return;
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 900,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
    loop.start();
    return () => loop.stop();
  }, [busy, spin]);

  const bg =
    iconBg ??
    (tone === 'accent'
      ? appleColors.blue
      : tone === 'danger'
        ? appleColors.red
        : '#8E8E93');
  const fg = iconColor ?? '#FFFFFF';
  const labelColor =
    tone === 'danger'
      ? appleColors.red
      : tone === 'accent'
        ? appleColors.blue
        : appleColors.text;

  return (
    <Press
      onPress={onPress}
      sound={sound}
      disabled={disabled || busy}
      pressScale={0.995}
      style={rowStyle(s, { opacity: disabled ? 0.4 : 1 })}
    >
      {Icon ? (
        <View
          style={{
            width: s(28),
            height: s(28),
            borderRadius: s(7),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: bg,
          }}
        >
          {busy ? (
            <Animated.View
              style={{
                transform: [
                  {
                    rotate: spin.interpolate({
                      inputRange: [0, 1],
                      outputRange: ['0deg', '360deg'],
                    }),
                  },
                ],
              }}
            >
              <Loader size={s(15)} color={fg} />
            </Animated.View>
          ) : (
            <Icon size={s(15)} color={fg} strokeWidth={2.2} />
          )}
        </View>
      ) : null}
      <RowText label={label} detail={detail} labelColor={labelColor} />
      {trailing ?? <ChevronRight size={s(15)} color={appleColors.chevron} />}
    </Press>
  );
}

export function InfoRow({
  label,
  detail,
  value,
}: {
  label: string;
  detail?: string;
  value: ReactNode;
}) {
  const { s } = useUi();
  return (
    <View style={rowStyle(s)}>
      <RowText label={label} detail={detail} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        {typeof value === 'string' ? (
          <T size={12.4} color={appleColors.textTertiary}>
            {value}
          </T>
        ) : (
          value
        )}
      </View>
    </View>
  );
}

/** Hành động hai nhịp chuẩn Apple: chạm lần đầu cảnh báo chữ đỏ, chạm lần hai xác nhận. */
export function ConfirmActionRow({
  icon,
  label,
  confirmLabel,
  detail,
  onConfirm,
  disabled,
  busy,
  tone = 'default',
  iconBg,
  iconColor,
}: {
  icon: LucideIcon;
  label: string;
  confirmLabel: string;
  detail?: string;
  onConfirm: () => void;
  disabled?: boolean;
  busy?: boolean;
  tone?: 'default' | 'danger';
  iconBg?: string;
  iconColor?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <ActionRow
      icon={icon}
      sound={armed ? 'confirm' : 'select'}
      iconBg={armed ? appleColors.red : (iconBg ?? appleColors.orange)}
      iconColor={iconColor ?? '#FFFFFF'}
      tone={armed ? 'danger' : tone}
      label={armed ? confirmLabel : label}
      detail={armed ? 'Bấm lần nữa để xác nhận' : detail}
      disabled={disabled}
      busy={busy}
      onPress={() => {
        if (!armed) {
          setArmed(true);
          return;
        }
        setArmed(false);
        onConfirm();
      }}
    />
  );
}

export function Keycap({
  children,
  accent = false,
}: {
  children: ReactNode;
  accent?: boolean;
}) {
  const { s } = useUi();
  return (
    <View
      style={{
        height: s(24),
        minWidth: s(24),
        paddingHorizontal: s(6),
        borderRadius: s(5),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: accent ? appleColors.blue : 'rgba(255, 255, 255, 0.15)',
        backgroundColor: accent ? 'rgba(31, 111, 235, 0.2)' : 'rgba(255, 255, 255, 0.08)',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 1,
        elevation: 1,
      }}
    >
      <T
        size={10.2}
        weight="semibold"
        color={accent ? appleColors.blue : appleColors.text}
      >
        {children}
      </T>
    </View>
  );
}

export function PillButton({
  children,
  onPress,
  tone = 'default',
  disabled = false,
  label,
}: {
  children: ReactNode;
  onPress: () => void;
  tone?: 'default' | 'danger' | 'accent';
  disabled?: boolean;
  label?: string;
}) {
  const { s } = useUi();
  const bg =
    tone === 'danger'
      ? 'rgba(255, 69, 58, 0.15)'
      : tone === 'accent'
        ? appleColors.blue
        : 'rgba(255, 255, 255, 0.08)';
  const fg =
    tone === 'danger'
      ? appleColors.red
      : tone === 'accent'
        ? '#FFFFFF'
        : 'rgba(255, 255, 255, 0.85)';

  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={{
        height: s(28),
        paddingHorizontal: s(12),
        borderRadius: s(14),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(5),
        backgroundColor: bg,
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {typeof children === 'string' ? (
        <T size={10.4} weight="semibold" color={fg}>
          {children}
        </T>
      ) : (
        children
      )}
    </Press>
  );
}
