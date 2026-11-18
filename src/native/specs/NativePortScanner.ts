import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type LanInfo = {
  connected: boolean;
  interfaceName: string;
  ipAddress: string;
  prefixLength: number;
  cidr: string; // e.g. 192.168.1.0/24
  gateway: string;
  dnsServers: Array<string>;
  transport: string; // wifi | ethernet | cellular | vpn | unknown
};

export type DiscoveryOptions = {
  timeoutMs: number;
  threads: number;
  resolveHostnames: boolean;
};

export type HostInfo = {
  ip: string;
  hostname: string;
  method: string; // icmp | tcp-open | tcp-refused
  latencyMs: number;
};

export type PortScanOptions = {
  timeoutMs: number;
  threads: number;
  grabBanners: boolean;
};

export type OpenPort = {
  port: number;
  service: string;
  banner: string;
  latencyMs: number;
};

export type HostScanResult = {
  ip: string;
  openPorts: Array<OpenPort>;
  scannedPorts: number;
  durationMs: number;
};

export interface Spec extends TurboModule {
  getLanInfo(): Promise<LanInfo>;
  /**
   * target: "192.168.1.0/24" | "192.168.1.10-50" | "192.168.1.10".
   * Only private / link-local IPv4 ranges are accepted (home LAN use).
   */
  discoverHosts(
    scanId: string,
    target: string,
    options: DiscoveryOptions,
  ): Promise<Array<HostInfo>>;
  /** ports: "top100" | "top1000" | "1-1024" | "22,80,443,8000-8100" */
  scanPorts(
    scanId: string,
    hosts: Array<string>,
    ports: string,
    options: PortScanOptions,
  ): Promise<Array<HostScanResult>>;
  cancel(scanId: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GOpsPortScanner');
