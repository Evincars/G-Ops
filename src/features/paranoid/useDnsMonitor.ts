import { useCallback, useEffect, useRef, useState } from 'react';
import { DnsMonitor, DnsQuery, DnsStatus, subscribe } from '../../native';

const MAX_ENTRIES = 400;

export function useDnsMonitor() {
  const [status, setStatus] = useState<DnsStatus | null>(null);
  const [entries, setEntries] = useState<DnsQuery[]>([]);
  const [blocklist, setBlocklist] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  /** Snapshot shown while the live feed is paused (new entries keep being collected). */
  const [frozen, setFrozen] = useState<DnsQuery[] | null>(null);

  const entriesRef = useRef(entries);
  entriesRef.current = entries;

  const refresh = useCallback(async () => {
    setStatus(await DnsMonitor.getStatus());
  }, []);

  useEffect(() => {
    refresh();
    DnsMonitor.getRecent(MAX_ENTRIES).then(setEntries);
    DnsMonitor.getBlocklist().then(setBlocklist);
    const sub = subscribe('GOps.Dns', e => {
      if (e.type === 'state') {
        refresh();
        return;
      }
      const { type, ...q } = e;
      if (type !== 'query') return;
      setEntries(list => [q, ...list].slice(0, MAX_ENTRIES));
      setStatus(s =>
        s
          ? {
              ...s,
              queries: s.queries + 1,
              blocked: s.blocked + (q.blocked ? 1 : 0),
            }
          : s,
      );
    });
    return () => sub.remove();
  }, [refresh]);

  const start = useCallback(
    async (upstream: string) => {
      setError(null);
      try {
        const ok = await DnsMonitor.prepareVpn();
        if (!ok) {
          setError('VPN consent denied');
          return;
        }
        await DnsMonitor.start(upstream);
        setTimeout(refresh, 600);
      } catch (e: any) {
        setError(String(e?.message ?? e));
      }
    },
    [refresh],
  );

  const stop = useCallback(() => {
    DnsMonitor.stop();
    setTimeout(refresh, 400);
  }, [refresh]);

  const setBlocked = useCallback(async (domain: string, blocked: boolean) => {
    setBlocklist(await DnsMonitor.setBlocked(domain, blocked));
  }, []);

  const setPaused = useCallback(
    (p: boolean) => setFrozen(p ? entriesRef.current : null),
    [],
  );

  const clear = useCallback(() => {
    DnsMonitor.clearRecent();
    setEntries([]);
    setFrozen(f => (f ? [] : null));
  }, []);

  /** Mirrors DnsBlocklist.isBlocked on the Java side (suffix match). */
  const isBlocked = useCallback(
    (domain: string) => {
      let d = domain.toLowerCase();
      while (d) {
        if (blocklist.includes(d)) return true;
        const i = d.indexOf('.');
        if (i < 0) return false;
        d = d.slice(i + 1);
      }
      return false;
    },
    [blocklist],
  );

  return {
    status,
    entries: frozen ?? entries,
    blocklist,
    error,
    paused: frozen != null,
    setPaused,
    start,
    stop,
    setBlocked,
    isBlocked,
    clear,
  };
}
