// Hàng cài đặt kiểu console: nhãn bên trái, giá trị hoặc điều khiển bên phải,
// một đường kẻ mảnh giữa các hàng. Mỗi hàng là một vùng chạm trọn chiều ngang.
// Bản native của components/settings/controls.tsx.

import Slider from '@react-native-community/slider';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { Check, ChevronDown, ChevronRight, Loader, type LucideIcon } from 'lucide-react-native';

import { useFocusable } from '@/features/gamepad/focus';
import { playUiSound, type UiSound } from '@/features/sound/UiSoundProvider';
import { colors } from '@/theme';
import { FocusRing } from '@/ui/FocusRing';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export function SettingsGroup({ title, children }: { title?: string; children: ReactNode }) {
  const { s } = useUi();
  const items = Array.isArray(children) ? children.filter(Boolean) : [children];
  return (
    <View style={{ marginTop: s(20) }}>
      {title ? (
        <T size={9.6} weight="semibold" color={colors.text4} tracking={0.16} style={{ marginBottom: s(4), paddingHorizontal: s(12) }}>
          {title.toUpperCase()}
        </T>
      ) : null}
      <View>
        {items.map((child, index) => (
          <View key={index} style={index ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(255,255,255,0.07)' } : undefined}>
            {child}
          </View>
        ))}
      </View>
    </View>
  );
}

export function RowText({ label, detail }: { label: ReactNode; detail?: ReactNode }) {
  const { s } = useUi();
  return (
    <View style={{ flex: 1, minWidth: 0 }}>
      <T size={12.8} color="rgba(255,255,255,0.9)" numberOfLines={1}>{label}</T>
      {detail ? <T size={10.2} color={colors.text3} leading={1.4} style={{ marginTop: s(2) }}>{detail}</T> : null}
    </View>
  );
}

function rowStyle(s: (n: number) => number, extra?: object) {
  return { minHeight: s(50), flexDirection: 'row' as const, alignItems: 'center' as const, gap: s(16), paddingHorizontal: s(12), paddingVertical: s(8), borderRadius: s(8), ...extra };
}

export function Switch({ checked }: { checked: boolean }) {
  const { s } = useUi();
  const slide = useRef(new Animated.Value(checked ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(slide, { toValue: checked ? 1 : 0, duration: 160, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
  }, [checked, slide]);
  return (
    <Animated.View
      style={{
        width: s(40), height: s(24), borderRadius: s(12),
        backgroundColor: slide.interpolate({ inputRange: [0, 1], outputRange: ['rgba(255,255,255,0.16)', colors.primary] }),
      }}
    >
      <Animated.View
        style={{
          position: 'absolute', top: s(4), width: s(16), height: s(16), borderRadius: s(8), backgroundColor: colors.white,
          left: slide.interpolate({ inputRange: [0, 1], outputRange: [s(4), s(20)] }),
        }}
      />
    </Animated.View>
  );
}

export function ToggleRow({ label, detail, checked, onChange }: { label: string; detail?: string; checked: boolean; onChange: (checked: boolean) => void }) {
  const { s } = useUi();
  return (
    <Press onPress={() => onChange(!checked)} pressScale={0.995} accessibilityRole="switch" accessibilityState={{ checked }} style={rowStyle(s)}>
      <RowText label={label} detail={detail} />
      <Switch checked={checked} />
    </Press>
  );
}

export type ChoiceOption<T extends string> = { value: T; label: string; description?: string };

/** Hàng mở ngay tại chỗ thành danh sách lựa chọn: màn 430 px cao không có chỗ cho dropdown nổi. */
export function ChoiceRow<V extends string>({ label, value, options, onChange }: {
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
        style={rowStyle(s, open ? { backgroundColor: 'rgba(255,255,255,0.06)' } : undefined)}
      >
        <RowText label={label} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
          <T size={12.2} color={colors.text2}>{selected?.label}</T>
          <ChevronDown size={s(16)} color={colors.text4} style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }} />
        </View>
      </Press>
      {open ? (
        <View style={{ paddingBottom: s(8), paddingLeft: s(12), paddingRight: s(4), paddingTop: s(4) }}>
          <View style={{ borderLeftWidth: 1, borderLeftColor: 'rgba(255,255,255,0.12)', paddingLeft: s(8), gap: s(2) }}>
            {options.map((option) => {
              const active = option.value === value;
              return (
                <Press
                  key={option.value}
                  onPress={() => { onChange(option.value); setOpen(false); }}
                  pressScale={0.99}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  style={{ minHeight: s(40), flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(12), paddingVertical: s(6), borderRadius: s(8), backgroundColor: active ? 'rgba(31,111,235,0.22)' : 'transparent' }}
                >
                  <View style={{ flex: 1 }}>
                    <T size={12.2} weight="medium" color={active ? colors.white : 'rgba(255,255,255,0.72)'}>{option.label}</T>
                    {option.description ? <T size={10} color="rgba(255,255,255,0.42)" leading={1.4}>{option.description}</T> : null}
                  </View>
                  {active ? <Check size={s(16)} color={colors.accent} /> : null}
                </Press>
              );
            })}
          </View>
        </View>
      ) : null}
    </View>
  );
}

export function SliderRow({ label, detail, value, min, max, step, format, onChange }: {
  label: string; detail?: string; value: number; min: number; max: number; step: number;
  format: (value: number) => string; onChange: (value: number) => void;
}) {
  const { s, width } = useUi();
  // Giá trị cục bộ để kéo mượt; chỉ báo ra ngoài khi nhả tay.
  const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);

  // Tay cầm: D-pad trái/phải đổi giá trị theo bước ~5% thang; báo ra ngoài sau khi ngừng bấm.
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
      <View style={{ width: Math.min(s(224), width * 0.3), flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
        <Slider
          style={{ flex: 1, height: s(40) }}
          minimumValue={min}
          maximumValue={max}
          step={step}
          value={local}
          minimumTrackTintColor="#4c94ff"
          maximumTrackTintColor="rgba(255,255,255,0.18)"
          thumbTintColor={colors.white}
          onValueChange={setLocal}
          onSlidingComplete={onChange}
          accessibilityLabel={label}
        />
        <T size={11.2} weight="medium" color={colors.text2} tabular style={{ width: s(52), textAlign: 'right' }}>{format(local)}</T>
      </View>
    </View>
  );
}

export function ActionRow({ icon: Icon, label, detail, onPress, disabled = false, busy = false, tone = 'default', trailing, iconBg, iconColor, sound }: {
  icon?: LucideIcon; label: string; detail?: string; onPress: () => void; disabled?: boolean; busy?: boolean;
  tone?: 'default' | 'accent' | 'danger'; trailing?: ReactNode; iconBg?: string; iconColor?: string; sound?: UiSound | false;
}) {
  const { s } = useUi();
  const spin = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!busy) return;
    const loop = Animated.loop(Animated.timing(spin, { toValue: 1, duration: 900, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [busy, spin]);
  const bg = iconBg ?? (tone === 'accent' ? '#2563eb' : tone === 'danger' ? '#ef4444' : 'rgba(255,255,255,0.12)');
  const fg = iconColor ?? (tone === 'accent' || tone === 'danger' || iconBg ? colors.white : 'rgba(255,255,255,0.85)');
  return (
    <Press onPress={onPress} sound={sound} disabled={disabled || busy} pressScale={0.995} style={rowStyle(s, { opacity: disabled ? 0.45 : 1 })}>
      {Icon ? (
        <View style={{ width: s(30), height: s(30), borderRadius: s(8), alignItems: 'center', justifyContent: 'center', backgroundColor: bg }}>
          {busy ? (
            <Animated.View style={{ transform: [{ rotate: spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }) }] }}>
              <Loader size={s(16)} color={fg} />
            </Animated.View>
          ) : <Icon size={s(16)} color={fg} strokeWidth={2.2} />}
        </View>
      ) : null}
      <RowText label={label} detail={detail} />
      {trailing ?? <ChevronRight size={s(16)} color="rgba(255,255,255,0.35)" />}
    </Press>
  );
}

