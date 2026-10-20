// Cài đặt → Game Booster: chọn mức PC tự tối ưu khi bấm Play. Lưu trên máy này
// và gửi kèm lệnh Play; booster trên PC trả lại mọi thứ khi game thoát.

import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Check, Leaf, Minus, Rocket, Scale, WandSparkles, type LucideIcon } from 'lucide-react-native';

import {
  DEFAULT_GAME_BOOST_MODE,
  GAME_BOOST_ACTION_LABEL,
  GAME_BOOST_ACTION_ORDER,
  GAME_BOOST_META,
  GAME_BOOST_MODES,
  type GameBoostAction,
  type GameBoostMode,
} from '@/lib/game-booster';
import { getGameBoostMode, setGameBoostMode, subscribeGameBoostMode } from '@/lib/game-booster-settings';
import { type SettingsTokens, useTheme } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { InfoRow, rowStyle, SettingsGroup } from './controls';
import { useSettingsRestore } from './SettingsRestore';
import type { Notify } from './useStreamSettingsDraft';

const MODE_ICON: Record<GameBoostMode, { icon: LucideIcon; color: keyof SettingsTokens }> = {
  auto: { icon: WandSparkles, color: 'purple' },
  high: { icon: Rocket, color: 'red' },
  balanced: { icon: Scale, color: 'blue' },
  low: { icon: Leaf, color: 'green' },
};

function ModeIcon({ mode }: { mode: GameBoostMode }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const { icon: Icon, color } = MODE_ICON[mode];
  return (
    <View
      style={{
        width: s(30),
        height: s(30),
        borderRadius: s(9),
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: appleColors[color],
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(255, 255, 255, 0.40)',
        overflow: 'hidden',
      }}
    >
      <LinearGradient
        colors={['rgba(255, 255, 255, 0.35)', 'rgba(255, 255, 255, 0)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 0.7 }}
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      />
      <Icon size={s(16)} color="#FFFFFF" strokeWidth={2.2} />
    </View>
  );
}

/** Một việc PC làm (hoặc giữ nguyên) ở mức đang chọn. */
function ActionRow({ action, on }: { action: GameBoostAction; on: boolean }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  return (
    <View style={rowStyle(s, { minHeight: s(38) })}>
      {on ? (
        <Check size={s(15)} color={appleColors.green} strokeWidth={2.6} />
      ) : (
        <Minus size={s(15)} color={appleColors.textTertiary} strokeWidth={2.2} />
      )}
      <T size={12.6} color={on ? appleColors.text : appleColors.textTertiary} style={{ flex: 1 }} numberOfLines={1}>
        {GAME_BOOST_ACTION_LABEL[action]}
      </T>
      <T size={10.4} color={on ? appleColors.green : appleColors.textTertiary}>
        {on ? 'Bật' : 'Giữ nguyên'}
      </T>
    </View>
  );
}

export function GameBoosterPage({ notify }: { notify: Notify }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const [mode, setMode] = useState<GameBoostMode | null>(null);

  useEffect(() => {
    let alive = true;
    void getGameBoostMode().then((value) => { if (alive) setMode(value); });
    const unsubscribe = subscribeGameBoostMode(setMode);
    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const choose = useCallback((next: GameBoostMode) => {
    if (next === mode) return;
    void setGameBoostMode(next);
    notify('success', `Game Booster: ${GAME_BOOST_META[next].label}`, 'Áp dụng từ lần bấm Play tiếp theo.');
  }, [mode, notify]);

  useSettingsRestore(() => choose(DEFAULT_GAME_BOOST_MODE), {
    label: 'Về Tự động',
    disabled: mode === null || mode === DEFAULT_GAME_BOOST_MODE,
  });

  return (
    <>
      <SettingsGroup
        title="Chế độ tối ưu"
        footer="Khi bấm Play, máy tính tối ưu ngay trong lúc stream đang kết nối. Thoát game là mọi thứ được trả lại như cũ."
      >
        {GAME_BOOST_MODES.map((option) => {
          const active = mode === option;
          const meta = GAME_BOOST_META[option];
          return (
            <Press
              key={option}
              onPress={() => choose(option)}
              pressScale={0.995}
              focusVariant="row"
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={rowStyle(s, {
                minHeight: s(56),
                backgroundColor: active ? appleColors.selectedBg : 'transparent',
              })}
            >
              <ModeIcon mode={option} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <T size={13.4} weight={active ? 'semibold' : 'regular'} color={active ? appleColors.selectedText : appleColors.text}>
                  {meta.label}
                </T>
                <T size={10.4} color={appleColors.textTertiary} leading={1.35} style={{ marginTop: s(1.5) }}>
                  {meta.description}
                </T>
              </View>
              {active ? <Check size={s(17)} color={appleColors.accent} strokeWidth={2.6} /> : null}
            </Press>
          );
        })}
      </SettingsGroup>

      {mode === 'auto' ? (
        <SettingsGroup
          title="Tự động chọn thế nào"
          footer="PC kiểm tra lại mỗi lần bấm Play. Chạy pin mà RAM còn dưới 20% thì Cân bằng vẫn tắt bớt app nền để game không giật."
        >
          <InfoRow label="Cắm sạc / máy bàn" value={GAME_BOOST_META.high.label} />
          <InfoRow label="Laptop chạy pin" value={GAME_BOOST_META.balanced.label} />
        </SettingsGroup>
      ) : mode ? (
        <SettingsGroup title={`Máy tính sẽ làm gì · ${GAME_BOOST_META[mode].label}`}>
          {GAME_BOOST_ACTION_ORDER.map((action) => (
            <ActionRow key={action} action={action} on={GAME_BOOST_META[mode].actions.includes(action)} />
          ))}
        </SettingsGroup>
      ) : null}
    </>
  );
}
