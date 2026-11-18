import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from '../../navigation/Router';
import { Screen, Segmented, Stat, StatRow } from '../../ui';
import { formatRate } from '../../utils/format';
import { useWifiScan } from '../wifi/useWifiScan';
import {
  AirspacePanel,
  AppsPanel,
  DnsPanel,
  ThroughputPanel,
  WindowToggle,
} from './panels';
import { useAppTraffic } from './useAppTraffic';
import { useDnsMonitor } from './useDnsMonitor';
import { useThroughput } from './useThroughput';

type Tab = 'overview' | 'apps' | 'dns';

/**
 * "Paranoid Network Dashboard": what is happening around you (airspace) and inside the phone
 * (throughput, per-app traffic, live DNS with one-tap blocking).
 */
export function ParanoidScreen() {
  const { navigate } = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [windowMs, setWindowMs] = useState(3_600_000);
  const net = useThroughput();
  const wifi = useWifiScan({ autoStart: true, intervalMs: 10_000 });
  const apps = useAppTraffic(windowMs);
  const dns = useDnsMonitor();
  const windowLabel = windowMs === 3_600_000 ? 'last 1h' : 'last 24h';

  return (
    <Screen code="03/paranoid" title="Paranoid">
      <StatRow>
        <Stat label="rx" value={formatRate(net.rx)} tone="primary" />
        <Stat label="tx" value={formatRate(net.tx)} tone="accent" />
      </StatRow>
      <StatRow>
        <Stat
          label="dns q"
          value={String(dns.status?.queries ?? 0)}
          tone={dns.status?.running ? 'ok' : 'text'}
          sub={dns.status?.running ? 'vpn active' : 'vpn off'}
        />
        <Stat
          label="blocked"
          value={String(dns.status?.blocked ?? 0)}
          tone="danger"
          sub={`${dns.blocklist.length} rules`}
        />
        <Stat
          label="aps"
          value={String(wifi.networks.length)}
          sub={wifi.autoScan ? 'auto 10s' : 'idle'}
        />
      </StatRow>

      <Segmented
        options={[
          { value: 'overview', label: 'overview' },
          { value: 'apps', label: 'apps' },
          { value: 'dns', label: 'dns' },
        ]}
        value={tab}
        onChange={setTab}
        style={styles.tabs}
      />

      {tab === 'overview' ? (
        <>
          <ThroughputPanel history={net.history} rx={net.rx} tx={net.tx} />
          <AirspacePanel
            networks={wifi.networks}
            throttled={wifi.status?.scanThrottleEnabled ?? true}
            onOpenWifi={() => navigate('wifi')}
          />
          <AppsPanel
            granted={apps.granted}
            rows={apps.rows}
            error={apps.error}
            limit={5}
            windowLabel={windowLabel}
            onGrant={apps.openSettings}
          />
          <DnsPanel dns={dns} limit={8} compact />
        </>
      ) : null}

      {tab === 'apps' ? (
        <AppsPanel
          granted={apps.granted}
          rows={apps.rows}
          error={apps.error}
          windowLabel={windowLabel}
          onGrant={apps.openSettings}
          right={<WindowToggle value={windowMs} onChange={setWindowMs} />}
        />
      ) : null}

      {tab === 'dns' ? <DnsPanel dns={dns} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({ tabs: { marginBottom: 12 } });