export function InfoRow({ label, detail, value }: { label: string; detail?: string; value: ReactNode }) {
  const { s } = useUi();
  return (
    <View style={rowStyle(s)}>
      <RowText label={label} detail={detail} />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>{typeof value === 'string' ? <T size={12} color={colors.text2}>{value}</T> : value}</View>
    </View>
  );
}

/** Hành động hai nhịp: chạm lần đầu chỉ lên đạn. */
export function ConfirmActionRow({ icon, label, confirmLabel, detail, onConfirm, disabled, busy, tone = 'default', iconBg, iconColor }: {
  icon: LucideIcon; label: string; confirmLabel: string; detail?: string; onConfirm: () => void;
  disabled?: boolean; busy?: boolean; tone?: 'default' | 'danger'; iconBg?: string; iconColor?: string;
}) {
  const [armed, setArmed] = useState(false);
  return (
    <ActionRow
      icon={icon}
      sound={armed ? 'confirm' : 'select'}
      iconBg={armed ? '#ef4444' : (iconBg ?? '#f59e0b')}
      iconColor={iconColor ?? colors.white}
      tone={armed ? 'danger' : tone}
      label={armed ? confirmLabel : label}
      detail={armed ? 'Bấm lần nữa để xác nhận' : detail}
      disabled={disabled}
      busy={busy}
      onPress={() => {
        if (!armed) { setArmed(true); return; }
        setArmed(false);
        onConfirm();
      }}
    />
  );
}

