// Trang Thiết bị / Tay cầm / Chuột / Bàn phím / Âm thanh của Cài đặt.
// Danh sách thiết bị đến từ module native (InputManager + AudioManager +
// Bluetooth) và tự cập nhật bằng sự kiện khi cắm/rút/nối — không hỏi thăm.

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  ArrowRight, BatteryFull, BatteryLow, BatteryMedium, Bluetooth, Gamepad2, Headphones, Plus, RotateCcw, Vibrate,
} from 'lucide-react-native';
import {
  addListener, hasNativeInput, openBluetoothSettings, rumble, setCaptureMode, stopRumble, type NativeGamepadState,
} from 'jetsona-input';

import { DEVICE_KIND_ORDER, KIND_LABEL, requestBluetoothPermission, useInputDevices, type LocalDevice } from '@/features/devices/useInputDevices';
import { KIND_ICONS } from '@/features/devices/kindIcons';
import { DEFAULT_INPUT_SETTINGS, keyCodeLabel, type HostShortcutAction } from '@/lib/input-settings';
import { colors } from '@/theme';
import { Press } from '@/ui/Press';
import { useUi } from '@/ui/scale';
import { T } from '@/ui/Text';

import { ActionRow, ChoiceRow, Keycap, PillButton, SettingsGroup, SliderRow, ToggleRow } from './controls';
import { useSuspendCursor } from '@/features/gamepad/hooks';
import { webCodeForKeyCode } from './keycodes';
import { HOST_SHORTCUT_OPTIONS, type InputSettingsState } from './useInputSettings';
import type { Notify } from './useStreamSettingsDraft';

function Battery({ value }: { value: number }) {
  const { s } = useUi();
  const percent = Math.round(value * 100);
  const low = percent <= 20;
  const Icon = low ? BatteryLow : percent < 70 ? BatteryMedium : BatteryFull;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(4) }}>
      <Icon size={s(16)} color={low ? '#fcd34d' : 'rgba(255,255,255,0.55)'} strokeWidth={1.7} />
      <T size={10.2} weight="medium" color={low ? '#fcd34d' : 'rgba(255,255,255,0.55)'} tabular>{percent}%</T>
    </View>
  );
}

function deviceStatus(device: LocalDevice): string {
  if (device.kind === 'headset') return device.bluetooth ? 'Bluetooth · đang phát âm thanh stream' : 'Đang phát âm thanh stream';
  return device.bluetooth ? 'Bluetooth' : 'Có dây / USB';
}

function DeviceRow({ device }: { device: LocalDevice }) {
  const { s } = useUi();
  const Icon = KIND_ICONS[device.kind];
  return (
    <View style={{ minHeight: s(54), flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(12), paddingVertical: s(8) }}>
      <View style={[styles.deviceIcon, { width: s(36), height: s(36), borderRadius: s(12) }]}>
        <Icon size={s(18)} color="rgba(255,255,255,0.85)" strokeWidth={1.7} />
        <View style={[styles.onlineDot, { width: s(10), height: s(10), borderRadius: s(5), right: -s(2), bottom: -s(2) }]} />
      </View>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T size={12.8} color="rgba(255,255,255,0.9)" numberOfLines={1}>{device.name}</T>
        <T size={10.2} color="rgba(255,255,255,0.42)" numberOfLines={1} style={{ marginTop: s(2) }}>{KIND_LABEL[device.kind]} · {deviceStatus(device)}</T>
      </View>
      {device.battery !== null ? <Battery value={device.battery} /> : null}
    </View>
  );
}

