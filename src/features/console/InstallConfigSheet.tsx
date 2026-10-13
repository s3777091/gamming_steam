// Hộp thoại "Cài đặt" của Steam, hiện ở điện thoại: dung lượng, chọn ổ đĩa, lối tắt.
// Agent trên PC giữ bước ShowConfig của Steam cho tới khi người bấm Tải trả lời ở đây
// (xem deploy/pc/steam-downloads), nên mọi thứ Steam hỏi trên PC đều hỏi được ở app.

import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Check, HardDrive, Star, TriangleAlert, X } from 'lucide-react-native';

import { FocusLayer, FocusScroll } from '@/features/gamepad/focus';
import { useBack } from '@/features/gamepad/hooks';
import { playUiSound } from '@/features/sound/UiSoundProvider';
import { type GameDownload, type InstallFolder, formatBytes } from '@/lib/steam-downloads';
import { colors } from '@/theme';
import { Img } from '@/ui/Img';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import type { ConfigAnswer } from '../library/useSteamDownloads';

function fits(folder: InstallFolder, requiredBytes: number): boolean {
  return requiredBytes <= 0 || folder.freeBytes <= 0 || requiredBytes <= folder.freeBytes;
}

function Checkbox({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  const { s } = useUi();
  return (
    <Press
      onPress={() => onChange(!checked)}
      sound="select"
      pressScale={0.98}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(8), paddingVertical: s(6), paddingHorizontal: s(8), borderRadius: s(10) }}
    >
      <View style={[styles.box, { width: s(18), height: s(18), borderRadius: s(5) }, checked && styles.boxOn]}>
        {checked ? <Check size={s(12)} color={colors.onAccent} strokeWidth={3} /> : null}
      </View>
      <T size={10.6} color={colors.text2} numberOfLines={1} style={{ flexShrink: 1 }}>{label}</T>
    </Press>
  );
}

function FolderRow({ folder, requiredBytes, selected, locked, onSelect }: {
  folder: InstallFolder;
  requiredBytes: number;
  selected: boolean;
  locked: boolean;
  onSelect: () => void;
}) {
  const { s } = useUi();
  const enough = fits(folder, requiredBytes);
  return (
    <Press
      onPress={onSelect}
      disabled={!enough || (locked && !selected)}
      autoFocus={selected}
      pressScale={0.985}
      accessibilityRole="radio"
      accessibilityState={{ selected, disabled: !enough }}
      accessibilityLabel={`${folder.label}, còn trống ${formatBytes(folder.freeBytes)}`}
      style={[
        styles.folder,
        { gap: s(10), paddingHorizontal: s(12), height: s(44), borderRadius: s(12) },
        selected && styles.folderOn,
        !enough && { opacity: 0.55 },
      ]}
    >
      {enough
        ? <HardDrive size={s(16)} color={selected ? colors.onAccent : colors.text2} strokeWidth={1.8} />
        : <TriangleAlert size={s(16)} color={colors.warning} strokeWidth={1.8} />}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={11.6} weight="semibold" color={selected ? colors.onAccent : colors.text} numberOfLines={1}>{folder.label}</T>
        {!enough ? <T size={9} color={selected ? colors.onAccent : colors.warning} numberOfLines={1}>Không đủ chỗ trống</T> : null}
      </View>
      {folder.isDefault ? <Star size={s(12)} color={selected ? colors.onAccent : colors.accent} fill={selected ? colors.onAccent : colors.accent} /> : null}
      <T size={10.4} weight="semibold" color={selected ? colors.onAccent : colors.text2} tabular>
        {formatBytes(folder.freeBytes)} trống
      </T>
    </Press>
  );
}

