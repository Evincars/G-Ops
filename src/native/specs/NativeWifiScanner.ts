import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type WifiNetwork = {
  ssid: string;
  bssid: string;
  hidden: boolean;
  level: number; // dBm
  frequency: number; // MHz (primary 20 MHz channel)
  centerFrequency: number; // MHz (centre of the whole channel width)
  channel: number;
  centerChannel: number;
  band: string; // '2.4' | '5' | '6' | '60'
  channelWidth: number; // MHz: 20/40/80/160/320
  security: string; // OPEN | OWE | WEP | WPA | WPA2 | WPA3 | WPA2/WPA3 | *-EAP
  capabilities: string; // raw capability string
  wifiStandard: string; // 802.11n/ac/ax/be ...
  wps: boolean;
  mldMac: string; // Wi-Fi 7 MLO, '' when absent
  rttResponder: boolean; // 802.11mc / FTM
  ageMs: number;
};

export type WifiConnection = {
  ssid: string;
  bssid: string;
  rssi: number;
  frequency: number;
  linkSpeedMbps: number;
  txLinkSpeedMbps: number;
  rxLinkSpeedMbps: number;
  wifiStandard: string;
  ipAddress: string;
};

export type WifiStatus = {
  wifiEnabled: boolean;
  locationEnabled: boolean;
  scanThrottleEnabled: boolean;
  autoScan: boolean;
  autoScanIntervalMs: number;
};

export interface Spec extends TurboModule {
  getStatus(): Promise<WifiStatus>;
  /** Resolves true when the platform accepted the scan request (false = throttled / failed). */
  startScan(): Promise<boolean>;
  getScanResults(): Promise<Array<WifiNetwork>>;
  getConnectionInfo(): Promise<WifiConnection | null>;
  /** Periodic scanning driven natively; results are pushed via `GOps.WifiScan` events. */
  setAutoScan(enabled: boolean, intervalMs: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GOpsWifiScanner');
