import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useStreamStats } from '@/features/stream/useStreamTelemetry';
import { streamQuality } from './stream-stats';

import {
  addMultipathListener,
  connectSecondaryWifi as nativeConnectSecondaryWifi,
  disableCellularFallback as nativeDisableCellularFallback,
  disconnectSecondaryWifi as nativeDisconnectSecondaryWifi,
  enableCellularFallback as nativeEnableCellularFallback,
  getAvailableWifiNetworks,
  getCurrentMultipathStatus,
  getNetworkCapabilities,
  openCaptivePortalPage,
  type AvailableWifi,
  type MultipathStatus,
  type NetworkCapabilities,
} from 'jetsona-multipath';

import {
  computeAiDecision,
  type AiDecision,
} from './multipath-algorithm';

export type { AvailableWifi };
export { computeAiDecision };
export type { AiDecision };

const STORAGE_KEYS = {
  SECONDARY_SSID: '@jetsona/secondary_wifi_ssid',
  SECONDARY_PASS: '@jetsona/secondary_wifi_pass',
  AUTO_CELLULAR: '@jetsona/multipath_auto_cellular',
  AI_ENABLED: '@jetsona/multipath_ai_enabled',
};

export type MultipathAiState = {
  capabilities: NetworkCapabilities;
  status: MultipathStatus;
  availableWifi: AvailableWifi[];
  scanning: boolean;
  aiEnabled: boolean;
  autoCellular: boolean;
  savedSecondarySsid: string | null;
  decision: ReturnType<typeof streamQuality>;
};

