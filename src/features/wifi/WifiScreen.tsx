import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import type { WifiNetwork } from '../../native';
import { DeviceInfo } from '../../native';
import { Theme } from '../../theme/themes';
import { useStyles, useTheme } from '../../theme/ThemeContext';
import {
  KV,
  Mono,
  Panel,
  Screen,
  Segmented,
  SignalBars,
  Stat,
  StatRow,
  Tag,
  TButton,
  Toggle,
} from '../../ui';
import { formatAgo, formatTime } from '../../utils/format';
import { ChannelGraph } from './ChannelGraph';
import { useWifiScan } from './useWifiScan';
import { Band, securityGrade, SortKey, sortNetworks } from './wifiUtils';

type BandFilter = 'all' | Band;

export function WifiScreen() {
  const s = useStyles(makeStyles);
  const { theme } = useTheme();
  const wifi = useWifiScan();
  const [band, setBand] = useState<Band>('2.4');
  const [listBand, setListBand] = useState<BandFilter>('all');
  const [sort, setSort] = useState<SortKey>('signal');
  const [expanded, setExpanded] = useState<string | null>(null);

  const list = useMemo(
    () =>
      sortNetworks(
        wifi.networks.filter(n => listBand === 'all' || n.band === listBand),
        sort,
      ),
    [wifi.networks, listBand, sort],
  );
  const counts = useMemo(() => {
    const c = { '2.4': 0, '5': 0, '6': 0, open: 0 };
    for (const n of wifi.networks) {
      if (n.band in c) c[n.band as Band]++;
      if (securityGrade(n.security) === 'bad') c.open++;
    }
    return c;
  }, [wifi.networks]);

  if (wifi.permitted === false) {
    return (
      <Screen code="01/wifi.scan" title="WiFi Recon">
        <Panel title="permission denied" accent>
          <Mono tone="warn">
            Scan results need "Location" (precise) + "Nearby devices" permission
            and the location toggle ON.
          </Mono>
          <TButton
            label="open app settings"
            onPress={() => DeviceInfo.openAppSettings()}
            style={s.mt}
          />
        </Panel>
      </Screen>
    );
  }

  return (
    <Screen code="01/wifi.scan" title="WiFi Recon">
      <StatRow>
        <Stat
          label="APs"
          value={String(wifi.networks.length)}
          tone="primary"
          sub={`2.4:${counts['2.4']} 5:${counts['5']} 6:${counts['6']}`}
        />
        <Stat
          label="weak sec"
          value={String(counts.open)}
          tone={counts.open ? 'danger' : 'ok'}
          sub="open / WEP"
        />
        <Stat
          label="last scan"
          value={wifi.lastScan ? formatTime(wifi.lastScan) : '--:--:--'}
          tone={wifi.lastScanOk ? 'text' : 'warn'}
          sub={wifi.lastScanOk ? `#${wifi.scanCount}` : 'cached (throttled)'}
        />
      </StatRow>

      {wifi.status &&
      (!wifi.status.locationEnabled ||
        wifi.status.scanThrottleEnabled ||
        !wifi.status.wifiEnabled) ? (
        <Panel title="warnings" accent>
          {!wifi.status.wifiEnabled ? (
            <Mono tone="danger">! Wi-Fi is OFF</Mono>
          ) : null}
          {!wifi.status.locationEnabled ? (
            <Mono tone="warn">
              ! Location is OFF → Android returns no scan results
            </Mono>
          ) : null}
          {wifi.status.scanThrottleEnabled ? (
            <Mono tone="warn" size={11}>
              ! Scan throttling ON (4 scans / 2 min). GrapheneOS: Settings →
              System → Developer options → "Wi-Fi scan throttling" → off.
            </Mono>
          ) : null}
        </Panel>
      ) : null}

      <View style={s.actions}>
        <TButton
          label="scan"
          onPress={wifi.scan}
          busy={wifi.scanning}
          style={s.flex}
        />
        <View style={s.flex}>
          <Toggle
            label="auto 8s"
            value={wifi.autoScan}
            onChange={on => wifi.setAutoScan(on, 8000)}
          />
        </View>
      </View>
      {wifi.error ? (
        <Mono tone="warn" size={11} style={s.mb}>
          {`! ${wifi.error}`}
        </Mono>
      ) : null}

      {wifi.connection ? (
        <Panel title="link">
          <KV k="ssid" v={wifi.connection.ssid} tone="primary" />
          <KV k="bssid" v={wifi.connection.bssid} />
          <KV
            k="rssi"
            v={`${wifi.connection.rssi} dBm @ ${wifi.connection.frequency} MHz`}
          />
          <KV
            k="phy"
            v={`${wifi.connection.wifiStandard} · tx ${wifi.connection.txLinkSpeedMbps} / rx ${wifi.connection.rxLinkSpeedMbps} Mbps`}
          />
          <KV k="ip" v={wifi.connection.ipAddress} />
        </Panel>
      ) : null}

      <Panel title="spectrum" padded={false}>
        <Segmented
          options={[
            { value: '2.4', label: '2.4 GHz' },
            { value: '5', label: '5 GHz' },
            { value: '6', label: '6 GHz' },
          ]}
          value={band}
          onChange={setBand}
          style={s.segment}
        />
        <View style={s.graph}>
          <ChannelGraph
            networks={wifi.networks}
            band={band}
            highlightBssid={wifi.connection?.bssid}
          />
        </View>
      </Panel>

      <Panel
        title={`networks (${list.length})`}
        right={
          <Pressable
            onPress={() =>
              setSort(
                sort === 'signal'
                  ? 'ssid'
                  : sort === 'ssid'
                  ? 'channel'
                  : 'signal',
              )
            }
          >
            <Mono size={10} tone="accent">{`sort:${sort}`}</Mono>
          </Pressable>
        }
      >
        <Segmented
          options={[
            { value: 'all', label: 'all' },
            { value: '2.4', label: '2.4' },
            { value: '5', label: '5' },
            { value: '6', label: '6' },
          ]}
          value={listBand}
          onChange={setListBand}
          style={s.mb}
        />
        {list.length === 0 ? (
          <Mono tone="faint">no networks – hit [ SCAN ]</Mono>
        ) : null}
        {list.map(n => (
          <NetworkRow
            key={n.bssid}
            n={n}
            connected={n.bssid === wifi.connection?.bssid}
            expanded={expanded === n.bssid}
            onPress={() => setExpanded(expanded === n.bssid ? null : n.bssid)}
            theme={theme}
          />
        ))}
      </Panel>
    </Screen>
  );
}

