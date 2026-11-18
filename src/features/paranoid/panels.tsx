import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import type { DnsQuery, WifiNetwork } from '../../native';
import { Theme } from '../../theme/themes';
import { useStyles, useTheme } from '../../theme/ThemeContext';
import { Field, Mono, Panel, Sparkline, Tag, TButton, Toggle } from '../../ui';
import { formatBytes, formatRate, formatTime } from '../../utils/format';
import { channelCongestion } from '../wifi/wifiUtils';
import type { AppTrafficRow } from './useAppTraffic';
import type { ThroughputSample } from './useThroughput';
import type { useDnsMonitor } from './useDnsMonitor';

/* ------------------------------------------------------------------ throughput */

export function ThroughputPanel({
  history,
  rx,
  tx,
}: {
  history: ThroughputSample[];
  rx: number;
  tx: number;
}) {
  const s = useStyles(makeStyles);
  const { theme } = useTheme();
  const { width } = useWindowDimensions();
  const w = width - 24 - 22;
  const max = Math.max(1, ...history.map(h => Math.max(h.rx, h.tx)));
  return (
    <Panel title="throughput · 60s">
      <View style={s.legend}>
        <Mono size={11} tone="primary">{`▼ rx ${formatRate(rx)}`}</Mono>
        <Mono size={11} tone="accent">{`▲ tx ${formatRate(tx)}`}</Mono>
        <Mono size={10} tone="faint">{`peak ${formatRate(max)}`}</Mono>
      </View>
      <View>
        <Sparkline
          values={history.map(h => h.rx)}
          width={w}
          height={70}
          max={max}
          color={theme.colors.primary}
        />
        <Sparkline
          values={history.map(h => h.tx)}
          width={w}
          height={70}
          max={max}
          color={theme.colors.accent}
          fill={false}
          style={StyleSheet.absoluteFill}
        />
      </View>
    </Panel>
  );
}

/* ------------------------------------------------------------------ airspace */

export function AirspacePanel({
  networks,
  throttled,
  onOpenWifi,
}: {
  networks: WifiNetwork[];
  throttled: boolean;
  onOpenWifi: () => void;
}) {
  const s = useStyles(makeStyles);
  const { theme } = useTheme();
  const c24 = useMemo(
    () => channelCongestion(networks, '2.4').filter(c => c.channel <= 13),
    [networks],
  );
  const c5 = useMemo(() => channelCongestion(networks, '5'), [networks]);
  const maxCount = Math.max(
    1,
    ...c24.map(c => c.count),
    ...c5.map(c => c.count),
  );
  const weak = networks.filter(
    n => n.security === 'OPEN' || n.security === 'WEP',
  ).length;

  const bars = (data: { channel: number; count: number }[]) => (
    <View style={s.bars}>
      {data.map(d => (
        <View key={d.channel} style={s.barCol}>
          <View style={s.barTrack}>
            <View
              style={{
                height: `${(d.count / maxCount) * 100}%`,
                backgroundColor:
                  d.count > 3
                    ? theme.colors.danger
                    : d.count > 1
                    ? theme.colors.warn
                    : theme.colors.primary,
              }}
            />
          </View>
          <Mono size={8} tone="faint">
            {d.channel}
          </Mono>
        </View>
      ))}
    </View>
  );

  return (
    <Panel
      title={`airspace · ${networks.length} APs`}
      right={
        <Pressable onPress={onOpenWifi}>
          <Mono size={10} tone="accent">
            open »
          </Mono>
        </Pressable>
      }
    >
      <Mono size={10} tone="dim">
        2.4 GHz channel load
      </Mono>
      {bars(c24)}
      <Mono size={10} tone="dim">
        5 GHz channel load
      </Mono>
      {bars(c5)}
      <View style={s.legend}>
        {weak ? (
          <Mono
            size={10}
            tone="danger"
          >{`${weak} open/WEP network(s) nearby`}</Mono>
        ) : (
          <Mono size={10} tone="ok">
            no open/WEP networks
          </Mono>
        )}
        {throttled ? (
          <Mono size={10} tone="warn">
            scan throttling ON
          </Mono>
        ) : (
          <Mono size={10} tone="ok">
            unthrottled
          </Mono>
        )}
      </View>
    </Panel>
  );
}

/* ------------------------------------------------------------------ per-app traffic */

