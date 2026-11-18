import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type DeviceInfo = {
  manufacturer: string;
  model: string;
  device: string; // codename, e.g. "frankel" (Pixel 10)
  sdkInt: number;
  release: string;
  buildId: string;
  fingerprint: string;
  securityPatch: string;
  isGrapheneOS: boolean;
  isPixel10Family: boolean;
  appVersion: string;
};

export interface Spec extends TurboModule {
  getInfo(): Promise<DeviceInfo>;
  getPref(key: string): Promise<string | null>;
  setPref(key: string, value: string): void;
  openAppSettings(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GOpsDevice');
