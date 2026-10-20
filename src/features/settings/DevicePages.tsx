// Trang Thiết bị / Tay cầm / Chuột / Bàn phím / Âm thanh theo ngôn ngữ thiết kế Apple.
// Thẻ Inset Grouped bo tròn viền mỏng, biểu tượng squircle bo góc mềm,
// công tắc xanh #34C759, thanh trượt xanh #007AFF, chữ đen nhãn phụ xám.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import {
  ArrowRight,
  BatteryFull,
  BatteryLow,
  BatteryMedium,
  Bluetooth,
  Gamepad2,
  Headphones,
  Plus,
  Vibrate,
} from 'lucide-react-native';
import {
  addListener,
  hasNativeInput,
  openBluetoothSettings,
  rumble,
  setCaptureMode,
  stopRumble,
  type NativeGamepadState,
} from 'jetsona-input';

import {
  DEVICE_KIND_ORDER,
  KIND_LABEL,
  requestBluetoothPermission,
  useInputDevices,
  type LocalDevice,
} from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { DEFAULT_INPUT_SETTINGS, keyCodeLabel, type HostShortcutAction } from '@/lib/input-settings';
import { useUiSounds } from '@/features/sound/UiSoundProvider';
import { alpha, type SettingsTokens, useTheme } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ActionRow, ChoiceRow, Keycap, PillButton, rowStyle, SettingsGroup, SliderRow, ToggleRow } from './controls';
import { useSuspendCursor } from '@/features/gamepad/hooks';
import { webCodeForKeyCode } from './keycodes';
import { useSettingsRestore } from './SettingsRestore';
import { HOST_SHORTCUT_OPTIONS, type InputSettingsState } from './useInputSettings';
import type { Notify } from './useStreamSettingsDraft';
import {
  Gamepad2DVisualizer,
  Keyboard2DVisualizer,
  Mouse2DVisualizer,
} from './visualizers';

function Battery({ value }: { value: number }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const percent = Math.round(value * 100);
  const low = percent <= 20;
  const Icon = low ? BatteryLow : percent < 70 ? BatteryMedium : BatteryFull;
  const color = low ? appleColors.orange : appleColors.textTertiary;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
      <Icon size={s(15)} color={color} strokeWidth={1.8} />
      <T size={10.4} weight="medium" color={color} tabular>
        {percent}%
      </T>
    </View>
  );
}

function deviceStatus(device: LocalDevice): string {
  if (device.kind === 'headset') {
    return device.bluetooth ? 'Bluetooth · Đang phát âm thanh stream' : 'Đang phát âm thanh stream';
  }
  return device.transport === 'unknown' ? 'Đã kết nối với iOS' : device.bluetooth ? 'Bluetooth' : 'Có dây / USB';
}

const DEVICE_COLORS: Record<string, keyof SettingsTokens> = {
  controller: 'red',
  keyboard: 'indigo',
  mouse: 'teal',
  headset: 'pink',
  display: 'gray',
};

