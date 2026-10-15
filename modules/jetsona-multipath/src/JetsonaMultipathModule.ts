import { NativeModule, requireOptionalNativeModule } from 'expo';

import type {
  AvailableWifi,
  JetsonaMultipathModuleEvents,
  MultipathStatus,
  NetworkCapabilities,
} from './JetsonaMultipath.types';

declare class JetsonaMultipathNative extends NativeModule<JetsonaMultipathModuleEvents> {
  getNetworkCapabilities(): NetworkCapabilities;
  getAvailableWifiNetworks(): AvailableWifi[];
  enableCellularFallback(): boolean;
  disableCellularFallback(): void;
  connectSecondaryWifi(ssid: string, password?: string): boolean;
  disconnectSecondaryWifi(): void;
  getCurrentMultipathStatus(): MultipathStatus;
  openCaptivePortalPage(): boolean;
}

/** null trên iOS/web hoặc khi chưa chạy dev build native. */
export default requireOptionalNativeModule<JetsonaMultipathNative>('JetsonaMultipath');
