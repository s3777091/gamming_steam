export type WifiNetworkInfo = {
  ssid?: string;
  frequency?: number;
  band?: string; // '2.4GHz' | '5GHz' | '6GHz'
  linkSpeedMbps?: number;
  rssi?: number;
  isHbsCapable?: boolean;
};

export type AvailableWifi = {
  ssid: string;
  bssid: string;
  frequency: number;
  band: string;
  level: number;
  isHbsCandidate: boolean;
  capabilities: string;
};

export type NetworkCapabilities = {
  hasCellular: boolean;
  isDualWifiSupported: boolean;
  primaryWifi: WifiNetworkInfo;
};

export type MultipathMode = 'hbs_dual_wifi' | 'dual_wifi' | 'wifi_cellular' | 'single_wifi';

export type SecondaryLinkInfo = {
  type: 'wifi' | 'cellular' | 'none';
  ssid?: string;
  name?: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'unavailable' | 'error';
};

export type MultipathStatus = {
  isMultipathActive: boolean;
  mode: MultipathMode;
  primary: WifiNetworkInfo;
  secondary: SecondaryLinkInfo;
};

export type CellularStatusEvent = {
  status: 'connected' | 'connecting' | 'disconnected' | 'unavailable' | 'error';
  networkHandle?: string;
  message?: string;
};

export type SecondaryWifiStatusEvent = {
  status: 'connected' | 'connecting' | 'disconnected' | 'unavailable' | 'error';
  ssid?: string;
  networkHandle?: string;
  message?: string;
};

export type JetsonaMultipathModuleEvents = {
  onMultipathStatusChanged: (status: MultipathStatus) => void;
  onCellularStatusChanged: (event: CellularStatusEvent) => void;
  onSecondaryWifiStatusChanged: (event: SecondaryWifiStatusEvent) => void;
  onWifiScanCompleted: (networks: AvailableWifi[]) => void;
  onCaptivePortalDetected: (event: { ssid: string }) => void;
};
