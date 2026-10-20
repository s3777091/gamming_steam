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
  isDualWifiSupported: false,
  primaryWifi: {},
};

const DEFAULT_STATUS: MultipathStatus = {
  isMultipathActive: false,
  mode: 'single_wifi',
  primary: {},
  secondary: {
    type: 'none',
    status: 'unavailable',
  },
};

export function getNetworkCapabilities(): NetworkCapabilities {
  return Native?.getNetworkCapabilities() ?? DEFAULT_CAPABILITIES;
}

export function getAvailableWifiNetworks(): AvailableWifi[] {
  return Native?.getAvailableWifiNetworks() ?? [];
}

export function enableCellularFallback(): boolean {
  return Native?.enableCellularFallback() ?? false;
}

export function disableCellularFallback(): void {
  Native?.disableCellularFallback();
}

export function connectSecondaryWifi(ssid: string, password?: string): boolean {
  return Native?.connectSecondaryWifi(ssid, password) ?? false;
}

export function disconnectSecondaryWifi(): void {
  Native?.disconnectSecondaryWifi();
}

export function getCurrentMultipathStatus(): MultipathStatus {
  return Native?.getCurrentMultipathStatus() ?? DEFAULT_STATUS;
}

export function openCaptivePortalPage(): boolean {
  return Native?.openCaptivePortalPage() ?? false;
}

export function addMultipathListener<K extends keyof JetsonaMultipathModuleEvents>(
  event: K,
  listener: JetsonaMultipathModuleEvents[K],
): () => void {
  if (!Native) return () => {};
  const subscription = Native.addListener(event, listener);
  return () => subscription.remove();
}
