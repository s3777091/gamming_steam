// Bốn trang cài đặt stream theo ngôn ngữ thiết kế Apple:
// Chất lượng, Hình ảnh (gồm lớp phủ màn hình), Độ trễ & độ mượt, Mạng.
// Thẻ Inset Grouped bo tròn viền xám mỏng, nền trắng, chữ đen, dấu tích xanh #007AFF.

import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Check, RadioTower, RotateCcw } from 'lucide-react-native';

import { getLiveBorderEnabled, setLiveBorderEnabled } from '@/lib/stream-overlay-settings';
import { PROFILE_META, REGION_META, type StreamSettings } from '@/lib/stream-settings';
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

import {
  ActionRow,
  appleColors,
  ChoiceRow,
  ConfirmActionRow,
  InfoRow,
  PillButton,
  rowStyle,
  SettingsGroup,
  SliderRow,
  ToggleRow,
} from './controls';
import type { Notify, StreamSettingsDraft } from './useStreamSettingsDraft';

type PageProps = { draft: StreamSettingsDraft; settings: StreamSettings };

export function QualityPage({ draft, settings }: PageProps) {
  const { s } = useUi();
  const copy = streamSettingsCopy(draft.deviceClass);

  return (
    <>
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
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              style={rowStyle(s, { minHeight: s(50) })}
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
                <Check size={s(16)} color={appleColors.blue} strokeWidth={2.6} />
              ) : null}
            </Press>
          );
        })}
      </SettingsGroup>

      <SettingsGroup
        title="Cấu hình chuẩn"
        footer="Đưa mọi thông số về cấu hình đã tinh chỉnh cho độ mượt và chất lượng tối ưu."
      >
        <ConfirmActionRow
          icon={RotateCcw}
          label="Khôi phục cài đặt tốt nhất"
          confirmLabel="Khôi phục mọi thông số?"
          detail={
            draft.hasDrift
              ? 'Đưa thông số về cấu hình chuẩn cho thiết bị này.'
              : 'Bạn đang dùng đúng cấu hình chuẩn.'
          }
          disabled={!draft.hasDrift}
          onConfirm={draft.restoreDefaults}
        />
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

function MetricCard({ label, value, unit }: { label: string; value: string; unit: string }) {
  const { s } = useUi();
  return (
    <View
      style={{
        flex: 1,
        minWidth: 0,
        borderRadius: s(10),
        backgroundColor: appleColors.card,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: appleColors.cardBorder,
        paddingHorizontal: s(12),
        paddingVertical: s(10),
      }}
    >
      <T size={9.4} weight="semibold" color={appleColors.textSecondary} tracking={0.06}>
        {label.toUpperCase()}
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: s(3), marginTop: s(4) }}>
        <T size={17} weight="semibold" color={appleColors.text} tabular>
          {value}
        </T>
        <T size={9.8} color={appleColors.textTertiary}>
          {unit}
        </T>
      </View>
    </View>
  );
}

export function NetworkPage({ draft, settings, notify }: PageProps & { notify: Notify }) {
  const { s } = useUi();
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<NetworkResult | null>(null);

  const runTest = async () => {
    if (testing) return;
    setTesting(true);
    try {
      setResult(await measureNetwork(draft.deviceClass));
    } catch (error) {
      notify('error', 'Không kiểm tra được kết nối', friendlyError(error, 'Vui lòng thử lại sau ít phút.'));
    } finally {
      setTesting(false);
    }
  };

  const recommended = result?.recommendation.profile;
  const region = REGION_META[settings.region];

  return (
    <>
      <SettingsGroup title="Vị trí máy chủ">
        <InfoRow
          label="Khu vực đang xem"
          value={
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              <T size={14}>{region.flag}</T>
              <T size={12.6} color={appleColors.textSecondary}>
                {region.label}
              </T>
            </View>
          }
        />
      </SettingsGroup>

      <SettingsGroup
        title="Kiểm tra kết nối"
        footer="Đo ping, jitter, tỷ lệ mất gói (packet loss) và băng thông khả dụng."
      >
        <ActionRow
          icon={RadioTower}
          iconBg={appleColors.blue}
          tone="accent"
          busy={testing}
          label={testing ? 'Đang đo kết nối…' : result ? 'Kiểm tra lại' : 'Kiểm tra mạng'}
          detail="Đánh giá chất lượng đường truyền tới máy chủ"
          onPress={() => void runTest()}
        />
      </SettingsGroup>

      {result ? (
        <View style={{ marginTop: s(16) }}>
          <View style={{ flexDirection: 'row', gap: s(8) }}>
            <MetricCard label="Ping" value={result.ping.toFixed(0)} unit="ms" />
            <MetricCard label="Jitter" value={result.jitter.toFixed(1)} unit="ms" />
            <MetricCard label="Mất gói" value={result.loss.toFixed(1)} unit="%" />
            <MetricCard label="Băng thông" value={result.bandwidth.toFixed(0)} unit="Mbps" />
          </View>

          <View
            style={{
              marginTop: s(10),
              padding: s(14),
              borderRadius: s(10),
              backgroundColor: 'rgba(31, 111, 235, 0.12)',
              borderWidth: StyleSheet.hairlineWidth,
              borderColor: 'rgba(102, 168, 255, 0.28)',
              flexDirection: 'row',
              alignItems: 'center',
              gap: s(12),
            }}
          >
            <View style={{ flex: 1 }}>
              <T size={12.8} weight="semibold" color={appleColors.blue}>
                {result.recommendation.title}
              </T>
              <T size={10.4} color={appleColors.textSecondary} leading={1.4} style={{ marginTop: s(2) }}>
                {result.recommendation.detail}
              </T>
            </View>
            {recommended && recommended !== settings.profile ? (
              <PillButton tone="accent" onPress={() => draft.selectProfile(recommended)}>
                {`Dùng ${PROFILE_META[recommended].label}`}
              </PillButton>
            ) : (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
                <Check size={s(15)} color={appleColors.blue} strokeWidth={2.4} />
                <T size={11} weight="medium" color={appleColors.blue}>
                  Đang dùng
                </T>
              </View>
            )}
          </View>
        </View>
      ) : null}
    </>
  );
}
