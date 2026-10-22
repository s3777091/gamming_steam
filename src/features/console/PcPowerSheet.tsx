// Hộp thoại bật máy tính khi thư viện chưa kết nối được PC. Gửi Wake-on-LAN rồi
// THEO DÕI bằng sự kiện trạng thái nguồn (Realtime) — không hỏi thăm — qua các
// chặng: đã gửi tín hiệu -> Windows có mạng -> dịch vụ điều khiển sẵn sàng.

import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { FocusLayer } from '@/features/gamepad/focus';
import { Check, Monitor, Power, X } from 'lucide-react-native';

import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { useDeviceStatus } from '@/features/devices/useDeviceStatus';
import { apiFetch } from '@/lib/api';
import { friendlyMessage } from '@/lib/friendly';
import { makeStyles, useTheme } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';
import { ConsoleAction } from './ConsoleControls';
import { CONSOLE } from './consoleVisuals';

const WAKE_SLOW_MS = 90_000;
const WAKE_TIMEOUT_MS = 10 * 60_000;

type Phase = 'idle' | 'sending' | 'waiting' | 'ready' | 'failed';

export function PcPowerSheet({ onClose, onReady }: { onClose: () => void; onReady: () => void }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { s, width } = useUi();
  const status = useDeviceStatus();
  const [phase, setPhase] = useState<Phase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [slow, setSlow] = useState(false);
  const readyHandled = useRef(false);
  useBack(() => { onClose(); });

  // Máy đã bật sẵn (trạng thái đẩy về nói vậy) thì không cần gửi gì.
  const online = status.online === true && status.stage === 'ready';
  useEffect(() => {
    if (!online || readyHandled.current) return;
    readyHandled.current = true;
    setPhase('ready');
    const timer = setTimeout(onReady, 900);
    return () => clearTimeout(timer);
  }, [online, onReady]);

  // Hai mốc thời gian của chờ khởi động; không phải vòng lặp hỏi trạng thái.
  useEffect(() => {
    if (phase !== 'waiting') return;
    const slowTimer = setTimeout(() => setSlow(true), WAKE_SLOW_MS);
    const giveUp = setTimeout(() => {
      setPhase('failed');
      setError('Đã theo dõi 10 phút nhưng dịch vụ điều khiển chưa sẵn sàng. Kiểm tra trực tiếp Windows, mạng hoặc Wake-on-LAN.');
    }, WAKE_TIMEOUT_MS);
    return () => { clearTimeout(slowTimer); clearTimeout(giveUp); };
  }, [phase]);

  const wake = async () => {
    if (phase === 'sending' || phase === 'waiting') return;
    setPhase('sending');
    setError(null);
    setSlow(false);
    try {
      const response = await apiFetch('/api/wol/wake', { method: 'POST' });
      const data = await response.json().catch(() => null) as { ok?: boolean; error?: string } | null;
      if (!response.ok || !data?.ok) throw new Error(data?.error || `HTTP ${response.status}`);
      setPhase('waiting');
    } catch (wakeError) {
      setPhase('failed');
      setError(friendlyMessage((wakeError as Error).message));
    }
  };

  const title = phase === 'ready' ? 'Máy đã sẵn sàng'
    : phase === 'waiting' ? (slow ? 'Máy khởi động lâu hơn bình thường' : 'Đang chờ máy khởi động…')
      : phase === 'sending' ? 'Đang gửi tín hiệu bật máy…'
        : 'Chưa kết nối được máy tính';
  const detail = phase === 'ready' ? 'Đang tải thư viện trò chơi…'
    : phase === 'waiting'
      ? (status.stage === 'network'
        ? 'Windows đã có mạng; đang chờ dịch vụ điều khiển khởi động. Không cần bấm lại.'
        : slow ? 'Tín hiệu đã gửi; vẫn đang theo dõi, không cần bấm lại.' : 'Thường mất 30–60 giây.')
      : phase === 'failed' ? error
        : 'Máy ở nhà có thể đang tắt hoặc đang ngủ. Bật máy để mở thư viện và chơi game.';

  return (
    <FocusLayer>
    <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 70, elevation: 70 }]}>
      <View style={StyleSheet.absoluteFill}>
        <GlassBackdrop material="scrim" />
        <Pressable style={StyleSheet.absoluteFill} onPress={() => { playUiSound('back'); onClose(); }} />
      </View>
      <View style={[styles.card, { width: Math.min(s(400), width - s(48)), borderRadius: s(24), padding: s(22) }]}>

        <Press onPress={onClose} sound="back" focusVariant="quiet" accessibilityLabel="Đóng" style={[styles.close, { top: s(12), right: s(12), width: s(30), height: s(30), borderRadius: s(10) }]}>
          <X size={s(14)} color="rgba(255,255,255,0.75)" />
        </Press>
        <View style={{ alignItems: 'center' }}>
          <View style={[styles.badge, { width: s(58), height: s(58), borderRadius: s(19), borderColor: phase === 'ready' ? 'rgba(74,222,128,0.5)' : 'rgba(255,255,255,0.28)' }]}>
            {phase === 'ready' ? <Check size={s(26)} color={colors.success} strokeWidth={2.4} /> : phase === 'sending' || phase === 'waiting'
              ? <ActivityIndicator color={colors.text2} /> : <Monitor size={s(24)} color={colors.text2} />}
          </View>
          <T size={16} weight="semibold" style={{ marginTop: s(14), textAlign: 'center' }}>{title}</T>
          <T size={11.4} color={phase === 'failed' ? '#fecaca' : colors.text3} leading={1.55} style={{ marginTop: s(6), textAlign: 'center' }}>{detail}</T>
          {phase === 'idle' || phase === 'failed' ? (
            <ConsoleAction label={phase === 'failed' ? 'Thử bật lại' : 'Bật máy tính'} onPress={() => void wake()} autoFocus
              style={{ marginTop: s(18), alignSelf: 'center' }} icon={<Power size={s(18)} color={CONSOLE.ink} />} />
          ) : null}
        </View>
      </View>
    </View>
    </FocusLayer>
  );
}

const useStyles = makeStyles(() => ({
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: CONSOLE.border,
    backgroundColor: CONSOLE.panel,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 32,
    shadowOffset: { width: 0, height: 16 },
    elevation: 20,
  },
  close: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CONSOLE.control,
    borderWidth: 1,
    borderColor: CONSOLE.border,
  },
  badge: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
}));
