// Shared dark settings controls: quiet grouped surfaces, inset separators,
// and section headings spaced clear of the rounded card edges.

import Slider from '@react-native-community/slider';
import React, { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Easing, StyleSheet, View } from 'react-native';
import { Check, ChevronRight, Loader, type LucideIcon } from 'lucide-react-native';

import { useFocusable } from '@/features/gamepad/focus';
import { playUiSound, type UiSound } from '@/features/sound/UiSoundProvider';
import { alpha, useTheme } from '@/theme';
import { FocusRing } from '@/ui/FocusRing';
import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { SettingsDisclosure } from './SettingsDisclosure';
import { SETTINGS_LAYOUT, useSettingsColors } from './SettingsSurface';

export function SettingsGroup({
  title,
  footer,
  children,
}: {
  title?: string;
  footer?: string;
  children: ReactNode;
}) {
  const appleColors = useSettingsColors();
  const { s } = useUi();
  const rawItems = React.Children.toArray(children);
  const items = rawItems.filter(Boolean);
  if (!items.length) return null;

  return (
    <View style={{ marginTop: SETTINGS_LAYOUT.sectionSpacing }}>
      {title ? (
        <T
          size={11.2}
          weight="semibold"
          color={appleColors.textSecondary}
          leading={1.5}
          accessibilityRole="header"
          tracking={0.06}
          style={{ marginBottom: s(8), paddingHorizontal: s(16) }}
        >
          {title.toLocaleUpperCase('vi')}
        </T>
      ) : null}

      <View
        style={{
          backgroundColor: appleColors.card,
          borderRadius: SETTINGS_LAYOUT.radius,
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: appleColors.cardBorder,
          overflow: 'hidden',
        }}
      >
        {items.map((child, index) => (
          <View key={index}>
            {index > 0 ? (
              <View
                style={{
                  height: StyleSheet.hairlineWidth,
                  backgroundColor: appleColors.separator,
                  marginHorizontal: s(16),
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
          leading={1.5}
          style={{ marginTop: s(8), paddingHorizontal: s(16) }}
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
  labelColor,
}: {
  label: ReactNode;
  detail?: ReactNode;
  labelColor?: string;
}) {
  const appleColors = useSettingsColors();
  const { s } = useUi();
  return (
    <View style={{ flex: 1, minWidth: 0, justifyContent: 'center' }}>
      {typeof label === 'string' ? (
        <T size={13.2} weight="regular" color={labelColor ?? appleColors.text}>
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
    minHeight: SETTINGS_LAYOUT.rowHeight,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: s(10),
    paddingHorizontal: s(16),
    paddingVertical: s(8),
    backgroundColor: 'transparent',
    ...extra,
  };
}

/**
 * Compact switch using the current settings accent and device motion preference.
 */
export function Switch({ checked }: { checked: boolean }) {
  const appleColors = useSettingsColors();
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [slide] = useState(() => new Animated.Value(checked ? 1 : 0));

  useEffect(() => {
    const animation = Animated.timing(slide, {
      toValue: checked ? 1 : 0,
      duration: reduceMotion ? 0 : 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
      isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [checked, reduceMotion, slide]);

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
        backgroundColor: appleColors.switchOff,
        justifyContent: 'center',
        paddingHorizontal: thumbPadding,
      }}
    >
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, {
          borderRadius: trackHeight / 2,
          backgroundColor: appleColors.accent,
          opacity: slide,
        }]}
      />
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
          shadowOpacity: 0.16,
          shadowRadius: 2,
          elevation: 1,
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
      focusVariant="row"
      accessibilityRole="switch"
      accessibilityLabel={label}
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

/** Inline choices share the active accent and a short expand/collapse transition. */
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
  const appleColors = useSettingsColors();
  const { s } = useUi();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value) ?? options[0];

  return (
    <View>
      <Press
        onPress={() => setOpen((current) => !current)}
        pressScale={0.995}
        focusVariant="row"
        accessibilityState={{ expanded: open }}
        style={rowStyle(s)}
      >
        <RowText label={label} />
        <View style={{ maxWidth: '52%', flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <T size={12.6} color={appleColors.textTertiary} style={{ flexShrink: 1, textAlign: 'right' }}>
            {selected?.label}
          </T>
          <ChevronRight
            size={s(15)}
            color={appleColors.chevron}
            style={{ transform: [{ rotate: open ? '90deg' : '0deg' }] }}
          />
        </View>
      </Press>
      <SettingsDisclosure open={open}>
        <View
          style={{
            backgroundColor: appleColors.inset,
            borderTopWidth: StyleSheet.hairlineWidth,
            borderTopColor: appleColors.separator,
          }}
        >
          {options.map((option, idx) => {
            const active = option.value === value;
            return (
              <View key={option.value}>
                {idx ? (
                  <View
                    style={{
                      height: StyleSheet.hairlineWidth,
                      backgroundColor: appleColors.separator,
                      marginLeft: s(16),
                    }}
                  />
                ) : null}
                <Press
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  pressScale={0.995}
                  focusVariant="row"
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  focusable={open}
                  style={{
                    minHeight: s(44),
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: s(12),
                    paddingHorizontal: s(14),
                    paddingVertical: s(6),
                    marginHorizontal: s(6),
                    marginVertical: s(1.5),
                    borderRadius: s(9),
                    backgroundColor: active ? appleColors.selectedBg : 'transparent',
                    borderWidth: 1,
                    borderColor: active ? appleColors.selectedBorder : 'transparent',
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <T
                      size={12.6}
                      weight={active ? 'semibold' : 'regular'}
                      color={active ? appleColors.selectedText : appleColors.text}
                    >
                      {option.label}
                    </T>
                    {option.description ? (
                      <T size={10.2} color={appleColors.textTertiary} leading={1.35}>
                        {option.description}
                      </T>
                    ) : null}
                  </View>
                  {active ? <Check size={s(16)} color={appleColors.accent} strokeWidth={2.6} /> : null}
                </Press>
              </View>
            );
          })}
        </View>
      </SettingsDisclosure>
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
  const appleColors = useSettingsColors();
  const { s, width } = useUi();
  const [previousValue, setPreviousValue] = useState(value);
  const [local, setLocal] = useState(value);
  if (previousValue !== value) {
    setPreviousValue(value);
    setLocal(value);
  }

  const hostRef = useRef<View>(null);
  const localRef = useRef(local);
  useLayoutEffect(() => { localRef.current = local; }, [local]);
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
      {focused ? <FocusRing radius={0} variant="row" /> : null}
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
          minimumTrackTintColor={appleColors.accent}
          maximumTrackTintColor={appleColors.cardBorder}
          thumbTintColor="#FFFFFF"
          onValueChange={setLocal}
          onSlidingComplete={onChange}
          accessibilityLabel={label}
        />
        <View
          style={{
            minWidth: s(54),
            paddingHorizontal: s(6),
            paddingVertical: s(3),
            borderRadius: s(6),
            backgroundColor: 'rgba(255, 255, 255, 0.08)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <T
            size={11}
            weight="semibold"
            color="rgba(255, 255, 255, 0.9)"
            tabular
          >
            {format(local)}
          </T>
        </View>
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
  const appleColors = useSettingsColors();
  const { s } = useUi();
  const { reduceMotion } = useMotion();

  const bg =
    iconBg ??
    (tone === 'accent'
      ? appleColors.blue
      : tone === 'danger'
        ? appleColors.red
        : '#8E8E93');
  const fg = iconColor ?? bg;
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
      accessibilityState={{ busy }}
      pressScale={0.995}
      focusVariant="row"
      style={rowStyle(s, { opacity: disabled ? 0.4 : 1 })}
    >
      {Icon ? (
        <View
          style={{
            width: s(24),
            height: s(24),
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon size={s(17)} color={fg} strokeWidth={1.8} />
        </View>
      ) : null}
      <RowText label={label} detail={detail} labelColor={labelColor} />
      {busy ? reduceMotion ? <Loader size={s(16)} color={appleColors.accent} />
        : <ActivityIndicator size="small" color={appleColors.accent} />
        : trailing ?? <ChevronRight size={s(15)} color={appleColors.chevron} />}
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
  const appleColors = useSettingsColors();
  const { s } = useUi();
  return (
    <View style={rowStyle(s)}>
      <RowText label={label} detail={detail} />
      <View style={{ maxWidth: '54%', flexShrink: 1, alignItems: 'flex-end' }}>
        {typeof value === 'string' ? (
          <T size={12.4} color={appleColors.textTertiary} style={{ textAlign: 'right' }}>
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
  const appleColors = useSettingsColors();
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
  const { colors } = useTheme();
  const appleColors = useSettingsColors();
  const { s } = useUi();
  return (
    <View
      style={{
        height: s(24),
        minWidth: s(24),
        paddingHorizontal: s(7),
        borderRadius: s(6),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: accent ? alpha(colors.accent, 0.45) : 'rgba(255, 255, 255, 0.18)',
        backgroundColor: accent ? alpha(colors.primary, 0.22) : 'rgba(255, 255, 255, 0.08)',
        overflow: 'visible',
      }}
    >
      <T
        size={10.2}
        weight="semibold"
        color={accent ? colors.accentSoft : appleColors.text}
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
  const { colors } = useTheme();
  const { s } = useUi();
  const bg =
    tone === 'danger'
      ? 'rgba(239, 68, 68, 0.18)'
      : tone === 'accent'
        ? alpha(colors.primary, 0.28)
        : 'rgba(255, 255, 255, 0.08)';
  const border =
    tone === 'danger'
      ? 'rgba(248, 113, 113, 0.40)'
      : tone === 'accent'
        ? alpha(colors.accent, 0.45)
        : 'rgba(255, 255, 255, 0.14)';
  const fg =
    tone === 'danger'
      ? '#fca5a5'
      : tone === 'accent'
        ? '#FFFFFF'
        : 'rgba(255, 255, 255, 0.90)';

  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      pressScale={0.97}
      style={{
        minHeight: s(44),
        paddingHorizontal: s(12),
        borderRadius: s(8),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(5),
        backgroundColor: bg,
        borderWidth: 1,
        borderColor: border,
        opacity: disabled ? 0.4 : 1,
        overflow: 'visible',
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