export function Keycap({ children, accent = false }: { children: ReactNode; accent?: boolean }) {
  const { s } = useUi();
  return (
    <View
      style={{
        height: s(24), minWidth: s(24), paddingHorizontal: s(6), borderRadius: s(6), alignItems: 'center', justifyContent: 'center',
        borderWidth: 1,
        borderColor: accent ? 'rgba(76,148,255,0.45)' : 'rgba(255,255,255,0.16)',
        backgroundColor: accent ? 'rgba(31,111,235,0.2)' : 'rgba(255,255,255,0.08)',
      }}
    >
      <T size={10.2} weight="semibold" color={accent ? '#bcd6ff' : 'rgba(255,255,255,0.8)'}>{children}</T>
    </View>
  );
}

export function PillButton({ children, onPress, tone = 'default', disabled = false, label }: {
  children: ReactNode; onPress: () => void; tone?: 'default' | 'danger' | 'accent'; disabled?: boolean; label?: string;
}) {
  const { s } = useUi();
  const border = tone === 'danger' ? 'rgba(252,165,165,0.3)' : tone === 'accent' ? 'rgba(76,148,255,0.4)' : 'rgba(255,255,255,0.14)';
  const bg = tone === 'danger' ? 'rgba(248,113,113,0.14)' : tone === 'accent' ? 'rgba(31,111,235,0.24)' : 'rgba(255,255,255,0.07)';
  const fg = tone === 'danger' ? '#fee2e2' : tone === 'accent' ? colors.white : 'rgba(255,255,255,0.78)';
  return (
    <Press
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      style={{ height: s(28), paddingHorizontal: s(12), borderRadius: s(14), flexDirection: 'row', alignItems: 'center', gap: s(6), borderWidth: 1, borderColor: border, backgroundColor: bg, opacity: disabled ? 0.4 : 1 }}
    >
      {typeof children === 'string' ? <T size={10.2} weight="semibold" color={fg}>{children}</T> : children}
    </Press>
  );
}
