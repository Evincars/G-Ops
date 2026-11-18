import { useCallback, useEffect, useRef, useState } from 'react';
import {
  HostInfo,
  LanInfo,
  OpenPort,
  PortScanner,
  subscribe,
} from '../../native';
import { formatTime } from '../../utils/format';

export type LogLine = {
  id: number;
  ts: number;
  text: string;
  tone: 'text' | 'dim' | 'ok' | 'warn' | 'danger' | 'primary';
};
export type Phase = 'idle' | 'discovery' | 'ports';
export type Speed = 'fast' | 'normal' | 'thorough';

const SPEED: Record<
  Speed,
  { discovery: number; port: number; threads: number }
> = {
  fast: { discovery: 250, port: 200, threads: 192 },
  normal: { discovery: 500, port: 400, threads: 128 },
  thorough: { discovery: 1200, port: 1000, threads: 64 },
};

const MAX_LOG = 300;
let logId = 0;

export function usePortScan() {
  const [lan, setLan] = useState<LanInfo | null>(null);
  const [hosts, setHosts] = useState<HostInfo[]>([]);
  const [results, setResults] = useState<Record<string, OpenPort[]>>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [log, setLog] = useState<LogLine[]>([]);
  const scanId = useRef<string | null>(null);

  const push = useCallback((text: string, tone: LogLine['tone'] = 'text') => {
    setLog(l =>
      [{ id: ++logId, ts: Date.now(), text, tone }, ...l].slice(0, MAX_LOG),
    );
  }, []);

  const refreshLan = useCallback(async () => {
    const info = await PortScanner.getLanInfo();
    setLan(info);
    return info;
  }, []);

  useEffect(() => {
    refreshLan().then(info =>
      push(
        info.connected
          ? `iface ${info.interfaceName} ${info.ipAddress}/${info.prefixLength} gw ${info.gateway}`
          : 'no LAN',
        'dim',
      ),
    );
    const sub = subscribe('GOps.PortScan', e => {
      if (e.scanId !== scanId.current) return;
      switch (e.type) {
        case 'progress':
          setProgress({ done: e.done, total: e.total });
          break;
        case 'host':
          setHosts(h => (h.some(x => x.ip === e.host.ip) ? h : [...h, e.host]));
          push(
            `host up  ${e.host.ip.padEnd(15)} ${e.host.hostname || ''} [${
              e.host.method
            }] ${e.host.latencyMs}ms`,
            'ok',
          );
          break;
        case 'port':
          setResults(r => ({
            ...r,
            [e.ip]: [...(r[e.ip] ?? []), e.port].sort(
              (a, b) => a.port - b.port,
            ),
          }));
          push(
            `open     ${e.ip}:${e.port.port}/tcp ${e.port.service}${
              e.port.banner ? `  «${e.port.banner}»` : ''
            }`,
            'primary',
          );
          break;
        case 'done':
          push(
            `${e.phase} ${e.cancelled ? 'aborted' : 'finished'} @ ${formatTime(
              Date.now(),
            )}`,
            e.cancelled ? 'warn' : 'dim',
          );
          break;
      }
    });
    return () => {
      sub.remove();
      if (scanId.current) PortScanner.cancel(scanId.current);
    };
  }, [push, refreshLan]);

  const discover = useCallback(
    async (target: string, speed: Speed, resolveHostnames: boolean) => {
      const id = `d${Date.now()}`;
      scanId.current = id;
      setHosts([]);
      setResults({});
      setProgress({ done: 0, total: 0 });
      setPhase('discovery');
      push(`$ discover ${target} --timeout ${SPEED[speed].discovery}ms`, 'dim');
      try {
        const found = await PortScanner.discoverHosts(id, target, {
          timeoutMs: SPEED[speed].discovery,
          threads: 64,
          resolveHostnames,
        });
        setHosts(found);
        push(`${found.length} host(s) up`, 'ok');
        return found;
      } catch (e: any) {
        push(`error: ${e?.message ?? e}`, 'danger');
        return [];
      } finally {
        setPhase('idle');
      }
    },
    [push],
  );

  const scanPorts = useCallback(
    async (
      targets: string[],
      ports: string,
      speed: Speed,
      grabBanners: boolean,
    ) => {
      if (targets.length === 0) return;
      const id = `p${Date.now()}`;
      scanId.current = id;
      setResults(r => {
        const next = { ...r };
        for (const t of targets) delete next[t];
        return next;
      });
      setProgress({ done: 0, total: 0 });
      setPhase('ports');
      push(
        `$ portscan ${targets.length} host(s) -p ${ports} --timeout ${SPEED[speed].port}ms`,
        'dim',
      );
      try {
        const res = await PortScanner.scanPorts(id, targets, ports, {
          timeoutMs: SPEED[speed].port,
          threads: SPEED[speed].threads,
          grabBanners,
        });
        const open = res.reduce((n, h) => n + h.openPorts.length, 0);
        push(
          `${open} open port(s) on ${res.length} host(s) in ${
            (res[0]?.durationMs ?? 0) / 1000
          }s`,
          'ok',
        );
      } catch (e: any) {
        push(`error: ${e?.message ?? e}`, 'danger');
      } finally {
        setPhase('idle');
      }
    },
    [push],
  );

  const cancel = useCallback(() => {
    if (scanId.current) PortScanner.cancel(scanId.current);
  }, []);

  return {
    lan,
    refreshLan,
    hosts,
    results,
    phase,
    progress,
    log,
    discover,
    scanPorts,
    cancel,
    clearLog: () => setLog([]),
  };
}