export function DevicesPage({ notify }: { notify: Notify }) {
  const { s } = useUi();
  const { devices, bluetooth, refresh } = useInputDevices();
  const [asking, setAsking] = useState(false);

  // Mở trang là hỏi quyền Bluetooth một lần để biết tên thiết bị đã ghép đôi.
  useEffect(() => { void refresh(); }, [refresh]);

  const sorted = [...devices].sort((a, b) => DEVICE_KIND_ORDER.indexOf(a.kind) - DEVICE_KIND_ORDER.indexOf(b.kind));

  return (
    <>
      <SettingsGroup
        title="Đang kết nối"
        footnote="Tay cầm, bàn phím, chuột và tai nghe đang nối với máy này, cập nhật ngay khi bạn cắm hoặc rút."
      >
        {sorted.length ? sorted.map((device) => <DeviceRow key={device.id} device={device} />) : (
          <T size={11.2} color="rgba(255,255,255,0.45)" style={{ paddingHorizontal: s(12), paddingVertical: s(16) }}>
            {hasNativeInput ? 'Chưa có thiết bị nào đang nối với máy này.' : 'Bản này chưa đọc được thiết bị ngoại vi.'}
          </T>
        )}
      </SettingsGroup>

      <SettingsGroup
        title="Bluetooth"
        footnote="Ghép đôi hay ngắt kết nối thiết bị vẫn làm trong cài đặt Bluetooth của hệ thống; ghép xong, tay cầm tự hiện ở danh sách trên."
      >
        <ActionRow
          icon={Bluetooth}
          label={bluetooth.enabled ? 'Mở cài đặt Bluetooth' : 'Bluetooth đang tắt'}
          detail={!bluetooth.supported
            ? 'Máy này không có Bluetooth.'
            : bluetooth.enabled
              ? 'Ghép đôi tay cầm, bàn phím, chuột hoặc tai nghe mới'
              : 'Bật Bluetooth rồi ghép đôi tay cầm, bàn phím, chuột hoặc tai nghe'}
          disabled={!bluetooth.supported}
          onPress={() => openBluetoothSettings()}
        />
        {bluetooth.supported && !bluetooth.permitted ? (
          <ActionRow
            icon={Gamepad2}
            tone="accent"
            busy={asking}
            label="Cho phép đọc thiết bị đã ghép đôi"
            detail="Để biết tay cầm nào đang dùng Bluetooth. Không cần cho việc chơi game."
            onPress={() => {
              setAsking(true);
              void requestBluetoothPermission()
                .then((granted) => {
                  if (!granted) notify('info', 'Chưa cấp quyền Bluetooth', 'Tay cầm vẫn dùng được, chỉ không hiện nhãn Bluetooth.');
                  return refresh();
                })
                .finally(() => setAsking(false));
            }}
          />
        ) : null}
        {bluetooth.bonded.length ? (
          <View style={{ paddingHorizontal: s(12), paddingVertical: s(12) }}>
            <T size={9.6} weight="semibold" color={colors.text4} tracking={0.12}>ĐÃ GHÉP ĐÔI</T>
            <T size={10.8} color="rgba(255,255,255,0.55)" leading={1.6} style={{ marginTop: s(6) }}>
              {bluetooth.bonded.map((item) => item.name).join(' · ')}
            </T>
          </View>
        ) : null}
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- tay cầm

const BUTTON_FLAGS: Array<[number, string]> = [
  [0x1000, 'A'], [0x2000, 'B'], [0x4000, 'X'], [0x8000, 'Y'],
  [0x0100, 'LB'], [0x0200, 'RB'], [0x0020, 'Back'], [0x0010, 'Start'],
  [0x0040, 'L3'], [0x0080, 'R3'], [0x0001, '↑'], [0x0002, '↓'], [0x0004, '←'], [0x0008, '→'],
];

function Bar({ label, value, signed }: { label: string; value: number; signed?: boolean }) {
  const { s } = useUi();
  const ratio = signed ? (value + 1) / 2 : value;
  return (
    <View style={{ flex: 1, gap: s(4) }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <T size={9.2} color={colors.text4}>{label}</T>
        <T size={9.2} color={colors.text3} tabular>{value.toFixed(2)}</T>
      </View>
      <View style={{ height: s(6), borderRadius: s(3), backgroundColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' }}>
        <View style={{ width: `${Math.max(0, Math.min(1, ratio)) * 100}%`, height: '100%', backgroundColor: colors.accent }} />
      </View>
    </View>
  );
}

/** Đọc trực tiếp trạng thái tay cầm từ module native — để kiểm tra từng nút và cần có đúng không. */
function ControllerInspector() {
  const { s } = useUi();
  const [state, setState] = useState<NativeGamepadState | null>(null);
  const latest = useRef<NativeGamepadState | null>(null);
  const frame = useRef<number | null>(null);

  useEffect(() => {
    // Gom về một lần vẽ mỗi khung hình, dù tay cầm báo 125 lần/giây.
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

  if (!state) {
    return (
      <T size={11} color="rgba(255,255,255,0.45)" leading={1.5} style={{ paddingHorizontal: s(12), paddingVertical: s(14) }}>
        Bấm một nút hoặc gạt cần trên tay cầm để xem tín hiệu.
      </T>
    );
  }
  return (
    <View style={{ paddingHorizontal: s(12), paddingVertical: s(12), gap: s(12) }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: s(6) }}>
        {BUTTON_FLAGS.map(([flag, label]) => {
          const on = (state.buttons & flag) !== 0;
          return (
            <View
              key={label}
              style={{
                minWidth: s(34), height: s(26), paddingHorizontal: s(8), borderRadius: s(7), alignItems: 'center', justifyContent: 'center',
                borderWidth: 1, borderColor: on ? '#4c94ff' : 'rgba(255,255,255,0.14)', backgroundColor: on ? 'rgba(31,111,235,0.5)' : 'rgba(255,255,255,0.05)',
              }}
            >
              <T size={10.2} weight="semibold" color={on ? colors.white : 'rgba(255,255,255,0.5)'}>{label}</T>
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', gap: s(12) }}>
        <Bar label="Cần trái X" value={state.lx} signed />
        <Bar label="Cần trái Y" value={state.ly} signed />
        <Bar label="Cần phải X" value={state.rx} signed />
        <Bar label="Cần phải Y" value={state.ry} signed />
      </View>
      <View style={{ flexDirection: 'row', gap: s(12) }}>
        <Bar label="Cò trái (LT)" value={state.lt} />
        <Bar label="Cò phải (RT)" value={state.rt} />
      </View>
    </View>
  );
}

export function ControllerPage({ input }: { input: InputSettingsState }) {
  const { s } = useUi();
  const { settings, update } = input;
  const { devices } = useInputDevices();
  const pads = devices.filter((device) => device.kind === 'controller');
  const testing = useRef<number | null>(null);

  // Trang này đọc tín hiệu tay cầm thô nên con trỏ UI phải đứng yên (nút B vẫn quay lại được).
  useSuspendCursor();
  useEffect(() => () => {
    if (testing.current != null) stopRumble(testing.current);
  }, []);

  const testRumble = useCallback(() => {
    const target = pads.find((pad) => pad.rumble) ?? pads[0];
    if (!target) return;
    testing.current = target.nativeId;
    rumble(target.nativeId, settings.vibrationStrength / 100, settings.vibrationStrength / 100, 400);
  }, [pads, settings.vibrationStrength]);

  return (
    <>
      <SettingsGroup title={pads.length ? `Tay cầm đang nối (${pads.length})` : 'Tay cầm'}>
        {pads.length ? pads.map((pad) => <DeviceRow key={pad.id} device={pad} />) : (
          <T size={11.2} color="rgba(255,255,255,0.45)" leading={1.5} style={{ paddingHorizontal: s(12), paddingVertical: s(14) }}>
            Chưa có tay cầm. Ghép đôi tay cầm Bluetooth (ví dụ Rapoo V610M) trong cài đặt Bluetooth của máy rồi quay lại đây.
          </T>
        )}
      </SettingsGroup>

      <SettingsGroup title="Kiểm tra tín hiệu" footnote="Dữ liệu đọc trực tiếp từ Android, cùng thứ được gửi sang PC khi chơi.">
        <ControllerInspector />
      </SettingsGroup>

      <SettingsGroup title="Bố cục nút" footnote="Tay cầm kiểu Nintendo đổi chỗ A/B và X/Y so với Xbox; chọn đúng để nút trên PC khớp với nút bạn bấm.">
        <ChoiceRow
          label="Bố cục"
          value={settings.controllerLayout}
          options={[
            { value: 'auto', label: 'Tự động', description: 'Giữ nguyên như tay cầm báo' },
            { value: 'xbox', label: 'Xbox', description: 'A dưới, B phải' },
            { value: 'playstation', label: 'PlayStation', description: 'Nút theo vị trí Xbox' },
            { value: 'nintendo', label: 'Nintendo', description: 'Đổi chỗ A/B và X/Y' },
          ]}
          onChange={(value) => update('controllerLayout', value)}
        />
      </SettingsGroup>

      <SettingsGroup title="Rung">
        <ToggleRow label="Rung theo game" detail="Nhận lệnh rung từ PC và rung tay cầm." checked={settings.vibrationEnabled} onChange={(value) => update('vibrationEnabled', value)} />
        {settings.vibrationEnabled ? (
          <SliderRow label="Độ mạnh" value={settings.vibrationStrength} min={0} max={100} step={5} format={(value) => `${value}%`} onChange={(value) => update('vibrationStrength', value)} />
        ) : null}
        <ActionRow icon={Vibrate} label="Thử rung" detail={pads.some((pad) => pad.rumble) ? 'Rung tay cầm 0,4 giây' : 'Tay cầm này không báo hỗ trợ rung'} disabled={!pads.length} onPress={testRumble} />
      </SettingsGroup>

      <SettingsGroup title="Vùng chết" footnote="Bỏ qua chuyển động rất nhỏ của cần gạt để nhân vật không tự trôi.">
        <SliderRow label="Cần trái" value={settings.leftDeadzone} min={0} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update('leftDeadzone', value)} />
        <SliderRow label="Cần phải" value={settings.rightDeadzone} min={0} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update('rightDeadzone', value)} />
        <SliderRow label="Cò" value={settings.triggerDeadzone} min={0} max={0.5} step={0.01} format={(value) => `${Math.round(value * 100)}%`} onChange={(value) => update('triggerDeadzone', value)} />
      </SettingsGroup>

      <SettingsGroup>
        <ActionRow
          icon={RotateCcw}
          label="Khôi phục mặc định"
          onPress={() => {
            update('controllerLayout', DEFAULT_INPUT_SETTINGS.controllerLayout);
            update('vibrationEnabled', DEFAULT_INPUT_SETTINGS.vibrationEnabled);
            update('vibrationStrength', DEFAULT_INPUT_SETTINGS.vibrationStrength);
            update('leftDeadzone', DEFAULT_INPUT_SETTINGS.leftDeadzone);
            update('rightDeadzone', DEFAULT_INPUT_SETTINGS.rightDeadzone);
            update('triggerDeadzone', DEFAULT_INPUT_SETTINGS.triggerDeadzone);
          }}
        />
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- chuột

export function MousePage({ input }: { input: InputSettingsState }) {
  const { settings, update } = input;
  const isDefault = settings.mouseSensitivity === DEFAULT_INPUT_SETTINGS.mouseSensitivity
    && settings.scrollSensitivity === DEFAULT_INPUT_SETTINGS.scrollSensitivity
    && settings.invertScroll === DEFAULT_INPUT_SETTINGS.invertScroll;
  return (
    <>
      <SettingsGroup title="Con trỏ" footnote="Áp dụng cho chuột Bluetooth và cho thao tác chạm điều khiển PC, trước khi gửi sang máy tính.">
        <SliderRow label="Tốc độ con trỏ" value={settings.mouseSensitivity} min={0.25} max={2.5} step={0.05} format={(value) => `${value.toFixed(2)}×`} onChange={(value) => update('mouseSensitivity', value)} />
        <SliderRow label="Tốc độ cuộn" value={settings.scrollSensitivity} min={0.25} max={3} step={0.05} format={(value) => `${value.toFixed(2)}×`} onChange={(value) => update('scrollSensitivity', value)} />
        <ToggleRow label="Đảo chiều cuộn" detail="Cuộn kiểu trackpad Mac: vuốt lên để trang đi lên." checked={settings.invertScroll} onChange={(value) => update('invertScroll', value)} />
      </SettingsGroup>
      <SettingsGroup>
        <ActionRow
          icon={RotateCcw}
          label="Khôi phục mặc định"
          detail="Tốc độ 1.00×, không đảo chiều"
          disabled={isDefault}
          onPress={() => {
            update('mouseSensitivity', DEFAULT_INPUT_SETTINGS.mouseSensitivity);
            update('scrollSensitivity', DEFAULT_INPUT_SETTINGS.scrollSensitivity);
            update('invertScroll', DEFAULT_INPUT_SETTINGS.invertScroll);
          }}
        />
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- bàn phím

/** Chạm rồi nhấn một phím trên bàn phím thật: báo lại mã phím theo chuẩn web. */
function KeyCapture({ value, placeholder, onCapture }: { value: string; placeholder: string; onCapture: (code: string) => void }) {
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
      style={{
        height: s(32), minWidth: s(88), paddingHorizontal: s(12), borderRadius: s(8), alignItems: 'center', justifyContent: 'center', borderWidth: 1,
        borderStyle: !listening && !value ? 'dashed' : 'solid',
        borderColor: listening ? '#4c94ff' : value ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.2)',
        backgroundColor: listening ? 'rgba(31,111,235,0.24)' : value ? 'rgba(255,255,255,0.08)' : 'transparent',
      }}
    >
      <T size={10.6} weight="semibold" color={listening ? colors.white : value ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.5)'}>
        {listening ? 'Nhấn một phím…' : value ? keyCodeLabel(value) : placeholder}
      </T>
    </Press>
  );
}

const ACTION_LABEL = Object.fromEntries(HOST_SHORTCUT_OPTIONS.map((option) => [option.value, option.label])) as Record<HostShortcutAction, string>;

function ActionPicker({ value, onChange }: { value: HostShortcutAction; onChange: (action: HostShortcutAction) => void }) {
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
            style={{ width: '49%', minHeight: s(36), justifyContent: 'center', paddingHorizontal: s(10), paddingVertical: s(6), borderRadius: s(8), backgroundColor: active ? 'rgba(31,111,235,0.24)' : 'transparent' }}
          >
            <T size={10.8} weight={active ? 'semibold' : 'regular'} color={active ? colors.white : 'rgba(255,255,255,0.7)'}>{option.label}</T>
          </Press>
        );
      })}
    </View>
  );
}

export function KeyboardPage({ input, notify }: { input: InputSettingsState; notify: Notify }) {
  const { s } = useUi();
  const { settings, update } = input;
  const { devices } = useInputDevices();
  const hasKeyboard = devices.some((device) => device.kind === 'keyboard');
  const [openCode, setOpenCode] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [draftCode, setDraftCode] = useState('');
  const [draftAction, setDraftAction] = useState<HostShortcutAction>('topbar');
  const [remapSource, setRemapSource] = useState('');
  const [remapTarget, setRemapTarget] = useState('');
  const shortcuts = Object.entries(settings.hostShortcuts);
  const remaps = Object.entries(settings.keyboardRemaps);
  const hostLabel = keyCodeLabel(settings.hostKey);

  const usableCode = useCallback((code: string) => {
    if (code === settings.hostKey) { notify('info', `${hostLabel} là phím giữ`, 'Chọn một phím khác cho tổ hợp.'); return false; }
    if (code === 'Escape') { notify('info', 'Esc được giữ làm phím an toàn', 'Chọn một phím khác cho tổ hợp.'); return false; }
    return true;
  }, [hostLabel, notify, settings.hostKey]);

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

  return (
    <>
      {!hasKeyboard ? (
        <View style={[styles.notice, { marginHorizontal: s(12), marginBottom: s(12), padding: s(12), borderRadius: s(8) }]}>
          <T size={10.6} color="rgba(255,255,255,0.6)" leading={1.5}>
            Chưa có bàn phím thật. Gõ bằng bàn phím trên màn hình vẫn dùng được; cần nối bàn phím Bluetooth để gán phím mới. Phím tắt đã lưu dùng được khi có bàn phím.
          </T>
        </View>
      ) : null}

      <SettingsGroup
        title="Phím tắt trong lúc stream"
        footnote={`Giữ ${hostLabel} rồi nhấn phím. Tắt máy luôn hỏi lại trước khi gửi lệnh tới Windows.`}
      >
        {shortcuts.map(([code, action]) => {
          const open = openCode === code;
          return (
            <View key={code}>
              <Press onPress={() => setOpenCode(open ? null : code)} pressScale={0.995} style={{ minHeight: s(50), flexDirection: 'row', alignItems: 'center', gap: s(16), paddingHorizontal: s(12), paddingVertical: s(8), backgroundColor: open ? 'rgba(255,255,255,0.06)' : 'transparent' }}>
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
                  <Keycap>{hostLabel}</Keycap>
                  <T size={10.2} color="rgba(255,255,255,0.35)">+</T>
                  <Keycap accent>{keyCodeLabel(code)}</Keycap>
                </View>
                <T size={12} color={colors.text2} numberOfLines={1}>{ACTION_LABEL[action]}</T>
              </Press>
              {open ? (
                <View style={{ paddingHorizontal: s(12), paddingBottom: s(12), paddingTop: s(4), gap: s(8) }}>
                  <ActionPicker value={action} onChange={(next) => update('hostShortcuts', { ...settings.hostShortcuts, [code]: next })} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(8) }}>
                    <T size={10.2} color="rgba(255,255,255,0.45)">Phím</T>
                    <KeyCapture value={code} placeholder="Chọn phím" onCapture={(next) => rebind(code, next)} />
                    <View style={{ flex: 1 }} />
                    <PillButton tone="danger" onPress={() => {
                      const next = { ...settings.hostShortcuts };
                      delete next[code];
                      update('hostShortcuts', next);
                      setOpenCode(null);
                    }}
                    >
                      Xóa phím tắt
                    </PillButton>
                  </View>
                </View>
              ) : null}
            </View>
          );
        })}

        {adding ? (
          <View style={{ paddingHorizontal: s(12), paddingVertical: s(12), gap: s(8) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: s(6) }}>
              <Keycap>{hostLabel}</Keycap>
              <T size={10.2} color="rgba(255,255,255,0.35)">+</T>
              <KeyCapture value={draftCode} placeholder="Chọn phím" onCapture={(code) => { if (usableCode(code)) setDraftCode(code); }} />
            </View>
            <ActionPicker value={draftAction} onChange={setDraftAction} />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: s(8) }}>
              <PillButton onPress={() => { setAdding(false); setDraftCode(''); }}>Hủy</PillButton>
              <PillButton tone="accent" disabled={!draftCode} onPress={() => {
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
          <ActionRow icon={Plus} label="Thêm phím tắt" onPress={() => { setAdding(true); setOpenCode(null); }} />
        )}
      </SettingsGroup>

      <SettingsGroup title="Đổi phím gửi sang PC" footnote="Chỉ đổi mã phím gửi sang Windows, không chạy tác vụ Jetsona.">
        {remaps.map(([source, target]) => (
          <View key={source} style={{ minHeight: s(50), flexDirection: 'row', alignItems: 'center', gap: s(8), paddingHorizontal: s(12), paddingVertical: s(8) }}>
            <Keycap>{keyCodeLabel(source)}</Keycap>
            <ArrowRight size={s(14)} color="rgba(255,255,255,0.3)" />
            <Keycap accent>{keyCodeLabel(target)}</Keycap>
            <View style={{ flex: 1 }} />
            <PillButton onPress={() => {
              const next = { ...settings.keyboardRemaps };
              delete next[source];
              update('keyboardRemaps', next);
            }}
            >
              Xóa
            </PillButton>
          </View>
        ))}
        <View style={{ minHeight: s(50), flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: s(8), paddingHorizontal: s(12), paddingVertical: s(8) }}>
          <KeyCapture value={remapSource} placeholder="Phím nhấn" onCapture={setRemapSource} />
          <ArrowRight size={s(14)} color="rgba(255,255,255,0.3)" />
          <KeyCapture value={remapTarget} placeholder="Gửi thành" onCapture={setRemapTarget} />
          <View style={{ flex: 1 }} />
          <PillButton
            tone="accent"
            disabled={!remapSource || !remapTarget || remapSource === remapTarget}
            onPress={() => {
              if (remapSource === settings.hostKey) { notify('info', 'Phím giữ không đổi được', 'Chọn một phím nguồn khác.'); return; }
              update('keyboardRemaps', { ...settings.keyboardRemaps, [remapSource]: remapTarget });
              setRemapSource('');
              setRemapTarget('');
            }}
          >
            Thêm
          </PillButton>
        </View>
      </SettingsGroup>

      <SettingsGroup>
        <ActionRow
          icon={RotateCcw}
          label="Khôi phục phím mặc định"
          detail="Đặt lại phím tắt và xóa mọi phím đã đổi"
          onPress={() => {
            update('hostKey', DEFAULT_INPUT_SETTINGS.hostKey);
            update('hostShortcuts', DEFAULT_INPUT_SETTINGS.hostShortcuts);
            update('keyboardRemaps', {});
            setOpenCode(null);
          }}
        />
      </SettingsGroup>
    </>
  );
}

// ---------------------------------------------------------------- âm thanh

export function AudioPage({ input }: { input: InputSettingsState }) {
  const { s } = useUi();
  const { settings, update } = input;
  const { devices } = useInputDevices();
  const headsets = devices.filter((device) => device.kind === 'headset');
  return (
    <>
      <SettingsGroup title="Âm thanh từ PC" footnote="Âm thanh stream đi qua đầu ra mà Android đang dùng: tai nghe Bluetooth hoặc có dây nếu đang nối, không thì loa máy.">
        <View style={{ minHeight: s(50), flexDirection: 'row', alignItems: 'center', gap: s(12), paddingHorizontal: s(12), paddingVertical: s(8) }}>
          <View style={[styles.deviceIcon, { width: s(32), height: s(32), borderRadius: s(8) }]}>
            <Headphones size={s(16)} color="rgba(255,255,255,0.8)" strokeWidth={1.8} />
          </View>
          <View style={{ flex: 1 }}>
            <T size={12.8} color="rgba(255,255,255,0.9)">Đầu ra</T>
            <T size={10.2} color={colors.text3} style={{ marginTop: s(2) }}>
              {headsets.length ? headsets.map((device) => device.name).join(', ') : 'Loa của máy'}
            </T>
          </View>
        </View>
        <SliderRow label="Âm lượng stream" value={settings.audioVolume} min={0} max={100} step={1} format={(value) => `${value}%`} onChange={(value) => update('audioVolume', value)} />
        <ToggleRow label="Tắt tiếng" detail="Chỉ tắt tiếng phát ra ở máy này." checked={settings.audioMuted} onChange={(value) => update('audioMuted', value)} />
      </SettingsGroup>
      <SettingsGroup>
        <ActionRow
          icon={RotateCcw}
          label="Khôi phục mặc định"
          detail="Âm lượng 100%, bật tiếng"
          disabled={settings.audioVolume === 100 && !settings.audioMuted}
          onPress={() => {
            update('audioVolume', 100);
            update('audioMuted', false);
          }}
        />
      </SettingsGroup>
    </>
  );
}

const styles = StyleSheet.create({
  deviceIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.14)',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  onlineDot: {
    position: 'absolute',
    borderWidth: 2,
    borderColor: '#0a0f17',
    backgroundColor: colors.success,
  },
  notice: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
