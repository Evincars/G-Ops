import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type DnsQuery = {
  id: number;
  timestamp: number;
  domain: string;
  qtype: string; // A, AAAA, HTTPS, ...
  uid: number;
  packageName: string;
  appLabel: string;
  blocked: boolean;
  rcode: string; // NOERROR | NXDOMAIN | SERVFAIL | TIMEOUT | BLOCKED
  answers: Array<string>;
  latencyMs: number;
};

export type DnsStatus = {
  running: boolean;
  upstream: string;
  virtualDns: string;
  queries: number;
  blocked: number;
};

export interface Spec extends TurboModule {
  /** Shows the system VPN consent dialog if needed. Resolves true when consent is granted. */
  prepareVpn(): Promise<boolean>;
  /** upstream: IPv4 of the resolver to forward to; '' = use DNS of the underlying network. */
  start(upstream: string): Promise<boolean>;
  stop(): void;
  getStatus(): Promise<DnsStatus>;
  getRecent(limit: number): Promise<Array<DnsQuery>>;
  clearRecent(): void;
  getBlocklist(): Promise<Array<string>>;
  /** Blocking a domain also blocks all of its subdomains. Resolves the new blocklist. */
  setBlocked(domain: string, blocked: boolean): Promise<Array<string>>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('GOpsDns');
