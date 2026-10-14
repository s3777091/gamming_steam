import Native from './src/JetsonaMultipathModule';
import type {
  AvailableWifi,
  JetsonaMultipathModuleEvents,
  MultipathStatus,
  NetworkCapabilities,
} from './src/JetsonaMultipath.types';

export * from './src/JetsonaMultipath.types';

export const hasNativeMultipath = Native != null;

const DEFAULT_CAPABILITIES: NetworkCapabilities = {
  hasCellular: false,
  isDualWifiSupported: true, // Giả lập hỗ trợ trên Galaxy Tab S9
  primaryWifi: {
    ssid: 'Galaxy_Tab_S9_Wifi_5G',
    frequency: 5240,
    band: '5GHz',
    linkSpeedMbps: 866,
    rssi: -45,
    isHbsCapable: true,
  },
};

const DEFAULT_STATUS: MultipathStatus = {
  isMultipathActive: false,
  mode: 'single_wifi',
  primary: {
    ssid: 'Galaxy_Tab_S9_Wifi_5G',
    frequency: 5240,
    band: '5GHz',
    linkSpeedMbps: 866,
    rssi: -45,
    isHbsCapable: true,
  },
  secondary: {
    type: 'none',
    status: 'disconnected',
  },
};

export function getNetworkCapabilities(): NetworkCapabilities {
  return Native?.getNetworkCapabilities() ?? DEFAULT_CAPABILITIES;
}

export function getAvailableWifiNetworks(): AvailableWifi[] {
  return Native?.getAvailableWifiNetworks() ?? [
    {
      ssid: 'Văn Phòng 5G Studio',
      bssid: 'aa:bb:cc:dd:ee:01',
      frequency: 5745,
      band: '5GHz',
      level: -42,
      isHbsCandidate: true,
      capabilities: '[WPA2-PSK-CCMP][RSN-PSK-CCMP]',
    },
    {
      ssid: 'Văn Phòng 5G Guest',
      bssid: 'aa:bb:cc:dd:ee:02',
      frequency: 5180,
      band: '5GHz',
      level: -58,
      isHbsCandidate: true,
      capabilities: '[WPA2-PSK-CCMP]',
    },
    {
      ssid: 'Văn Phòng 2.4G',
      bssid: 'aa:bb:cc:dd:ee:03',
      frequency: 2437,
      band: '2.4GHz',
      level: -50,
      isHbsCandidate: false,
      capabilities: '[WPA2-PSK-CCMP]',
    },
  ];
}

export function enableCellularFallback(): boolean {
  return Native?.enableCellularFallback() ?? false;
}

export function disableCellularFallback(): void {
  Native?.disableCellularFallback();
}

export function connectSecondaryWifi(ssid: string, password?: string): boolean {
  return Native?.connectSecondaryWifi(ssid, password) ?? true;
}

export function disconnectSecondaryWifi(): void {
  Native?.disconnectSecondaryWifi();
}

export function getCurrentMultipathStatus(): MultipathStatus {
  return Native?.getCurrentMultipathStatus() ?? DEFAULT_STATUS;
}

export function addMultipathListener<K extends keyof JetsonaMultipathModuleEvents>(
  event: K,
  listener: JetsonaMultipathModuleEvents[K],
): () => void {
  if (!Native) return () => {};
  const subscription = Native.addListener(event, listener);
  return () => subscription.remove();
}
