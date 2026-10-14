// Chuột, bàn phím, tay cầm và âm thanh của thiết bị đang cầm.
//
// Bản lưu cục bộ (AsyncStorage) là nguồn áp dụng ngay cho phiên stream; bản trên
// Supabase (`controller_settings`, theo từng client device) chỉ để mang cấu hình
// sang lần đăng nhập sau — cùng bảng và cùng quy tắc "bên nào `updatedAt` mới
// hơn thì thắng" như bản web, nên cài đặt đi theo tài khoản.

import { useCallback, useEffect, useRef, useState } from 'react';

import { ensureClientDeviceId } from '@/lib/client-device';
import {
  DEFAULT_INPUT_SETTINGS,
  inputSettingsFromRow,
  inputSettingsToRow,
  loadInputSettings,
  normalizeInputSettings,
  storeInputSettings,
  type ControllerSettingsRow,
  type HostShortcutAction,
  type InputSettings,
} from '@/lib/input-settings';
import { createClient } from '@/lib/supabase';
import type { SettingsSelectOption } from '@/lib/stream-settings-ui';

export type InputSyncState = 'local' | 'saving' | 'synced';

export const HOST_SHORTCUT_OPTIONS: SettingsSelectOption<HostShortcutAction>[] = [
  { value: 'exit', label: 'Thoát nhanh', description: 'Đóng phiên và về trang chính' },
  { value: 'reload', label: 'Tải lại luồng', description: 'Kết nối lại Moonlight' },
  { value: 'hud', label: 'Bật / tắt HUD', description: 'Hiện hoặc ẩn thông số hiệu năng' },
  { value: 'clipboard', label: 'Đồng bộ clipboard', description: 'Kéo clipboard từ PC về đây' },
  { value: 'settings', label: 'Đồng bộ cài đặt', description: 'Đọc lại cấu hình từ cloud' },
  { value: 'shutdown', label: 'Tắt máy', description: 'Tắt Windows sau bước xác nhận' },
  { value: 'zoom', label: 'Zoom in / zoom out', description: 'Đổi nhanh toàn màn hình và vừa khung' },
];

export function useInputSettings() {
  const [settings, setSettings] = useState<InputSettings>(DEFAULT_INPUT_SETTINGS);
  const [dirty, setDirty] = useState(false);
  const [syncState, setSyncState] = useState<InputSyncState>('local');
  const settingsRef = useRef(settings);
  settingsRef.current = settings;

  useEffect(() => {
    let disposed = false;
    void (async () => {
      const local = await loadInputSettings();
      if (disposed) return;
      setSettings(local);
      try {
        const supabase = createClient();
        if (!supabase) return;
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user || disposed) return;
        const clientDeviceId = await ensureClientDeviceId(supabase);
        const { data, error } = await supabase
          .from('controller_settings')
          .select('*')
          .eq('user_id', auth.user.id)
          .eq('client_device_id', clientDeviceId)
          .maybeSingle();
        if (error || !data || disposed) return;
        const remote = inputSettingsFromRow(data as ControllerSettingsRow, local);
        if (Date.parse(remote.updatedAt) > Date.parse(local.updatedAt)) {
          setSettings(await storeInputSettings(remote));
          setSyncState('synced');
        }
      } catch {
        // Không đồng bộ được thì vẫn dùng bản cục bộ.
      }
    })();
    return () => { disposed = true; };
  }, []);

  useEffect(() => {
    if (!dirty) return;
    setSyncState('saving');
    const timeout = setTimeout(async () => {
      try {
        const supabase = createClient();
        if (!supabase) { setSyncState('local'); return; }
        const { data: auth } = await supabase.auth.getUser();
        if (!auth.user) { setSyncState('local'); return; }
        const clientDeviceId = await ensureClientDeviceId(supabase);
        const { error } = await supabase.from('controller_settings').upsert(
          { user_id: auth.user.id, client_device_id: clientDeviceId, ...inputSettingsToRow(settingsRef.current) },
          { onConflict: 'user_id,client_device_id' },
        );
        setSyncState(error ? 'local' : 'synced');
      } catch {
        setSyncState('local');
      }
    }, 650);
    return () => clearTimeout(timeout);
  }, [dirty, settings]);

  const update = useCallback(<K extends keyof InputSettings>(key: K, value: InputSettings[K]) => {
    setSettings((current) => {
      const next = normalizeInputSettings({ ...current, [key]: value, updatedAt: new Date().toISOString() });
      void storeInputSettings(next);
      return next;
    });
    setDirty(true);
    setSyncState('local');
  }, []);

  return { settings, update, syncState };
}

export type InputSettingsState = ReturnType<typeof useInputSettings>;