export function useMultipathAi() {
  const [capabilities, setCapabilities] = useState<NetworkCapabilities>(() => getNetworkCapabilities());
  const [status, setStatus] = useState<MultipathStatus>(() => getCurrentMultipathStatus());
  const [availableWifi, setAvailableWifi] = useState<AvailableWifi[]>([]);
  const [scanning, setScanning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoCellular, setAutoCellular] = useState(true);
  const [savedSecondarySsid, setSavedSecondarySsid] = useState<string | null>(null);
  const [captivePortalSsid, setCaptivePortalSsid] = useState<string | null>(null);

  const { stats: metrics, live: metricsLive } = useStreamStats();
  const decision = useMemo(() => aiEnabled ? streamQuality(metrics) : null, [aiEnabled, metrics]);
  const [scanError, setScanError] = useState<string | null>(null);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  // Đọc cài đặt đã lưu trong AsyncStorage
  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const [savedSsid, savedCellular, savedAi] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEYS.SECONDARY_SSID),
          AsyncStorage.getItem(STORAGE_KEYS.AUTO_CELLULAR),
          AsyncStorage.getItem(STORAGE_KEYS.AI_ENABLED),
        ]);
        if (!active) return;
        if (savedSsid) setSavedSecondarySsid(savedSsid);
        if (savedCellular !== null) setAutoCellular(savedCellular === '1');
        if (savedAi !== null) setAiEnabled(savedAi === '1');

        // Tự động kết nối:
        const caps = getNetworkCapabilities();
        setCapabilities(caps);

        if (caps.hasCellular && savedCellular !== '0') {
          nativeEnableCellularFallback();
        } else if (savedSsid && caps.isDualWifiSupported) {
          const savedPass = await AsyncStorage.getItem(STORAGE_KEYS.SECONDARY_PASS);
          nativeConnectSecondaryWifi(savedSsid, savedPass ?? undefined);
        }
      } catch {
        // Bỏ qua lỗi đọc storage cục bộ
      }
    })();

    // Lắng nghe sự kiện từ native Android
    const unsubscribeStatus = addMultipathListener('onMultipathStatusChanged', (newStatus) => {
      setStatus(newStatus);
    });

    const unsubscribeCaptive = addMultipathListener('onCaptivePortalDetected', (ev) => {
      setCaptivePortalSsid(ev.ssid);
    });

    return () => {
      active = false;
      unsubscribeStatus();
      unsubscribeCaptive();
    };
  }, []);

  // Yêu cầu quyền quét Wi-Fi trên Android (kiểm tra trước, tránh bật Activity màn trắng của OS)
  const ensureScanPermissions = async () => {
    if (Platform.OS !== 'android') return true;
    try {
      const apiLevel = Number(Platform.Version);
      const perms: Parameters<typeof PermissionsAndroid.check>[0][] = [];
      if (apiLevel >= 33) {
        perms.push(
          'android.permission.NEARBY_WIFI_DEVICES',
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
        );
      } else {
        perms.push(
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
          PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
        );
      }

      // Kiểm tra trước: nếu đã được cấp thì KHÔNG gọi requestMultiple để tránh màn hình trắng của hệ thống
      const checks = await Promise.all(
        perms.map((p) => PermissionsAndroid.check(p).catch(() => false))
      );
      if (checks.every(Boolean)) {
        return true;
      }

      const res = await PermissionsAndroid.requestMultiple(perms);
      return Object.values(res).every((val) => val === PermissionsAndroid.RESULTS.GRANTED);
    } catch {
      return false;
    }
  };

  // Quét danh sách Wi-Fi xung quanh
  const scanWifi = useCallback(async () => {
    setScanning(true);
    setScanError(null);
    try {
      if (!await ensureScanPermissions()) {
        setScanError('Cần cấp quyền Wi-Fi và vị trí để tìm mạng xung quanh.');
        setAvailableWifi([]);
        return;
      }
      const networks = getAvailableWifiNetworks();

      // Loại bỏ hoàn toàn mạng chính (primary SSID) khỏi danh sách chọn mạng phụ
      const primarySsid = (statusRef.current.primary.ssid ?? '').trim().toLowerCase();
      const filtered = (networks || []).filter((item) => {
        const s = (item.ssid ?? '').trim().toLowerCase();
        return s.length > 0 && s !== primarySsid;
      });

      setAvailableWifi(filtered);
    } catch {
      setScanError('Không quét được Wi-Fi. Hãy thử lại.');
    } finally {
      setScanning(false);
    }
  }, []);

  // Kết nối Wi-Fi thứ 2 (Dual Wi-Fi trên Tab S9)
  const connectSecondary = useCallback(async (ssid: string, password?: string) => {
    setSavedSecondarySsid(ssid);
    await AsyncStorage.setItem(STORAGE_KEYS.SECONDARY_SSID, ssid);
    if (password) {
      await AsyncStorage.setItem(STORAGE_KEYS.SECONDARY_PASS, password);
    } else {
      await AsyncStorage.removeItem(STORAGE_KEYS.SECONDARY_PASS);
    }
    nativeConnectSecondaryWifi(ssid, password);
  }, []);

  // Ngắt Wi-Fi thứ 2
  const disconnectSecondary = useCallback(async () => {
    setSavedSecondarySsid(null);
    setCaptivePortalSsid(null);
    await AsyncStorage.removeItem(STORAGE_KEYS.SECONDARY_SSID);
    await AsyncStorage.removeItem(STORAGE_KEYS.SECONDARY_PASS);
    nativeDisconnectSecondaryWifi();
  }, []);

  // Mở trang đăng nhập Web / Captive Portal
  const openCaptivePortal = useCallback(() => {
    openCaptivePortalPage();
  }, []);

  // Bật/tắt dự phòng 4G/5G
  const toggleCellular = useCallback(async (enabled: boolean) => {
    setAutoCellular(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.AUTO_CELLULAR, enabled ? '1' : '0');
    if (enabled) {
      nativeEnableCellularFallback();
    } else {
      nativeDisableCellularFallback();
    }
  }, []);

  // Bật/tắt AI Scheduler
  const toggleAi = useCallback(async (enabled: boolean) => {
    setAiEnabled(enabled);
    await AsyncStorage.setItem(STORAGE_KEYS.AI_ENABLED, enabled ? '1' : '0');
  }, []);

  return {
    capabilities,
    status,
    availableWifi,
    scanning,
    aiEnabled,
    autoCellular,
    savedSecondarySsid,
    captivePortalSsid,
    decision,
    metrics,
    metricsLive,
    scanError,
    scanWifi,
    connectSecondary,
    disconnectSecondary,
    toggleCellular,
    toggleAi,
    openCaptivePortal,
  };
}