function NetworkRow({
  n,
  connected,
  expanded,
  onPress,
  theme,
}: {
  n: WifiNetwork;
  connected: boolean;
  expanded: boolean;
  onPress: () => void;
  theme: Theme;
}) {
  const s = useStyles(makeStyles);
  const grade = securityGrade(n.security);
  const secColor = {
    bad: theme.colors.danger,
    weak: theme.colors.warn,
    ok: theme.colors.primary,
    good: theme.colors.ok,
  }[grade];
  return (
    <Pressable onPress={onPress} style={[s.row, connected && s.rowConnected]}>
      <View style={s.rowTop}>
        <SignalBars dbm={n.level} />
        <Mono
          bold
          style={s.flex}
          numberOfLines={1}
          tone={n.hidden ? 'faint' : 'text'}
        >
          {n.hidden ? '<hidden>' : n.ssid}
          {connected ? <Mono tone="ok"> ●</Mono> : null}
        </Mono>
        <Mono size={12} tone="primary">{`${n.level} dBm`}</Mono>
      </View>
      <View style={s.tags}>
        <Tag label={`ch ${n.channel}`} color={theme.colors.primary} />
        <Tag label={`${n.band} GHz`} />
        <Tag label={`${n.channelWidth} MHz`} />
        <Tag label={n.security} color={secColor} />
        {n.wifiStandard !== 'unknown' ? <Tag label={n.wifiStandard} /> : null}
        {n.wps ? <Tag label="WPS" color={theme.colors.warn} /> : null}
        {n.mldMac ? <Tag label="MLO" color={theme.colors.accent} /> : null}
      </View>
      {expanded ? (
        <View style={s.details}>
          <KV k="bssid" v={n.bssid} />
          <KV
            k="freq"
            v={`${n.frequency} MHz (center ${n.centerFrequency}, ch ${n.centerChannel})`}
          />
          <KV k="caps" v={n.capabilities} />
          {n.mldMac ? <KV k="mld mac" v={n.mldMac} /> : null}
          <KV k="802.11mc" v={n.rttResponder ? 'yes (RTT/FTM)' : 'no'} />
          <KV k="seen" v={`${formatAgo(n.ageMs)} ago`} />
        </View>
      ) : null}
    </Pressable>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    mt: { marginTop: 10 },
    mb: { marginBottom: 8 },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 12,
    },
    segment: { margin: 10, marginBottom: 6 },
    graph: { paddingHorizontal: 6, paddingBottom: 8 },
    row: {
      paddingVertical: 8,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    rowConnected: { backgroundColor: `${t.colors.ok}0D` },
    rowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      marginTop: 2,
      marginLeft: 22,
    },
    details: { marginTop: 6, marginLeft: 22 },
  });
