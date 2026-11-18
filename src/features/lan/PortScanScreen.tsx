import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Theme } from '../../theme/themes';
import { useStyles } from '../../theme/ThemeContext';
import {
  Field,
  KV,
  Mono,
  Panel,
  Progress,
  Screen,
  Segmented,
  Tag,
  TButton,
  Toggle,
} from '../../ui';
import { formatTime } from '../../utils/format';
import { Speed, usePortScan } from './usePortScan';

type PortPreset = 'homelab' | 'top100' | '1-1024' | 'all' | 'custom';

const PRESETS: { value: PortPreset; label: string }[] = [
  { value: 'homelab', label: 'homelab' },
  { value: 'top100', label: 'top100' },
  { value: '1-1024', label: '1-1024' },
  { value: 'all', label: 'all' },
  { value: 'custom', label: 'custom' },
];

export function PortScanScreen() {
  const s = useStyles(makeStyles);
  const scan = usePortScan();
  const [target, setTarget] = useState('');
  const [preset, setPreset] = useState<PortPreset>('homelab');
  const [custom, setCustom] = useState('22,80,443,8000-8100');
  const [speed, setSpeed] = useState<Speed>('normal');
  const [banners, setBanners] = useState(true);
  const [resolve, setResolve] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const busy = scan.phase !== 'idle';

  // prefill target with the LAN subnet
  useEffect(() => {
    if (!target && scan.lan?.cidr) setTarget(scan.lan.cidr);
  }, [scan.lan, target]);

  // auto-select every discovered host
  useEffect(() => {
    setSelected(new Set(scan.hosts.map(h => h.ip)));
  }, [scan.hosts]);

  const ports = preset === 'custom' ? custom : preset;
  const scanTargets =
    selected.size > 0
      ? [...selected]
      : target.includes('/')
      ? []
      : [target.trim()].filter(Boolean);

  const toggleHost = (ip: string) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ip)) next.delete(ip);
      else next.add(ip);
      return next;
    });

  return (
    <Screen code="02/lan.ports" title="LAN Portscan">
      <Panel
        title="interface"
        right={
          <Pressable onPress={scan.refreshLan}>
            <Mono size={10} tone="accent">
              refresh
            </Mono>
          </Pressable>
        }
      >
        <KV
          k="iface"
          v={`${scan.lan?.interfaceName ?? ''} (${scan.lan?.transport ?? '?'})`}
        />
        <KV
          k="ip"
          v={
            scan.lan?.ipAddress
              ? `${scan.lan.ipAddress}/${scan.lan.prefixLength}`
              : ''
          }
          tone="primary"
        />
        <KV k="subnet" v={scan.lan?.cidr ?? ''} />
        <KV k="gateway" v={scan.lan?.gateway ?? ''} />
        <KV k="dns" v={scan.lan?.dnsServers.join(', ') ?? ''} />
      </Panel>

      <Panel title="target">
        <Field
          label="hosts (cidr / range / ip)"
          value={target}
          onChangeText={setTarget}
          placeholder="192.168.1.0/24"
          keyboardType="numbers-and-punctuation"
        />
        <Mono size={10} tone="dim" upper style={s.label}>
          ports
        </Mono>
        <Segmented
          options={PRESETS}
          value={preset}
          onChange={setPreset}
          style={s.mb}
        />
        {preset === 'custom' ? (
          <Field
            value={custom}
            onChangeText={setCustom}
            placeholder="22,80,443,8000-8100"
          />
        ) : null}
        <Mono size={10} tone="dim" upper style={s.label}>
          timing
        </Mono>
        <Segmented
          options={[
            { value: 'fast', label: 'fast' },
            { value: 'normal', label: 'normal' },
            { value: 'thorough', label: 'thorough' },
          ]}
          value={speed}
          onChange={setSpeed}
          style={s.mb}
        />
        <View style={s.row}>
          <Toggle label="banners" value={banners} onChange={setBanners} />
          <Toggle label="reverse dns" value={resolve} onChange={setResolve} />
        </View>
        <View style={[s.row, s.mt]}>
          <TButton
            label="discover"
            onPress={() => scan.discover(target, speed, resolve)}
            disabled={busy || !target}
            busy={scan.phase === 'discovery'}
            style={s.flex}
          />
          <TButton
            label={`scan ${scanTargets.length || ''}`}
            variant="accent"
            onPress={() => scan.scanPorts(scanTargets, ports, speed, banners)}
            disabled={busy || scanTargets.length === 0}
            busy={scan.phase === 'ports'}
            style={s.flex}
          />
        </View>
        {busy ? (
          <View style={s.mt}>
            <Progress
              done={scan.progress.done}
              total={scan.progress.total}
              width={20}
            />
            <TButton
              label="abort"
              variant="danger"
              small
              onPress={scan.cancel}
              style={s.mt}
            />
          </View>
        ) : null}
      </Panel>

      {scan.hosts.length > 0 ? (
        <Panel title={`hosts up (${scan.hosts.length})`}>
          {scan.hosts.map(h => {
            const on = selected.has(h.ip);
            const open = scan.results[h.ip];
            return (
              <Pressable
                key={h.ip}
                onPress={() => toggleHost(h.ip)}
                style={s.host}
              >
                <View style={s.hostTop}>
                  <Mono tone={on ? 'primary' : 'faint'} bold>
                    {on ? '[x]' : '[ ]'}
                  </Mono>
                  <Mono bold style={s.ip}>
                    {h.ip}
                  </Mono>
                  <Mono size={11} tone="dim" style={s.flex} numberOfLines={1}>
                    {h.hostname}
                  </Mono>
                  <Mono size={10} tone="faint">{`${h.latencyMs}ms`}</Mono>
                </View>
                {open ? (
                  <View style={s.ports}>
                    {open.length === 0 ? (
                      <Mono size={11} tone="faint">
                        no open ports
                      </Mono>
                    ) : null}
                    {open.map(p => (
                      <View key={p.port} style={s.portRow}>
                        <Mono
                          size={11}
                          tone="ok"
                          style={s.portNum}
                        >{`${p.port}/tcp`}</Mono>
                        <Tag label={p.service} />
                        <Mono
                          size={10}
                          tone="dim"
                          style={s.flex}
                          numberOfLines={1}
                        >
                          {p.banner}
                        </Mono>
                      </View>
                    ))}
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </Panel>
      ) : null}

      {/* results for directly-scanned IPs that were not part of discovery */}
      {Object.keys(scan.results)
        .filter(ip => !scan.hosts.some(h => h.ip === ip))
        .map(ip => (
          <Panel key={ip} title={ip}>
            {scan.results[ip].map(p => (
              <View key={p.port} style={s.portRow}>
                <Mono
                  size={11}
                  tone="ok"
                  style={s.portNum}
                >{`${p.port}/tcp`}</Mono>
                <Tag label={p.service} />
                <Mono size={10} tone="dim" style={s.flex} numberOfLines={1}>
                  {p.banner}
                </Mono>
              </View>
            ))}
          </Panel>
        ))}

      <Panel
        title="console"
        right={
          <Pressable onPress={scan.clearLog}>
            <Mono size={10} tone="accent">
              clear
            </Mono>
          </Pressable>
        }
      >
        {scan.log.length === 0 ? <Mono tone="faint">_</Mono> : null}
        {scan.log.slice(0, 80).map(l => (
          <Mono key={l.id} size={10} tone={l.tone} selectable>
            <Mono size={10} tone="faint">{`${formatTime(l.ts)} `}</Mono>
            {l.text}
          </Mono>
        ))}
      </Panel>
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    flex: { flex: 1 },
    mb: { marginBottom: 8 },
    mt: { marginTop: 10 },
    label: { marginBottom: 4 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    host: {
      paddingVertical: 6,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    hostTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    ip: { width: 120 },
    ports: { marginLeft: 30, marginTop: 4 },
    portRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 1,
    },
    portNum: { width: 70 },
  });