export function InstallConfigSheet({ download, imageUrl, notice, onAnswer, onClose }: {
  download: GameDownload;
  imageUrl?: string | null;
  /** Lý do PC từ chối lựa chọn trước (ví dụ ổ đĩa vừa hết chỗ). */
  notice: string | null;
  onAnswer: (answer: ConfigAnswer) => void;
  onClose: () => void;
}) {
  const { s, width, height } = useUi();
  useBack(() => { onClose(); });
  const config = download.config;
  const [folder, setFolder] = useState(config?.selectedFolder ?? 0);
  const [desktop, setDesktop] = useState(config?.desktopShortcut ?? false);
  const [startMenu, setStartMenu] = useState(config?.startMenuShortcut ?? false);
  if (!config) return null;

  const chosen = config.folders.find((entry) => entry.index === folder);
  const canInstall = Boolean(chosen && fits(chosen, config.requiredBytes));
  const required = config.requiredBytes > 0 ? formatBytes(config.requiredBytes) : null;

  return (
    <FocusLayer>
      <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', zIndex: 70, elevation: 70 }]}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(4,8,14,0.74)' }]} onPress={() => { playUiSound('back'); onClose(); }} />
        <View style={[styles.card, { width: Math.min(s(480), width - s(48)), maxHeight: height - s(24), borderRadius: s(22), padding: s(20) }]}>
          <Press onPress={onClose} sound="back" accessibilityLabel="Đóng" style={[styles.close, { top: s(10), right: s(10), width: s(30), height: s(30), borderRadius: s(15) }]}>
            <X size={s(14)} color={colors.text3} />
          </Press>

          <T size={16} weight="semibold" tracking={-0.02}>Cài đặt</T>
          <View style={[styles.game, { marginTop: s(12), gap: s(12), paddingVertical: s(10), borderRadius: s(12) }]}>
            <View style={{ width: s(86), height: s(40), borderRadius: s(6), overflow: 'hidden', backgroundColor: colors.fill }}>
              {imageUrl ? <Img source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} contentFit="cover" /> : null}
            </View>
            <T size={11.8} color={colors.text2} numberOfLines={1} style={{ flex: 1 }}>{download.name ?? 'Trò chơi Steam'}</T>
            {required ? <T size={11.4} weight="semibold" color={colors.text} tabular>{required}</T> : null}
          </View>

          <View style={{ flexDirection: 'row', gap: s(6), marginTop: s(8) }}>
            <Checkbox checked={desktop} label="Tạo lối tắt trên màn hình" onChange={setDesktop} />
            <Checkbox checked={startMenu} label="Tạo lối tắt trong Start" onChange={setStartMenu} />
          </View>

          <T size={9.4} weight="semibold" color={colors.text3} tracking={0.06} style={{ marginTop: s(12), marginBottom: s(6) }}>NƠI CÀI ĐẶT</T>
          <FocusScroll style={{ flexGrow: 0, maxHeight: s(150) }} showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: s(6) }}>
            {config.folders.map((entry) => (
              <FolderRow
                key={entry.index}
                folder={entry}
                requiredBytes={config.requiredBytes}
                selected={entry.index === folder}
                locked={!config.canChangeFolder}
                onSelect={() => setFolder(entry.index)}
              />
            ))}
          </FocusScroll>
          {chosen?.path ? <T size={9} color={colors.text4} numberOfLines={1} style={{ marginTop: s(6) }}>{chosen.path}</T> : null}
          {notice ? <T size={10} color="#fecaca" leading={1.4} style={{ marginTop: s(8) }}>{notice}</T> : null}

          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(10), marginTop: s(16) }}>
            <Press onPress={() => onAnswer({ accept: false })} sound="back" style={[styles.secondary, { height: s(38), paddingHorizontal: s(18), borderRadius: s(19) }]}>
              <T size={11.6} weight="semibold" color={colors.text2}>Huỷ</T>
            </Press>
            <Press
              onPress={() => onAnswer({ accept: true, folder, desktopShortcut: desktop, startMenuShortcut: startMenu })}
              disabled={!canInstall}
              sound="confirm"
              style={[styles.primary, { height: s(38), paddingHorizontal: s(22), borderRadius: s(19) }, !canInstall && { opacity: 0.45 }]}
            >
              <T size={11.6} weight="semibold" color="#0a111c">Cài đặt</T>
            </Press>
          </View>
        </View>
      </View>
    </FocusLayer>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)', backgroundColor: '#0d1520' },
  close: { position: 'absolute', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.07)' },
  game: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.line,
  },
  box: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.lineStrong },
  boxOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  folder: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: colors.fillSoft },
  folderOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  secondary: { alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.lineStrong },
  primary: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.white },
});
