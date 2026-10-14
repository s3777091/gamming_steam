import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  addMultipathListener,
  connectSecondaryWifi as nativeConnectSecondaryWifi,
  disableCellularFallback as nativeDisableCellularFallback,
  disconnectSecondaryWifi as nativeDisconnectSecondaryWifi,
  enableCellularFallback as nativeEnableCellularFallback,
  getAvailableWifiNetworks,
  getCurrentMultipathStatus,
  getNetworkCapabilities,
  type AvailableWifi,
  type MultipathMode,
  type MultipathStatus,
  type NetworkCapabilities,
} from 'jetsona-multipath';

export type { AvailableWifi };

const STORAGE_KEYS = {
  SECONDARY_SSID: '@jetsona/secondary_wifi_ssid',
  SECONDARY_PASS: '@jetsona/secondary_wifi_pass',
  AUTO_CELLULAR: '@jetsona/multipath_auto_cellular',
  AI_ENABLED: '@jetsona/multipath_ai_enabled',
};

import {
  computeAiDecision,
  type AiDecision,
} from './multipath-algorithm';

export { computeAiDecision };
export type { AiDecision };

export type MultipathAiState = {
  capabilities: NetworkCapabilities;
  status: MultipathStatus;
  availableWifi: AvailableWifi[];
  scanning: boolean;
  aiEnabled: boolean;
  autoCellular: boolean;
  savedSecondarySsid: string | null;
  decision: AiDecision;
};

export function useMultipathAi() {
  const [capabilities, setCapabilities] = useState<NetworkCapabilities>(() => getNetworkCapabilities());
  const [status, setStatus] = useState<MultipathStatus>(() => getCurrentMultipathStatus());
  const [availableWifi, setAvailableWifi] = useState<AvailableWifi[]>([]);
  const [scanning, setScanning] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(true);
  const [autoCellular, setAutoCellular] = useState(true);
  const [savedSecondarySsid, setSavedSecondarySsid] = useState<string | null>(null);

  // Giả lập/đo lường metrics RTT và loss hiện tại để cấp cho AI Actor
  const [metrics, setMetrics] = useState({
    link1Rtt: 12,
    link1Loss: 0,
    link2Rtt: 15,
    link2Loss: 0,
    bufferSec: 4.2,
  });

  const [decision, setDecision] = useState<AiDecision>(() =>
    computeAiDecision(status, 12, 0, 15, 0, 4.2, status.secondary.type === 'cellular')
  );

  const statusRef = useRef(status);
  statusRef.current = status;

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

    return () => {
      active = false;
      unsubscribeStatus();
    };
  }, []);

  // Vòng lặp suy luận AI (Inference Interval: 1 giây / lần)
  useEffect(() => {
    if (!aiEnabled) return;

    const interval = setInterval(() => {
      const currentStatus = statusRef.current;
      const isCellular = currentStatus.secondary.type === 'cellular';

      // Tạo một chút dao động thực tế để mô phỏng môi trường mạng
      setMetrics((prev) => {
        const nextLink1Rtt = Math.max(8, prev.link1Rtt + (Math.random() * 6 - 3));
        const nextDecision = computeAiDecision(
          currentStatus,
          nextLink1Rtt,
          prev.link1Loss,
          prev.link2Rtt,
          prev.link2Loss,
          prev.bufferSec,
          isCellular
        );
        setDecision(nextDecision);
        return { ...prev, link1Rtt: nextLink1Rtt };
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [aiEnabled]);

  // Quét danh sách Wi-Fi xung quanh
  const scanWifi = useCallback(async () => {
    setScanning(true);
    try {
      const networks = getAvailableWifiNetworks();
      setAvailableWifi(networks);
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
    await AsyncStorage.removeItem(STORAGE_KEYS.SECONDARY_SSID);
    await AsyncStorage.removeItem(STORAGE_KEYS.SECONDARY_PASS);
    nativeDisconnectSecondaryWifi();
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
    decision,
    metrics,
    scanWifi,
    connectSecondary,
    disconnectSecondary,
    toggleCellular,
    toggleAi,
  };
}
