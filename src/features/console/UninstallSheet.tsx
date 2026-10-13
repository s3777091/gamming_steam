import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { CircleCheck, Trash2, X } from 'lucide-react-native';

import { FocusLayer } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import type { PcGame } from '@/features/library/types';
import type { UninstallResult } from '@/features/library/usePcLibrary';
import type { GameUninstall } from '@/lib/steam-downloads';
import { colors, glass } from '@/theme';
import { GlassBackdrop } from '@/ui/GlassMaterial';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

export function UninstallSheet({ game, operation, requesting, notice, onConfirm, onClose }: {
  game: PcGame;
  operation: GameUninstall | null;
  requesting: boolean;
  notice: string | null;
  onConfirm: () => Promise<UninstallResult>;
  onClose: () => void;
}) {
  const { s, width } = useUi();
  const [started, setStarted] = useState(Boolean(operation));
  const [requestError, setRequestError] = useState<string | null>(null);
  useBack(onClose);

  const failed = operation?.status === 'failed';
  const done = operation?.status === 'uninstalled';
  const working = !failed && !done && (requesting || started || Boolean(operation));
  const error = operation?.error || requestError || (working ? notice : null);
  const progress = operation?.progress ?? (requesting || started ? 8 : 0);

  const confirm = async () => {
    if (requesting) return;
    setRequestError(null);
    const result = await onConfirm();
    if (result.ok) setStarted(true);
    else setRequestError(result.error || 'Không bắt đầu gỡ cài đặt được.');
  };

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, styles.layer]}>
        <GlassBackdrop material="scrim" />
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.card, { width: Math.min(s(430), width - s(48)), borderRadius: s(24), padding: s(22) }]}>
          <GlassBackdrop material="panel" intensity={36} radius={s(24)} />

          <Press
            onPress={onClose}
            sound="back"
            accessibilityLabel="Đóng"
            style={[styles.close, { top: s(12), right: s(12), width: s(30), height: s(30), borderRadius: s(15) }]}>
            <X size={s(14)} color="rgba(255,255,255,0.75)" />
          </Press>

          <View style={[styles.icon, { width: s(44), height: s(44), borderRadius: s(14) }]}>
            {done
              ? <CircleCheck size={s(22)} color={colors.success} />
              : <Trash2 size={s(20)} color={failed || requestError ? '#fecaca' : '#fca5a5'} />}
          </View>

          <T size={16} weight="semibold" tracking={-0.02} style={{ marginTop: s(14), paddingRight: s(28) }}>
            {done ? 'Đã gỡ khỏi máy tính' : failed || requestError ? 'Không gỡ được trò chơi' : working ? 'Đang gỡ cài đặt' : `Gỡ ${game.title}?`}
          </T>

          {working && !failed && !requestError ? (
            <>
              <T size={11} color={colors.text3} leading={1.55} style={{ marginTop: s(7) }}>
                {notice || operation?.label || 'Đang khởi động agent và kết nối với Steam client.'}
              </T>
              <View style={[styles.track, { height: s(4), borderRadius: s(2), marginTop: s(16) }]}>
                <View style={{ width: `${progress}%`, height: '100%', borderRadius: s(2), backgroundColor: colors.accent }} />
              </View>
            </>
          ) : (
            <T size={11} color={error ? '#fecaca' : colors.text3} leading={1.55} style={{ marginTop: s(7) }}>
              {done
                ? 'Trò chơi vẫn còn trong thư viện Steam và bạn có thể cài lại bất cứ lúc nào.'
                : error || 'Steam sẽ xóa tệp trò chơi khỏi máy tính. Trò chơi vẫn còn trong thư viện Steam.'}
            </T>
          )}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(10), marginTop: s(20) }}>
            {done ? (
              <Press onPress={onClose} sound="confirm" autoFocus style={[styles.primary, { height: s(38), paddingHorizontal: s(20), borderRadius: s(19) }]}>
                <T size={11.6} weight="semibold" color="#08111d">Xong</T>
              </Press>
            ) : working && !failed && !requestError ? (
              <Press onPress={onClose} sound="back" style={[styles.secondary, { height: s(38), paddingHorizontal: s(18), borderRadius: s(19) }]}>
                <T size={11.6} weight="semibold" color={colors.text2}>Ẩn</T>
              </Press>
            ) : (
              <>
                <Press onPress={onClose} sound="back" style={[styles.secondary, { height: s(38), paddingHorizontal: s(18), borderRadius: s(19) }]}>
                  <T size={11.6} weight="semibold" color={colors.text2}>{failed || requestError ? 'Đóng' : 'Giữ lại'}</T>
                </Press>
                <Press
                  onPress={() => void confirm()}
                  sound="confirm"
                  disabled={requesting}
                  autoFocus
                  style={[styles.danger, { height: s(38), paddingHorizontal: s(18), borderRadius: s(19), opacity: requesting ? 0.55 : 1 }]}
                >
                  <Trash2 size={s(13)} color="#fff7f7" />
                  <T size={11.6} weight="semibold" color="#fff7f7">{failed || requestError ? 'Thử lại' : 'Gỡ cài đặt'}</T>
                </Press>
              </>
            )}
          </View>
        </View>
      </View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  layer: {
    zIndex: 72,
    elevation: 72,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  card: {
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: glass.panelBorder,
    backgroundColor: glass.modal,
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
    backgroundColor: glass.control,
    borderWidth: 1,
    borderColor: glass.controlBorder,
  },
  icon: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.25)',
  },
  track: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  secondary: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  primary: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.4)',
    shadowColor: '#fff',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
  },
  danger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    backgroundColor: '#dc2626',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#ef4444',
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
  },
});
