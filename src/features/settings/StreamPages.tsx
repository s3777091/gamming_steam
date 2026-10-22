// Stream settings use the shared dark grouped controls.

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Check, RadioTower, Sparkles } from 'lucide-react-native';
import { getDisplayInfo } from 'jetsona-input';

import { getLiveBorderEnabled, setLiveBorderEnabled } from '@/lib/stream-overlay-settings';
import { clientDisplayGeometry, DEFAULT_STREAM_SETTINGS, PROFILE_META, REGION_META, resolveMoonlightSettings, type StreamSettings } from '@/lib/stream-settings';
import { preferredRefreshHz } from '@/lib/stream-display-policy';
import {
  CODEC_OPTIONS,
  frameRateChoice,
  friendlyError,
  LATENCY_OPTIONS,
  measureNetwork,
  PROFILE_ORDER,
  streamSettingsCopy,
  type NetworkResult,
} from '@/lib/stream-settings-ui';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { MultipathSection } from './MultipathSection';

import { ActionRow, ChoiceRow, InfoRow, rowStyle, SettingsGroup, SliderRow, ToggleRow } from './controls';
import type { Notify, StreamSettingsDraft } from './useStreamSettingsDraft';
import { useSettingsRestore } from './SettingsRestore';
import { useSettingsColors } from './SettingsSurface';

type PageProps = { draft: StreamSettingsDraft; settings: StreamSettings };

function DeviceStreamRecommendation({ draft, settings }: PageProps) {
  const appleColors = useSettingsColors();
  const [panel] = useState(() => {
    const display = clientDisplayGeometry();
    const native = getDisplayInfo();
    const refreshHz = preferredRefreshHz(native?.refreshRate ?? null, native?.supportedRefreshRates);
    return { display, refreshHz };
  });
  const auto = resolveMoonlightSettings(
    { ...DEFAULT_STREAM_SETTINGS, user_id: settings.user_id, region: settings.region },
    null, null, panel.refreshHz, panel.display, draft.deviceClass,
  );

  return (
    <SettingsGroup
      title="Tối ưu cho thiết bị này"
      footer="Auto dùng số pixel và Hz màn hình hỗ trợ, kể cả tablet nhỏ. Chất lượng thực tế còn phụ thuộc máy chủ và đường truyền."
    >
      <InfoRow label="Độ phân giải màn hình" value={`${panel.display.width} × ${panel.display.height}`} />
      <InfoRow label="Tần số quét hỗ trợ" value={panel.refreshHz ? `${Math.round(panel.refreshHz)} Hz` : 'Chưa xác định'} />
      <ActionRow
        icon={Sparkles}
        iconBg={appleColors.purple}
        tone="accent"
        label="Dùng Auto theo màn hình"
        detail={`Mục tiêu ${auto.videoSizeCustom.width} × ${auto.videoSizeCustom.height} · ${auto.fps} FPS · bitrate thích ứng`}
        onPress={() => draft.selectProfile('auto')}
      />
    </SettingsGroup>
  );
}

