// Cài đặt stream của người dùng, lưu ngay khi đổi. Bản native của
// components/settings/useStreamSettingsDraft.ts: không có nút "Lưu", gạt một
// công tắc là đã đổi. Các chỉnh sửa được gom lại một nhịp để kéo thanh bitrate
// chỉ ghi một hàng thay vì bốn mươi, và phần còn chờ được ghi khi màn hình đóng.

import { useCallback, useEffect, useRef, useState } from 'react';

import { detectRegion } from '@/lib/detect-region';
import { createClient } from '@/lib/supabase';
import {
  completeSettings,
  fetchStreamSettingsDefaults,
  profileSettingsFor,
  STREAM_SETTINGS_TABLE,
  streamSettingsDifferFromDefaults,
  type StreamProfile,
  type StreamSettings,
} from '@/lib/stream-settings';
import { detectStreamDeviceClass } from '@/lib/stream-device';
import { announceStreamSettings, friendlyError, persistStreamSettings } from '@/lib/stream-settings-ui';

export type Notify = (tone: 'error' | 'success' | 'info', title: string, detail?: string) => void;
export type SaveState = 'idle' | 'saving' | 'saved' | 'error';

const SAVE_DELAY_MS = 600;

// Mở lại màn hình thì hiện ngay giá trị cũ rồi làm mới âm thầm, không nháy khung xương.
let snapshot: { settings: StreamSettings; defaults: Partial<StreamSettings> | null } | null = null;

export function useStreamSettingsDraft(notify: Notify) {
  const deviceClass = detectStreamDeviceClass();
  const [settings, setSettings] = useState<StreamSettings | null>(() => snapshot?.settings ?? null);
  const [defaults, setDefaults] = useState<Partial<StreamSettings> | null>(() => snapshot?.defaults ?? null);
  const [loading, setLoading] = useState(() => !snapshot);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('idle');

  const settingsRef = useRef(settings);
  const defaultsRef = useRef(defaults);
  const pending = useRef<StreamSettings | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Ghi lần lượt từng lượt một để hàng cũ không bao giờ đè lên hàng mới.
  const chain = useRef<Promise<void>>(Promise.resolve());
  const notifyRef = useRef(notify);
  notifyRef.current = notify;

  const load = useCallback(async () => {
    if (!snapshot) setLoading(true);
    setLoadError(null);
    try {
      const supabase = createClient();
      if (!supabase) throw new Error('Supabase chưa được cấu hình.');
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) throw new Error('Phiên đăng nhập đã hết hạn.');
      const [settingsResult, streamDefaults] = await Promise.all([
        supabase.from(STREAM_SETTINGS_TABLE[deviceClass]).select('*').eq('user_id', auth.user.id).maybeSingle(),
        fetchStreamSettingsDefaults(supabase, deviceClass),
      ]);
      if (settingsResult.error) throw settingsResult.error;
      // Thay đổi xảy ra giữa chừng thắng hàng vừa đọc về.
      if (pending.current) return;
      const next = completeSettings(auth.user.id, settingsResult.data as Partial<StreamSettings> | null, streamDefaults);
      snapshot = { settings: next, defaults: streamDefaults };
      settingsRef.current = next;
      defaultsRef.current = streamDefaults;
      setSettings(next);
      setDefaults(streamDefaults);
    } catch (error) {
      if (!snapshot) setLoadError(friendlyError(error, 'Không đọc được cài đặt. Vui lòng thử lại sau ít phút.'));
    } finally {
      setLoading(false);
    }
  }, [deviceClass]);

  useEffect(() => {
    void load();
  }, [load]);

  // Khu vực lấy từ IP người xem, không từ hàng đã lưu (xem `ViewerRegion`).
  const loaded = settings !== null;
  useEffect(() => {
    if (!loaded) return;
    let cancelled = false;
    const current = settingsRef.current;
    if (!current) return;
    void detectRegion(current.region).then((detected) => {
      const latest = settingsRef.current;
      if (cancelled || !latest || latest.region === detected) return;
      const next = { ...latest, region: detected };
      settingsRef.current = next;
      setSettings(next);
    });
    return () => { cancelled = true; };
  }, [loaded]);

  const flush = useCallback(() => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    chain.current = chain.current.then(async () => {
      try {
        await persistStreamSettings(next, deviceClass);
        snapshot = { settings: next, defaults: defaultsRef.current };
        announceStreamSettings(next);
        if (!pending.current) setSaveState('saved');
      } catch (error) {
        setSaveState('error');
        notifyRef.current('error', 'Không lưu được cài đặt', friendlyError(error, 'Vui lòng thử lại sau ít phút.'));
      }
    });
  }, [deviceClass]);

  // Đóng màn hình giữa nhịp chờ vẫn lưu thay đổi cuối.
  useEffect(() => () => flush(), [flush]);

  const change = useCallback((patch: Partial<StreamSettings>) => {
    const current = settingsRef.current;
    if (!current) return;
    const next = { ...current, ...patch };
    settingsRef.current = next;
    pending.current = next;
    setSettings(next);
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, SAVE_DELAY_MS);
  }, [flush]);

  const update = useCallback(<K extends keyof StreamSettings>(key: K, value: StreamSettings[K]) => {
    change({ [key]: value } as Partial<StreamSettings>);
  }, [change]);

  const selectProfile = useCallback((profile: StreamProfile) => {
    change({ profile, ...profileSettingsFor(profile, deviceClass) });
  }, [change, deviceClass]);

  // Về cấu hình chuẩn, giữ những gì mô tả người xem thay vì hình ảnh: HUD
  // riêng thiết bị, khu vực đã nhận và đường truyền.
  const restoreDefaults = useCallback(() => {
    const current = settingsRef.current;
    if (!current) return;
    change(completeSettings(
      current.user_id,
      { hud_enabled: current.hud_enabled, region: current.region, ice_mode: current.ice_mode },
      defaultsRef.current,
    ));
  }, [change]);

  const hasDrift = Boolean(settings && defaults && streamSettingsDifferFromDefaults(settings, defaults));

  return { deviceClass, settings, loading, loadError, saveState, hasDrift, reload: load, update, selectProfile, restoreDefaults };
}

export type StreamSettingsDraft = ReturnType<typeof useStreamSettingsDraft>;
