import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { Animated, Easing } from 'react-native';
import { RefreshCw } from 'lucide-react-native';

import { useMotion } from '@/ui/motion';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';

import { appleColors } from './controls';
import type { Notify } from './useStreamSettingsDraft';

type RestoreOptions = {
  label?: string;
  disabled?: boolean;
  confirm?: boolean;
};

export type SettingsRestoreAction = RestoreOptions & {
  category: string;
  onRestore: () => void | Promise<void>;
};

export const SettingsRestoreContext = createContext<{
  category: string;
  setRestore: Dispatch<SetStateAction<SettingsRestoreAction | null>>;
} | null>(null);

/** Each page owns its reset behavior; only the active page exposes a header action. */
export function useSettingsRestore(
  onRestore: () => void | Promise<void>,
  { label = 'Khôi phục mặc định', disabled = false, confirm = false }: RestoreOptions = {},
) {
  const context = useContext(SettingsRestoreContext);
  const handler = useRef(onRestore);
  useLayoutEffect(() => {
    handler.current = onRestore;
  }, [onRestore]);

  useEffect(() => {
    if (!context) return;
    const action: SettingsRestoreAction = {
      category: context.category, label, disabled, confirm,
      onRestore: () => handler.current(),
    };
    context.setRestore(action);
    return () => context.setRestore((current) => current === action ? null : current);
  }, [context, label, disabled, confirm]);
}

export function SettingsRestoreButton({ action, notify }: { action: SettingsRestoreAction; notify: Notify }) {
  const { s } = useUi();
  const { reduceMotion } = useMotion();
  const [enter] = useState(() => new Animated.Value(reduceMotion ? 1 : 0));
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const running = useRef(false);

  useEffect(() => {
    if (reduceMotion) {
      enter.setValue(1);
      return;
    }
    const animation = Animated.timing(enter, {
      toValue: 1, duration: 180, easing: Easing.out(Easing.cubic),
      useNativeDriver: true, isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [enter, reduceMotion]);

  useEffect(() => {
    if (!armed) return;
    const timer = setTimeout(() => setArmed(false), 4500);
    return () => clearTimeout(timer);
  }, [armed]);

  const restore = async () => {
    if (running.current || action.disabled) return;
    if (action.confirm && !armed) {
      setArmed(true);
      notify('info', 'Khôi phục mọi thông số?', 'Bấm lại nút khôi phục để xác nhận.');
      return;
    }
    setArmed(false);
    running.current = true;
    setBusy(true);
    try {
      await action.onRestore();
      notify('success', 'Đã khôi phục cài đặt');
    } catch {
      notify('error', 'Không khôi phục được cài đặt', 'Vui lòng thử lại.');
    } finally {
      running.current = false;
      setBusy(false);
    }
  };

  return (
    <Animated.View style={{
      opacity: enter,
      transform: [
        { translateY: enter.interpolate({ inputRange: [0, 1], outputRange: [s(4), 0] }) },
        { scale: enter.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1] }) },
      ],
    }}>
      <Press
        onPress={() => void restore()}
        disabled={action.disabled || busy}
        accessibilityRole="button"
        accessibilityLabel={armed ? 'Xác nhận khôi phục mọi thông số' : action.label}
        accessibilityHint={action.confirm ? 'Bấm hai lần để xác nhận khôi phục' : undefined}
        accessibilityState={{ disabled: action.disabled || busy, busy }}
        sound={armed ? 'confirm' : 'select'}
        pressScale={0.92}
        hitSlop={s(4)}
        style={{
          width: s(32), height: s(32), borderRadius: s(16),
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: 1,
          borderColor: armed ? appleColors.orange : 'rgba(255, 255, 255, 0.16)',
          alignItems: 'center', justifyContent: 'center',
          opacity: action.disabled || busy ? 0.4 : 1,
        }}
      >
        <RefreshCw size={s(15)} color={armed ? appleColors.orange : 'rgba(255, 255, 255, 0.85)'} strokeWidth={2.2} />
      </Press>
    </Animated.View>
  );
}