export function AppsPanel({
  granted,
  rows,
  error,
  limit,
  windowLabel,
  onGrant,
  right,
}: {
  granted: boolean | null;
  rows: AppTrafficRow[];
  error: string | null;
  limit?: number;
  windowLabel: string;
  onGrant: () => void;
  right?: React.ReactNode;
}) {
  const s = useStyles(makeStyles);
  const shown = limit ? rows.slice(0, limit) : rows;
  const max = Math.max(1, ...rows.map(r => r.rxBytes + r.txBytes));
  return (
    <Panel title={`apps · ${windowLabel}`} right={right}>
      {granted === false ? (
        <>
          <Mono size={11} tone="warn">
            Per-app stats need "Usage access" (Settings → Apps → Special app
            access → Usage access → G-Ops).
          </Mono>
          <TButton
            label="grant usage access"
            onPress={onGrant}
            style={s.mt}
            small
          />
        </>
      ) : null}
      {error ? (
        <Mono size={11} tone="danger">
          {error}
        </Mono>
      ) : null}
      {granted && shown.length === 0 ? (
        <Mono tone="faint">collecting…</Mono>
      ) : null}
      {shown.map(r => {
        const total = r.rxBytes + r.txBytes;
        return (
          <View key={r.uid} style={s.appRow}>
            <View style={s.appTop}>
              <Mono size={12} bold style={s.flex} numberOfLines={1}>
                {r.label}
              </Mono>
              {r.delta > 0 ? (
                <Mono size={10} tone="accent">{`+${formatBytes(
                  r.delta,
                )} `}</Mono>
              ) : null}
              <Mono size={11} tone="primary">
                {formatBytes(total)}
              </Mono>
            </View>
            <View style={s.meter}>
              <View
                style={[s.meterFill, { width: `${(total / max) * 100}%` }]}
              />
            </View>
            <Mono size={9} tone="faint" numberOfLines={1}>
              {`${r.packageName} · uid ${r.uid} · ▼${formatBytes(
                r.rxBytes,
              )} ▲${formatBytes(r.txBytes)} · wifi ${formatBytes(
                r.wifiBytes,
              )} · mobile ${formatBytes(r.mobileBytes)}`}
            </Mono>
          </View>
        );
      })}
    </Panel>
  );
}

/* ------------------------------------------------------------------ DNS monitor */

type Dns = ReturnType<typeof useDnsMonitor>;

/** Rough registrable domain: last two labels ("ads.tracker.example.com" -> "example.com"). */
const baseDomain = (d: string) => d.split('.').slice(-2).join('.');

export function DnsPanel({
  dns,
  limit,
  compact,
}: {
  dns: Dns;
  limit?: number;
  compact?: boolean;
}) {
  const s = useStyles(makeStyles);
  const { theme } = useTheme();
  const [upstream, setUpstream] = useState('');
  const [filter, setFilter] = useState('');
  const [view, setView] = useState<'live' | 'blocklist'>('live');
  const running = dns.status?.running ?? false;

  const shown = useMemo(() => {
    const f = filter.trim().toLowerCase();
    const list = f
      ? dns.entries.filter(
          e =>
            e.domain.includes(f) ||
            e.appLabel.toLowerCase().includes(f) ||
            e.packageName.includes(f),
        )
      : dns.entries;
    return limit ? list.slice(0, limit) : list;
  }, [dns.entries, filter, limit]);

  return (
    <Panel
      title={`dns monitor · ${running ? 'ON' : 'OFF'}`}
      accent={running}
      right={
        !compact ? (
          <Pressable
            onPress={() => setView(view === 'live' ? 'blocklist' : 'live')}
          >
            <Mono size={10} tone="accent">
              {view === 'live' ? `blocklist (${dns.blocklist.length})` : 'live'}
            </Mono>
          </Pressable>
        ) : undefined
      }
    >
      {!compact ? (
        <>
          {!running ? (
            <Field
              label="upstream resolver (empty = network DNS)"
              value={upstream}
              onChangeText={setUpstream}
              placeholder="auto · e.g. 9.9.9.9"
              keyboardType="numbers-and-punctuation"
            />
          ) : null}
          <View style={s.rowGap}>
            {running ? (
              <TButton
                label="stop vpn"
                variant="danger"
                onPress={dns.stop}
                style={s.flex}
              />
            ) : (
              <TButton
                label="start vpn"
                onPress={() => dns.start(upstream)}
                style={s.flex}
              />
            )}
            <TButton
              label={dns.paused ? 'resume' : 'pause'}
              variant="ghost"
              onPress={() => dns.setPaused(!dns.paused)}
            />
            <TButton label="clr" variant="ghost" onPress={dns.clear} />
          </View>
          {running ? (
            <Mono size={10} tone="dim" style={s.mt}>
              {`upstream ${dns.status?.upstream} · virtual ${dns.status?.virtualDns} · ${dns.status?.queries} q · ${dns.status?.blocked} blocked`}
            </Mono>
          ) : (
            <Mono size={10} tone="faint" style={s.mt}>
              Local VPN capturing only DNS. Set Private DNS to "Off"/"Automatic"
              – strict DoT bypasses it.
            </Mono>
          )}
          {dns.error ? (
            <Mono size={11} tone="danger">{`! ${dns.error}`}</Mono>
          ) : null}
        </>
      ) : null}

      {view === 'blocklist' && !compact ? (
        <View style={s.mt}>
          {dns.blocklist.length === 0 ? (
            <Mono tone="faint">empty – tap a query to block its domain</Mono>
          ) : null}
          {dns.blocklist.map(d => (
            <View key={d} style={s.blRow}>
              <Mono size={12} tone="danger" style={s.flex}>{`✕ ${d}`}</Mono>
              <TButton
                label="unblock"
                small
                variant="ghost"
                onPress={() => dns.setBlocked(d, false)}
              />
            </View>
          ))}
        </View>
      ) : (
        <View style={s.mt}>
          {!compact ? (
            <Field
              value={filter}
              onChangeText={setFilter}
              placeholder="filter domain / app"
            />
          ) : null}
          {!compact ? (
            <Mono size={9} tone="faint" style={s.mb}>
              tap = block/unblock domain · long-press = block base domain (*.
              {'{'}base{'}'})
            </Mono>
          ) : null}
          {shown.length === 0 ? <Mono tone="faint">no queries yet</Mono> : null}
          {shown.map(e => (
            <DnsRow
              key={e.id}
              e={e}
              theme={theme}
              blocked={dns.isBlocked(e.domain)}
              onPress={() => dns.setBlocked(e.domain, !dns.isBlocked(e.domain))}
              onLongPress={() =>
                dns.setBlocked(
                  baseDomain(e.domain),
                  !dns.blocklist.includes(baseDomain(e.domain)),
                )
              }
            />
          ))}
        </View>
      )}
    </Panel>
  );
}

