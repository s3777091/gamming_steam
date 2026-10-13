import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef } from 'react';
import { AppState, BackHandler, Platform, type AppStateStatus } from 'react-native';

import { apiFetch } from '@/lib/api';

export const WAKE_ON_APP_OPEN_KEY = 'jetsona:wake_on_app_open';

/**
 * Quản lý trạng thái ru ngủ và tự động đánh thức PC:
 * - Khi người dùng chọn "Đi ngủ": gửi lệnh sleep tới PC, lưu cờ tự wake, rồi thoát app.
 * - Khi mở lại app (hoặc app quay lại foreground): kiểm tra cờ và tự gửi Wake-on-LAN.
 */
export function usePcSleepWake(onWakeTriggered?: () => void) {
  const onWakeTriggeredRef = useRef(onWakeTriggered);
  onWakeTriggeredRef.current = onWakeTriggered;

  const checkAndWake = useCallback(async () => {
    try {
      const flag = await AsyncStorage.getItem(WAKE_ON_APP_OPEN_KEY);
      if (flag === 'true') {
        // Xóa cờ ngay để tránh gửi lặp lại
        await AsyncStorage.removeItem(WAKE_ON_APP_OPEN_KEY);
        // Gửi tín hiệu Wake-on-LAN để đánh thức PC
        await apiFetch('/api/wol/wake', { method: 'POST' }).catch(() => null);
        onWakeTriggeredRef.current?.();
      }
    } catch {
      // bỏ qua lỗi đọc storage
    }
  }, []);

  useEffect(() => {
    // Kiểm tra ngay khi màn hình khởi tạo
    void checkAndWake();

    // Và khi app từ background quay lại active
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        void checkAndWake();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkAndWake]);

  /** Gửi lệnh ngủ tới PC, ghi nhớ cờ tự wake, rồi thoát app */
  const sleepPcAndExit = useCallback(async () => {
    try {
      await AsyncStorage.setItem(WAKE_ON_APP_OPEN_KEY, 'true');
    } catch {
      // bỏ qua lỗi ghi storage
    }

    try {
      await apiFetch('/api/pc/sleep', { method: 'POST' });
    } catch {
      // Vẫn tiếp tục thoát nếu máy đã ngắt kết nối
    }

    // Đợi một thoáng để hoàn tất hiệu ứng phản hồi rồi thoát app
    setTimeout(() => {
      if (Platform.OS === 'android') {
        BackHandler.exitApp();
      }
    }, 650);
  }, []);

  /** Đánh thức PC thủ công */
  const wakePc = useCallback(async () => {
    try {
      await apiFetch('/api/wol/wake', { method: 'POST' });
      onWakeTriggeredRef.current?.();
    } catch {
      // xử lý bên gọi
    }
  }, []);

  return {
    sleepPcAndExit,
    wakePc,
    checkAndWake,
  };
}
