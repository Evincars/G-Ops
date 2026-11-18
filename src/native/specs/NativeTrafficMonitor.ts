import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type TrafficTotals = {
  timestamp: number;
  rxBytes: number;
  txBytes: number;
  mobileRxBytes: number;
  mobileTxBytes: number;
  rxPackets: number;
  txPackets: number;
};

export type AppTraffic = {
  uid: number;
  packageName: string;
  label: string;
  rxBytes: number;
  txBytes: number;
  wifiBytes: number;
  mobileBytes: number;
};

export interface Spec extends TurboModule {
  /** Device-wide counters from android.net.TrafficStats (real time, no permission needed). */
  getTotals(): Promise<TrafficTotals>;
  /** Per-app stats need the "Usage access" special permission (PACKAGE_USAGE_STATS). */
  hasUsageAccess(): Promise<boolean>;
  openUsageAccessSettings(): void;
  getAppUsage(sinceMs: number): Promise<Array<AppTraffic>>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GOpsTraffic');