function DeviceRow({ device }: { device: LocalDevice }) {
  const { settings: appleColors, colors } = useTheme();
  const { s } = useUi();
  const Icon = KIND_ICONS[device.kind];
  const bg = appleColors[DEVICE_COLORS[device.kind] ?? 'gray'];
  return (
    <View style={rowStyle(s, { minHeight: s(50) })}>
      <View
        style={{
          width: s(28),
          height: s(28),
          borderRadius: s(7),
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={s(15)} color="#FFFFFF" strokeWidth={2.2} />
        <View
          style={{
            position: 'absolute',
            width: s(8),
            height: s(8),
            borderRadius: s(4),
            right: -s(1),
            bottom: -s(1),
            borderWidth: 1.5,
            borderColor: alpha(colors.card, 0.95),
            backgroundColor: appleColors.green,
          }}
        />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={13} weight="regular" color={appleColors.text} numberOfLines={1}>
          {device.name}
        </T>
        <T size={10.4} color={appleColors.textTertiary} numberOfLines={1} style={{ marginTop: s(1.5) }}>
          {KIND_LABEL[device.kind]} · {deviceStatus(device)}
        </T>
      </View>
      {device.battery !== null ? <Battery value={device.battery} /> : null}
    </View>
  );
}

export function DevicesPage({ notify }: { notify: Notify }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const { devices, bluetooth, refresh } = useInputDevices();
  const [asking, setAsking] = useState(false);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sorted = [...devices].sort(
    (a, b) => DEVICE_KIND_ORDER.indexOf(a.kind) - DEVICE_KIND_ORDER.indexOf(b.kind)
  );

  return (
    <>
      <SettingsGroup
        title="Đang kết nối"
        footer="Thiết bị ngoại vi được kết nối trực tiếp với thiết bị này qua cáp hoặc Bluetooth."
      >
        {sorted.length ? (
          sorted.map((device) => <DeviceRow key={device.id} device={device} />)
        ) : (
          <View style={{ paddingHorizontal: s(16), paddingVertical: s(14) }}>
            <T size={11} color={appleColors.textTertiary}>
              {hasNativeInput
                ? Platform.OS === 'ios'
                  ? 'Chưa nhận được phụ kiện từ iOS. Kiểm tra phụ kiện đã kết nối trong Cài đặt > Bluetooth, rồi quay lại Jetsona. Tai nghe chỉ hiện khi được chọn làm đầu ra âm thanh.'
                  : 'Chưa có thiết bị ngoại vi nào đang nối với máy này.'
                : 'Bản cài đặt thiếu module nhận thiết bị (JetsonaInput). Cần build và cài lại ứng dụng có module này.'}
            </T>
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup title="Bluetooth">
        <ActionRow
          icon={Bluetooth}
          iconBg={appleColors.blue}
            label={bluetooth.stateKnown === false ? 'Ghép đôi phụ kiện trong Cài đặt iOS' : bluetooth.enabled ? 'Mở cài đặt Bluetooth' : 'Bluetooth đang tắt'}
          detail={
              bluetooth.stateKnown === false
                ? 'Mở Cài đặt hệ thống > Bluetooth để ghép đôi, sau đó quay lại Jetsona'
                : !bluetooth.supported
              ? 'Máy này không hỗ trợ Bluetooth.'
              : bluetooth.enabled
                ? 'Ghép đôi tay cầm, bàn phím, chuột hoặc tai nghe mới'
                : 'Bật Bluetooth để kết nối phụ kiện không dây'
          }
          disabled={!bluetooth.supported}
          onPress={() => openBluetoothSettings()}
        />
        {bluetooth.supported && !bluetooth.permitted ? (
          <ActionRow
            icon={Gamepad2}
            iconBg={appleColors.indigo}
            busy={asking}
            label="Cho phép đọc thiết bị đã ghép đôi"
            detail="Nhận biết chính xác tên tay cầm Bluetooth"
            onPress={() => {
              setAsking(true);
              void requestBluetoothPermission()
                .then((granted) => {
                  if (!granted)
                    notify('info', 'Chưa cấp quyền Bluetooth', 'Tay cầm vẫn dùng được, chỉ không hiện nhãn Bluetooth.');
                  return refresh();
                })
                .finally(() => setAsking(false));
            }}
          />
        ) : null}
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- tay cầm

const BUTTON_FLAGS: [number, string][] = [
  [0x1000, 'A'],
  [0x2000, 'B'],
  [0x4000, 'X'],
  [0x8000, 'Y'],
  [0x0100, 'LB'],
  [0x0200, 'RB'],
  [0x0020, 'Back'],
  [0x0010, 'Start'],
  [0x0040, 'L3'],
  [0x0080, 'R3'],
  [0x0001, '↑'],
  [0x0002, '↓'],
  [0x0004, '←'],
  [0x0008, '→'],
];

function Bar({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const ratio = signed ? (value + 1) / 2 : value;
  return (
    <View style={{ flex: 1, gap: s(3) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={9.4} color={appleColors.textSecondary}>
          {label}
        </T>
        <T size={9.4} color={appleColors.textTertiary} tabular>
          {value.toFixed(2)}
        </T>
      </View>
      <View
        style={{
          height: s(6),
          borderRadius: s(3),
          backgroundColor: 'rgba(255, 255, 255, 0.08)',
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          overflow: 'hidden',
        }}
      >
        <View
          style={{
            width: `${Math.max(0, Math.min(1, ratio)) * 100}%`,
            height: '100%',
            backgroundColor: appleColors.blue,
            borderRadius: s(3),
          }}
        />
      </View>
    </View>
  );
}

function ControllerInspector({
  layout = 'xbox',
  leftDeadzone = 0.08,
  rightDeadzone = 0.08,
  triggerDeadzone = 0.05,
}: {
  layout?: 'auto' | 'xbox' | 'playstation' | 'nintendo';
  leftDeadzone?: number;
  rightDeadzone?: number;
  triggerDeadzone?: number;
}) {
  const { settings: appleColors, colors } = useTheme();
  const { s } = useUi();
  const [state, setState] = useState<NativeGamepadState | null>(null);
  const [viewMode, setViewMode] = useState<'2d' | 'classic'>('2d');
  const [showCallouts, setShowCallouts] = useState(true);
  const latest = useRef<NativeGamepadState | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    const off = addListener('onGamepadState', (next) => {
      latest.current = next;
      if (frame.current != null) return;
      frame.current = requestAnimationFrame(() => {
        frame.current = null;
        setState(latest.current);
      });
    });
    return () => {
      off();
      if (frame.current != null) cancelAnimationFrame(frame.current);
    };
  }, []);

  return (
    <View style={{ paddingHorizontal: s(14), paddingVertical: s(10), gap: s(10) }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T size={10.5} color={appleColors.textSecondary}>
          {state ? 'Đang nhận tín hiệu trực tiếp từ tay cầm' : 'Bấm nút hoặc gạt cần trên tay cầm để xem phản hồi'}
        </T>
        <View style={{ flexDirection: 'row', gap: s(6) }}>
          <PillButton
            tone={viewMode === '2d' ? 'accent' : 'default'}
            onPress={() => setViewMode(viewMode === '2d' ? 'classic' : '2d')}
          >
            {viewMode === '2d' ? 'Bảng tín hiệu' : 'Mô hình 2D'}
          </PillButton>
          {viewMode === '2d' ? (
            <PillButton
              tone={showCallouts ? 'accent' : 'default'}
              onPress={() => setShowCallouts((v) => !v)}
            >
              {showCallouts ? 'Ẩn chú thích' : 'Hiện chú thích'}
            </PillButton>
          ) : null}
        </View>
      </View>

      {viewMode === '2d' ? (
        <Gamepad2DVisualizer
          state={state}
          layout={layout}
          leftDeadzone={leftDeadzone}
          rightDeadzone={rightDeadzone}
          triggerDeadzone={triggerDeadzone}
          showCallouts={showCallouts}
        />
      ) : (
        <View style={{ gap: s(10) }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(5) }}>
            {BUTTON_FLAGS.map(([flag, label]) => {
              const on = ((state?.buttons ?? 0) & flag) !== 0;
              return (
                <View
                  key={label}
                  style={{
                    minWidth: s(34),
                    height: s(24),
                    paddingHorizontal: s(6),
                    borderRadius: s(6),
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: on ? alpha(colors.primary, 0.28) : 'rgba(255, 255, 255, 0.08)',
                    borderWidth: 1,
                    borderColor: on ? alpha(colors.accent, 0.45) : 'rgba(255, 255, 255, 0.12)',
                  }}
                >
                  <T size={10} weight="semibold" color={on ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)'}>
                    {label}
                  </T>
                </View>
              );
            })}
            {[
              { label: 'LT', on: (state?.lt ?? 0) >= 0.5 },
              { label: 'RT', on: (state?.rt ?? 0) >= 0.5 },
            ].map(({ label, on }) => (
              <View
                key={label}
                style={{
                  minWidth: s(34),
                  height: s(24),
                  paddingHorizontal: s(6),
                  borderRadius: s(6),
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: on ? alpha(colors.primary, 0.28) : 'rgba(255, 255, 255, 0.08)',
                  borderWidth: 1,
                  borderColor: on ? alpha(colors.accent, 0.45) : 'rgba(255, 255, 255, 0.12)',
                }}
              >
                <T size={10} weight="semibold" color={on ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)'}>
                  {label}
                </T>
              </View>
            ))}
          </View>
          <View style={{ flexDirection: 'row', gap: s(10) }}>
            <Bar label="Cần trái X" value={state?.lx ?? 0} signed />
            <Bar label="Cần trái Y" value={state?.ly ?? 0} signed />
            <Bar label="Cần phải X" value={state?.rx ?? 0} signed />
            <Bar label="Cần phải Y" value={state?.ry ?? 0} signed />
          </View>
        </View>
      )}
    </View>
  );
}

export function ControllerPage({ input }: { input: InputSettingsState }) {
  const { settings: appleColors } = useTheme();
  const { settings, update } = input;
  const { devices } = useInputDevices();
  const pads = devices.filter((device) => device.kind === 'controller');
  const testing = useRef<number | null>(null);

  useSuspendCursor();
  useEffect(
    () => () => {
      if (testing.current != null) stopRumble(testing.current);
    },
    []
  );

  const testRumble = useCallback(() => {
    const target = pads.find((pad) => pad.rumble) ?? pads[0];
    if (!target) return;
    testing.current = target.nativeId;
    rumble(target.nativeId, settings.vibrationStrength / 100, settings.vibrationStrength / 100, 400);
  }, [pads, settings.vibrationStrength]);

  useSettingsRestore(() => {
    update('controllerLayout', DEFAULT_INPUT_SETTINGS.controllerLayout);
    update('vibrationEnabled', DEFAULT_INPUT_SETTINGS.vibrationEnabled);
    update('vibrationStrength', DEFAULT_INPUT_SETTINGS.vibrationStrength);
    update('leftDeadzone', DEFAULT_INPUT_SETTINGS.leftDeadzone);
    update('rightDeadzone', DEFAULT_INPUT_SETTINGS.rightDeadzone);
    update('triggerDeadzone', DEFAULT_INPUT_SETTINGS.triggerDeadzone);
  });

  return (
    <>
      <SettingsGroup title={pads.length ? `Tay cầm đang nối (${pads.length})` : 'Tay cầm'}>
        {pads.length ? (
          pads.map((pad) => <DeviceRow key={pad.id} device={pad} />)
        ) : (
          <View style={{ paddingHorizontal: 16, paddingVertical: 12 }}>
            <T size={11} color={appleColors.textTertiary} leading={1.4}>
              Chưa có tay cầm kết nối. Ghép đôi tay cầm Bluetooth trong cài đặt máy rồi quay lại đây.
            </T>
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup title="Kiểm tra tín hiệu">
        <ControllerInspector
          layout={settings.controllerLayout}
          leftDeadzone={settings.leftDeadzone}
          rightDeadzone={settings.rightDeadzone}
          triggerDeadzone={settings.triggerDeadzone}
        />
      </SettingsGroup>

      <SettingsGroup title="Bố cục nút">
        <ChoiceRow
          label="Bố cục"
          value={settings.controllerLayout}
          options={[
            { value: 'auto', label: 'Tự động', description: 'Theo nguyên bản tay cầm báo' },
            { value: 'xbox', label: 'Xbox', description: 'A ở dưới, B ở bên phải' },
            { value: 'playstation', label: 'PlayStation', description: 'Nút theo vị trí Xbox' },
            { value: 'nintendo', label: 'Nintendo', description: 'Đổi chỗ A/B và X/Y' },
          ]}
          onChange={(value) => update('controllerLayout', value)}
        />
      </SettingsGroup>

      <SettingsGroup title="Rung phản hồi">
        <ToggleRow
          label="Rung theo game"
          detail="Nhận lệnh rung phản hồi từ PC và kích hoạt motor rung"
          checked={settings.vibrationEnabled}
          onChange={(value) => update('vibrationEnabled', value)}
        />
        {settings.vibrationEnabled ? (
          <SliderRow
            label="Độ mạnh rung"
            value={settings.vibrationStrength}
            min={0}
            max={100}
            step={5}
            format={(value) => `${value}%`}
            onChange={(value) => update('vibrationStrength', value)}
          />
        ) : null}
        <ActionRow
          icon={Vibrate}
          iconBg={appleColors.orange}
          label="Thử rung"
          detail={pads.some((pad) => pad.rumble) ? 'Rung tay cầm 0,4 giây' : 'Tay cầm không báo hỗ trợ rung'}
          disabled={!pads.length}
          onPress={testRumble}
        />
      </SettingsGroup>

      <SettingsGroup title="Vùng chết cần gạt">
        <SliderRow
          label="Cần trái"
          value={settings.leftDeadzone}
          min={0}
          max={0.5}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => update('leftDeadzone', value)}
        />
        <SliderRow
          label="Cần phải"
          value={settings.rightDeadzone}
          min={0}
          max={0.5}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => update('rightDeadzone', value)}
        />
        <SliderRow
          label="Cò (Triggers)"
          value={settings.triggerDeadzone}
          min={0}
          max={0.5}
          step={0.01}
          format={(value) => `${Math.round(value * 100)}%`}
          onChange={(value) => update('triggerDeadzone', value)}
        />
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- chuột

export function MousePage({ input }: { input: InputSettingsState }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const { settings, update } = input;
  const { devices } = useInputDevices();
  const mice = devices.filter((device) => device.kind === 'mouse');
  const isDefault =
    settings.mouseSensitivity === DEFAULT_INPUT_SETTINGS.mouseSensitivity &&
    settings.scrollSensitivity === DEFAULT_INPUT_SETTINGS.scrollSensitivity &&
    settings.invertScroll === DEFAULT_INPUT_SETTINGS.invertScroll;

  useSettingsRestore(() => {
    update('mouseSensitivity', DEFAULT_INPUT_SETTINGS.mouseSensitivity);
    update('scrollSensitivity', DEFAULT_INPUT_SETTINGS.scrollSensitivity);
    update('invertScroll', DEFAULT_INPUT_SETTINGS.invertScroll);
  }, { disabled: isDefault });

  return (
    <>
      <SettingsGroup title={mice.length ? `Chuột đang nối (${mice.length})` : 'Chuột'}>
        {mice.length ? (
          mice.map((mouse) => <DeviceRow key={mouse.id} device={mouse} />)
        ) : (
          <View style={{ paddingHorizontal: s(16), paddingVertical: s(12) }}>
            <T size={11} color={appleColors.textTertiary} leading={1.4}>
              Chưa phát hiện chuột vật lý kết nối. Bạn có thể thử nghiệm trực tiếp trên mô hình 2D bên dưới.
            </T>
          </View>
        )}
      </SettingsGroup>

      <SettingsGroup title="Kiểm tra tín hiệu & con trỏ">
        <View style={{ padding: s(12) }}>
          <Mouse2DVisualizer sensitivity={settings.mouseSensitivity} />
        </View>
      </SettingsGroup>

      <SettingsGroup title="Con trỏ & cuộn">
        <SliderRow
          label="Tốc độ con trỏ"
          value={settings.mouseSensitivity}
          min={0.25}
          max={2.5}
          step={0.05}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(value) => update('mouseSensitivity', value)}
        />
        <SliderRow
          label="Tốc độ cuộn"
          value={settings.scrollSensitivity}
          min={0.25}
          max={3}
          step={0.05}
          format={(value) => `${value.toFixed(2)}×`}
          onChange={(value) => update('scrollSensitivity', value)}
        />
        <ToggleRow
          label="Đảo chiều cuộn tự nhiên"
          detail="Cuộn theo phong cách Mac: vuốt lên để nội dung di chuyển lên"
          checked={settings.invertScroll}
          onChange={(value) => update('invertScroll', value)}
        />
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- bàn phím

function KeyCapture({
  value,
  placeholder,
  onCapture,
}: {
  value: string;
  placeholder: string;
  onCapture: (code: string) => void;
}) {
  const { colors, settings: appleColors } = useTheme();
  const { s } = useUi();
  const [listening, setListening] = useState(false);

  useEffect(() => {
    if (!listening) return;
    setCaptureMode('stream');
    const off = addListener('onKey', (event) => {
      if (!event.down) return;
      const code = webCodeForKeyCode(event.keyCode);
      if (!code) return;
      onCapture(code);
      setListening(false);
    });
    return () => {
      off();
      setCaptureMode('ui');
    };
  }, [listening, onCapture]);

  return (
    <Press
      onPress={() => setListening((current) => !current)}
      pressScale={0.97}
      style={{
        height: s(28),
        minWidth: s(84),
        paddingHorizontal: s(10),
        borderRadius: s(7),
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: listening ? alpha(colors.accent, 0.45) : 'rgba(255, 255, 255, 0.18)',
        backgroundColor: listening ? alpha(colors.primary, 0.22) : 'rgba(255, 255, 255, 0.08)',
        overflow: 'hidden',
      }}
    >
      <T
        size={10.4}
        weight="semibold"
        color={listening ? colors.accentSoft : value ? appleColors.text : appleColors.textTertiary}
      >
        {listening ? 'Nhấn một phím…' : value ? keyCodeLabel(value) : placeholder}
      </T>
    </Press>
  );
}

const ACTION_LABEL = Object.fromEntries(
  HOST_SHORTCUT_OPTIONS.map((option) => [option.value, option.label])
) as Record<HostShortcutAction, string>;

function ActionPicker({
  value,
  onChange,
}: {
  value: HostShortcutAction;
  onChange: (action: HostShortcutAction) => void;
}) {
  const { colors } = useTheme();
  const { s } = useUi();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(4) }}>
      {HOST_SHORTCUT_OPTIONS.map((option) => {
        const active = option.value === value;
        return (
          <Press
            key={option.value}
            onPress={() => onChange(option.value)}
            pressScale={0.98}
            style={{
              width: '49%',
              minHeight: s(34),
              justifyContent: 'center',
              paddingHorizontal: s(10),
              paddingVertical: s(6),
              borderRadius: s(8),
              backgroundColor: active ? alpha(colors.primary, 0.28) : 'rgba(255, 255, 255, 0.07)',
              borderWidth: 1,
              borderColor: active ? alpha(colors.accent, 0.45) : 'rgba(255, 255, 255, 0.12)',
            }}
          >
            <T
              size={10.6}
              weight={active ? 'semibold' : 'regular'}
              color={active ? '#FFFFFF' : 'rgba(255, 255, 255, 0.75)'}
            >
              {option.label}
            </T>
          </Press>
        );
      })}
    </View>
  );
}

export function KeyboardPage({ input, notify }: { input: InputSettingsState; notify: Notify }) {
  const { settings: appleColors, colors } = useTheme();
  const { s } = useUi();
  const { settings, update } = input;
  const { devices } = useInputDevices();
  const hasKeyboard = devices.some((device) => device.kind === 'keyboard');
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [draftAction, setDraftAction] = useState<HostShortcutAction>('exit');
  const [remapSource, setRemapSource] = useState('');
  const [remapTarget, setRemapTarget] = useState('');
  const shortcuts = Object.entries(settings.hostShortcuts);
  const remaps = Object.entries(settings.keyboardRemaps);
  const hostLabel = keyCodeLabel(settings.hostKey);

  const usableCode = useCallback(
    (code: string) => {
      if (code === settings.hostKey) {
        notify('info', `${hostLabel} là phím giữ`, 'Chọn một phím khác cho tổ hợp.');
        return false;
      }
      if (code === 'Escape') {
        notify('info', 'Esc được giữ làm phím an toàn', 'Chọn một phím khác cho tổ hợp.');
        return false;
      }
      return true;
    },
    [hostLabel, notify, settings.hostKey]
  );

  const rebind = (previous: string, code: string) => {
    if (!usableCode(code) || code === previous) return;
    const next = { ...settings.hostShortcuts };
    const action = next[previous];
    if (!action) return;
    delete next[previous];
    next[code] = action;
    update('hostShortcuts', next);
    setOpenCode(code);
  };

  useSettingsRestore(() => {
    update('hostKey', DEFAULT_INPUT_SETTINGS.hostKey);
    update('hostShortcuts', DEFAULT_INPUT_SETTINGS.hostShortcuts);
    update('keyboardRemaps', {});
    setOpenCode(null);
  });

  return (
    <>
      <SettingsGroup title="Kiểm tra tín hiệu bàn phím">
        <View style={{ padding: s(12) }}>
          <Keyboard2DVisualizer />
        </View>
      </SettingsGroup>

      {!hasKeyboard ? (
        <View
          style={{
            marginHorizontal: s(14),
            marginBottom: s(8),
            padding: s(12),
            borderRadius: s(12),
            backgroundColor: alpha(colors.card, 0.65),
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.12)',
          }}
        >
          <T size={10.8} color={appleColors.textSecondary} leading={1.4}>
            Chưa phát hiện bàn phím vật lý kết nối. Bạn có thể thử nghiệm trực tiếp trên mô hình 2D bàn phím ở trên.
          </T>
        </View>
      ) : null}

      <SettingsGroup title="Phím tắt điều khiển stream">
        {shortcuts.map(([code, action]) => {
          const open = openCode === code;
          return (
            <View key={code}>
              <Press
                onPress={() => setOpenCode(open ? null : code)}
                pressScale={0.995}
                focusVariant="row"
                style={rowStyle(s, {
                  minHeight: s(48),
                  backgroundColor: open ? alpha(colors.bg, 0.82) : 'transparent',
                })}
              >
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
                  <Keycap>{hostLabel}</Keycap>
                  <T size={10} color={appleColors.textTertiary}>
                     +
                  </T>
                  <Keycap accent>{keyCodeLabel(code)}</Keycap>
                </View>
                <T size={12.4} color={appleColors.textSecondary} numberOfLines={1}>
                  {ACTION_LABEL[action]}
                </T>
              </Press>
              {open ? (
                <View
                  style={{
                    paddingHorizontal: s(14),
                    paddingBottom: s(12),
                    paddingTop: s(4),
                    gap: s(8),
                    backgroundColor: alpha(colors.bg, 0.82),
                    borderTopWidth: StyleSheet.hairlineWidth,
                    borderTopColor: 'rgba(255, 255, 255, 0.08)',
                  }}
                >
                  <ActionPicker
                    value={action}
                    onChange={(next) =>
                      update('hostShortcuts', { ...settings.hostShortcuts, [code]: next })
                    }
                  />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                    <T size={10.4} color={appleColors.textSecondary}>
                      Phím:
                    </T>
                    <KeyCapture
                      value={code}
                      placeholder="Chọn phím"
                      onCapture={(next) => rebind(code, next)}
                    />
                    <View style={{ flex: 1 }} />
                    <PillButton
                      tone="danger"
                      onPress={() => {
                        const next = { ...settings.hostShortcuts };
                        delete next[code];
                        update('hostShortcuts', next);
                        setOpenCode(null);
                      }}
                    >
                      Xóa
                    </PillButton>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        {adding ? (
          <View
            style={{
              paddingHorizontal: s(14),
              paddingVertical: s(12),
              gap: s(8),
              backgroundColor: alpha(colors.bg, 0.82),
              borderTopWidth: StyleSheet.hairlineWidth,
              borderTopColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(5) }}>
              <Keycap>{hostLabel}</Keycap>
              <T size={10} color={appleColors.textTertiary}>
                +
              </T>
              <KeyCapture
                value={draftCode}
                placeholder="Chọn phím"
                onCapture={(code) => {
                  if (usableCode(code)) setDraftCode(code);
                }}
              />
            </View>
            <ActionPicker value={draftAction} onChange={setDraftAction} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(8) }}>
              <PillButton
                onPress={() => {
                  setAdding(false);
                  setDraftCode('');
                }}
              >
                Hủy
              </PillButton>
              <PillButton
                tone="accent"
                disabled={!draftCode}
                onPress={() => {
                  update('hostShortcuts', { ...settings.hostShortcuts, [draftCode]: draftAction });
                  setDraftCode('');
                  setAdding(false);
                }}
              >
                Thêm phím tắt
              </PillButton>
            </View>
          </View>
        ) : (
          <ActionRow
            icon={Plus}
            iconBg={appleColors.green}
            tone="accent"
            label="Thêm phím tắt mới"
            onPress={() => {
              setAdding(true);
              setOpenCode(null);
            }}
          />
        )}
      </SettingsGroup>

      <SettingsGroup title="Đổi phím gửi sang PC">
        {remaps.map(([source, target]) => (
          <View
            key={source}
            style={rowStyle(s, {
              minHeight: s(46),
              gap: s(8),
            })}
          >
            <Keycap>{keyCodeLabel(source)}</Keycap>
            <ArrowRight size={s(13)} color={appleColors.chevron} />
            <Keycap accent>{keyCodeLabel(target)}</Keycap>
            <View style={{ flex: 1 }} />
            <PillButton
              tone="danger"
              onPress={() => {
                const next = { ...settings.keyboardRemaps };
                delete next[source];
                update('keyboardRemaps', next);
              }}
            >
              Xóa
            </PillButton>
          </View>
        ))}
        <View
          style={rowStyle(s, {
            minHeight: s(48),
            flexWrap: 'wrap',
            gap: s(8),
          })}
        >
          <KeyCapture value={remapSource} placeholder="Phím nhấn" onCapture={setRemapSource} />
          <ArrowRight size={s(13)} color={appleColors.chevron} />
          <KeyCapture value={remapTarget} placeholder="Gửi thành" onCapture={setRemapTarget} />
          <View style={{ flex: 1 }} />
          <PillButton
            tone="accent"
            disabled={!remapSource || !remapTarget || remapSource === remapTarget}
            onPress={() => {
              if (remapSource === settings.hostKey) {
                notify('info', 'Phím giữ không đổi được', 'Chọn một phím nguồn khác.');
                return;
              }
              update('keyboardRemaps', { ...settings.keyboardRemaps, [remapSource]: remapTarget });
              setRemapSource('');
              setRemapTarget('');
            }}
          >
            Thêm
          </PillButton>
        </View>
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- âm thanh

export function AudioPage({ input }: { input: InputSettingsState }) {
  const { settings: appleColors } = useTheme();
  const { s } = useUi();
  const uiSounds = useUiSounds();
  const { settings, update } = input;
  const { devices } = useInputDevices();
  const headsets = devices.filter((device) => device.kind === 'headset');

  useSettingsRestore(() => {
    update('audioVolume', 100);
    update('audioMuted', false);
  }, { disabled: settings.audioVolume === 100 && !settings.audioMuted });

  return (
    <>
      <SettingsGroup title="Âm thanh hệ thống ứng dụng">
        <ToggleRow
          label="Âm thanh điều hướng"
          detail="Phát tiếng nhẹ khi di chuyển, chọn mục và xác nhận thao tác"
          checked={uiSounds.enabled}
          onChange={uiSounds.setEnabled}
        />
        <SliderRow
          label="Âm lượng hiệu ứng"
          detail="Âm lượng tiếng bấm độc lập với âm thanh trò chơi"
          value={Math.round(uiSounds.volume * 100)}
          min={0}
          max={100}
          step={5}
          format={(value) => `${value}%`}
          onChange={(value) => {
            uiSounds.setVolume(value / 100);
            setTimeout(() => uiSounds.play('confirm'), 0);
          }}
        />
      </SettingsGroup>

      <SettingsGroup title="Âm thanh truyền từ PC">
        <View style={rowStyle(s, { minHeight: s(48) })}>
          <View
            style={{
              width: s(28),
              height: s(28),
              borderRadius: s(7),
              backgroundColor: appleColors.pink,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Headphones size={s(15)} color="#FFFFFF" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={13} weight="regular" color={appleColors.text}>
              Thiết bị đầu ra
            </T>
            <T size={10.4} color={appleColors.textTertiary} style={{ marginTop: s(1.5) }}>
              {headsets.length ? headsets.map((device) => device.name).join(', ') : 'Loa ngoài thiết bị'}
            </T>
          </View>
        </View>
        <SliderRow
          label="Âm lượng stream"
          value={settings.audioVolume}
          min={0}
          max={100}
          step={1}
          format={(value) => `${value}%`}
          onChange={(value) => update('audioVolume', value)}
        />
        <ToggleRow
          label="Tắt tiếng"
          detail="Chỉ tắt âm thanh phát ra tại thiết bị này"
          checked={settings.audioMuted}
          onChange={(value) => update('audioMuted', value)}
        />
      </SettingsGroup>
    </>
  );
}
