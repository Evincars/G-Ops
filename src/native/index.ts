import { DeviceEventEmitter, EmitterSubscription } from 'react-native';
import DeviceInfo from './specs/NativeDeviceInfo';
import DnsMonitor from './specs/NativeDnsMonitor';
import PortScanner from './specs/NativePortScanner';
import TrafficMonitor from './specs/NativeTrafficMonitor';
import WifiScanner from './specs/NativeWifiScanner';
import type { DnsQuery } from './specs/NativeDnsMonitor';
import type { HostInfo, OpenPort } from './specs/NativePortScanner';
import type { WifiNetwork } from './specs/NativeWifiScanner';

export { DeviceInfo, DnsMonitor, PortScanner, TrafficMonitor, WifiScanner };
export type { DeviceInfo as DeviceInfoData } from './specs/NativeDeviceInfo';
export type { DnsQuery, DnsStatus } from './specs/NativeDnsMonitor';
export type {
  HostInfo,
  HostScanResult,
  LanInfo,
  OpenPort,
} from './specs/NativePortScanner';
export type { AppTraffic, TrafficTotals } from './specs/NativeTrafficMonitor';
export type {
  WifiConnection,
  WifiNetwork,
  WifiStatus,
} from './specs/NativeWifiScanner';

/* ------------------------------------------------------------------ native -> JS events */

export type WifiScanEvent = {
  success: boolean;
  timestamp: number;
  results: WifiNetwork[];
};

export type PortScanEvent = {
  scanId: string;
  phase: 'discovery' | 'ports';
} & (
  | { type: 'progress'; done: number; total: number }
  | { type: 'host'; host: HostInfo }
  | { type: 'port'; ip: string; port: OpenPort }
  | { type: 'done'; cancelled: boolean }
);

export type DnsEvent =
  | ({ type: 'query' } & DnsQuery)
  | { type: 'state'; running: boolean };

type EventMap = {
  'GOps.WifiScan': WifiScanEvent;
  'GOps.PortScan': PortScanEvent;
  'GOps.Dns': DnsEvent;
};

/** Must match com.gops.core.Events on the Java side. */
export function subscribe<K extends keyof EventMap>(
  name: K,
  cb: (e: EventMap[K]) => void,
): EmitterSubscription {
  return DeviceEventEmitter.addListener(name, cb);
}