export function QualityPage({ draft, settings }: PageProps) {
  const appleColors = useSettingsColors();
  const { s } = useUi();
  const copy = streamSettingsCopy(draft.deviceClass);
  useSettingsRestore(draft.restoreDefaults, {
    label: 'Khôi phục cài đặt tốt nhất', disabled: !draft.hasDrift, confirm: true,
  });

  return (
    <>
      <DeviceStreamRecommendation draft={draft} settings={settings} />
      <SettingsGroup
        title="Profile streaming"
        footer="Chọn profile phù hợp với khả năng xử lý của máy và chất lượng đường truyền mạng."
      >
        {PROFILE_ORDER.map((profile) => {
          const active = settings.profile === profile;
          const visual = copy.profileVisual[profile];
          const isAuto = profile === 'auto';
          const isRemote = (profile as string) === 'remote' || profile === 'long_haul';

          return (
            <Press
              key={profile}
              onPress={() => draft.selectProfile(profile)}
              pressScale={0.995}
              focusVariant="row"
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={rowStyle(s)}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <T
                  size={13.2}
                  weight={active ? 'semibold' : 'regular'}
                  color={appleColors.text}
                >
                  {PROFILE_META[profile].label}
                </T>
                <T
                  size={10.4}
                  color={appleColors.textTertiary}
                  numberOfLines={1}
                  style={{ marginTop: s(1.5) }}
                >
                  {visual.note}
                </T>
              </View>

              <View style={{ alignItems: 'flex-end', gap: s(1.5), marginRight: active ? s(6) : 0 }}>
                <T size={10.6} weight="medium" color={appleColors.textSecondary}>
                  {isAuto ? 'Tự động' : isRemote ? 'Tự động tối ưu' : `${visual.resolution} · ${visual.fps}`}
                </T>
                <T size={10.2} color={appleColors.textTertiary}>
                  {isAuto ? 'Khớp màn hình' : isRemote ? 'Tối đa 1080p' : copy.profileGuidance[profile].bitrate}
                </T>
              </View>

              {active ? (
                <Check size={s(16)} color={appleColors.accent} strokeWidth={2.6} />
              ) : null}
            </Press>
          );
        })}
      </SettingsGroup>
    </>
  );
}

export function VideoPage({ draft, settings }: PageProps) {
  const copy = streamSettingsCopy(draft.deviceClass);
  const fps = frameRateChoice(settings);
  const [border, setBorder] = useState(true);

  useEffect(() => {
    void getLiveBorderEnabled().then(setBorder);
  }, []);

  return (
    <>
      <DeviceStreamRecommendation draft={draft} settings={settings} />
      <SettingsGroup title="Hình ảnh">
        <ChoiceRow
          label="Độ phân giải"
          value={settings.resolution}
          options={copy.resolutionOptions}
          onChange={(value) => draft.update('resolution', value)}
        />
        <ChoiceRow
          label="Tốc độ khung hình"
          value={fps}
          options={copy.fpsOptions}
          onChange={(value) =>
            draft.update('frame_rate', value === 'auto' ? null : (Number(value) as StreamSettings['frame_rate']))
          }
        />
        <ChoiceRow
          label="Codec mã hóa"
          value={settings.codec}
          options={CODEC_OPTIONS}
          onChange={(value) => draft.update('codec', value)}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Bitrate"
        footer={
          settings.bitrate_mode === 'fixed'
            ? 'Bitrate cố định giữ mức Mbps ổn định, nếu mạng không đủ sẽ gây giật hình.'
            : 'Bitrate tương thích tự động điều chỉnh theo độ ổn định của mạng.'
        }
      >
        <ToggleRow
          label="Bitrate cố định"
          checked={settings.bitrate_mode === 'fixed'}
          onChange={(checked) => draft.update('bitrate_mode', checked ? 'fixed' : 'adaptive')}
        />
        {settings.bitrate_mode === 'fixed' ? (
          <SliderRow
            label="Bitrate tối đa"
            value={settings.bitrate_mbps ?? 25}
            min={1}
            max={80}
            step={1}
            format={(value) => `${value} Mbps`}
            onChange={(value) => draft.update('bitrate_mbps', value)}
          />
        ) : null}
      </SettingsGroup>

      <SettingsGroup title="Màu sắc" footer="Màn hình đang xem cần hỗ trợ HDR để màu hiển thị chính xác.">
        <ToggleRow
          label="HDR"
          detail="Mở rộng dải tương phản động trên màn hình tương thích"
          checked={settings.hdr === 'on'}
          onChange={(checked) => draft.update('hdr', checked ? 'on' : 'off')}
        />
        <ToggleRow
          label="Màu 10-bit"
          detail="Chuyển tiếp dải màu mịn hơn, giảm hiện tượng gợn dải bóng tối"
          checked={settings.ten_bit === 'on'}
          onChange={(checked) => draft.update('ten_bit', checked ? 'on' : 'off')}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Lớp phủ màn hình"
        footer="Các thông số hỗ trợ và viền thông báo hiển thị trực tiếp đè lên khung stream."
      >
        <ToggleRow
          label="Performance HUD"
          detail="RTT, jitter, mất gói, codec, bitrate và tốc độ khung hình"
          checked={settings.hud_enabled}
          onChange={(checked) => draft.update('hud_enabled', checked)}
        />
        <ToggleRow
          label="Viền báo đang phát"
          detail="Viền mỏng quanh màn hình khi đang có người cùng xem"
          checked={border}
          onChange={(checked) => {
            setBorder(checked);
            void setLiveBorderEnabled(checked);
          }}
        />
      </SettingsGroup>
    </>
  );
}