function DnsRow({
  e,
  theme,
  blocked,
  onPress,
  onLongPress,
}: {
  e: DnsQuery;
  theme: Theme;
  blocked: boolean;
  onPress: () => void;
  onLongPress: () => void;
}) {
  const s = useStyles(makeStyles);
  const rcColor =
    e.rcode === 'BLOCKED'
      ? theme.colors.danger
      : e.rcode === 'NOERROR'
      ? theme.colors.ok
      : theme.colors.warn;
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[s.dnsRow, blocked && s.dnsBlocked]}
    >
      <View style={s.appTop}>
        <Mono size={10} tone="faint">
          {formatTime(e.timestamp)}
        </Mono>
        <Mono
          size={12}
          tone={blocked ? 'danger' : 'text'}
          style={s.flex}
          numberOfLines={1}
        >
          {` ${e.domain}`}
        </Mono>
        <Tag label={e.qtype} />
        <Tag label={e.rcode} color={rcColor} />
      </View>
      <Mono size={9} tone="dim" numberOfLines={1}>
        {`   ${e.appLabel}${
          e.packageName && e.packageName !== e.appLabel
            ? ` (${e.packageName})`
            : ''
        } · ${e.latencyMs}ms${
          e.answers.length ? ` → ${e.answers.slice(0, 2).join(', ')}` : ''
        }`}
      </Mono>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ misc */

export function WindowToggle({
  value,
  onChange,
}: {
  value: number;
  onChange: (ms: number) => void;
}) {
  return (
    <Toggle
      label={value === 3_600_000 ? '1h' : '24h'}
      value={value === 3_600_000}
      onChange={on => onChange(on ? 3_600_000 : 86_400_000)}
    />
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    mt: { marginTop: 8 },
    mb: { marginBottom: 6 },
    legend: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginVertical: 6,
    },
    bars: { flexDirection: 'row', gap: 2, height: 52, marginVertical: 4 },
    barCol: { flex: 1, alignItems: 'center' },
    barTrack: {
      flex: 1,
      width: '100%',
      justifyContent: 'flex-end',
      backgroundColor: t.colors.surfaceAlt,
      borderBottomWidth: 1,
      borderBottomColor: t.colors.borderStrong,
    },
    appRow: {
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    appTop: { flexDirection: 'row', alignItems: 'center' },
    meter: {
      height: 3,
      backgroundColor: t.colors.surfaceAlt,
      marginVertical: 3,
    },
    meterFill: { height: 3, backgroundColor: t.colors.primary },
    rowGap: { flexDirection: 'row', gap: 8 },
    blRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
    dnsRow: {
      paddingVertical: 5,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    dnsBlocked: { backgroundColor: `${t.colors.danger}12` },
  });