export function LatencyPage({ draft, settings }: PageProps) {
  return (
    <>
      <SettingsGroup title="Độ trễ">
        <ChoiceRow
          label="Chế độ xử lý"
          value={settings.latency_mode}
          options={LATENCY_OPTIONS}
          onChange={(value) => draft.update('latency_mode', value)}
        />
      </SettingsGroup>

      <SettingsGroup
        title="Độ mượt"
        footer="Frame pacing giúp khung hình hiển thị đều nhịp. V-Sync ngăn hiện tượng xé hình."
      >
        <ToggleRow
          label="Frame pacing"
          detail="Dàn đều thời điểm hiển thị từng khung hình"
          checked={settings.frame_pacing}
          onChange={(checked) => draft.update('frame_pacing', checked)}
        />
        <ToggleRow
          label="V-Sync phía máy xem"
          detail="Đồng bộ khung hình theo tần số quét của màn hình"
          checked={settings.client_vsync === 'on'}
          onChange={(checked) => draft.update('client_vsync', checked ? 'on' : 'off')}
        />
        <ToggleRow
          label="Chất lượng động"
          detail="Tự giảm độ nét tạm thời khi mạng nghẽn để tránh đơ giật"
          checked={settings.dynamic_resolution}
          onChange={(checked) => draft.update('dynamic_resolution', checked)}
        />
      </SettingsGroup>
    </>
  );
}

export function NetworkPage({ draft, settings, notify }: PageProps & { notify: Notify }) {
  const appleColors = useSettingsColors();
  const { s } = useUi();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<NetworkResult | null>(null);

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    setResult(null);
    try {
      setResult(await measureNetwork(draft.deviceClass));
    } catch (error) {
      notify('error', 'Không kiểm tra được kết nối', friendlyError(error, 'Vui lòng thử lại sau ít phút.'));
    } finally {
      setTesting(false);
    }
  };

  const region = REGION_META[settings.region];

  return (
    <>
      <MultipathSection connectionHeader={
        <InfoRow
          label="Khu vực máy chủ"
          value={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              <T size={14}>{region.flag}</T>
              <T size={12.6} color={appleColors.textSecondary}>
                {region.label}
              </T>
            </View>
          }
        />
      } />

      <SettingsGroup
        title="Chẩn đoán"
        footer={result ? 'Kết quả đo tới máy chủ ứng dụng; chất lượng trong game có thể khác.' : undefined}
      >
        <ActionRow
          icon={RadioTower}
          iconBg={appleColors.accent}
          tone="accent"
          busy={testing}
          label={testing ? 'Đang đo kết nối…' : result ? 'Kiểm tra lại' : 'Kiểm tra mạng'}
          detail="Đo ping, jitter và packet loss"
          onPress={() => void runTest()}
        />
        {result ? <InfoRow label="Ping" value={`${result.ping.toFixed(0)} ms`} /> : null}
        {result ? <InfoRow label="Jitter" value={`${result.jitter.toFixed(1)} ms`} /> : null}
        {result ? <InfoRow label="Mất gói" value={`${result.loss.toFixed(1)}%`} /> : null}
        {result ? <InfoRow label="Băng thông" value={`${result.bandwidth.toFixed(0)} Mbps`} /> : null}
      </SettingsGroup>
    </>
  );
}
