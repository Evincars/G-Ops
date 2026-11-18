import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AppTraffic, TrafficMonitor } from '../../native';

export type AppTrafficRow = AppTraffic & { delta: number };

/**
 * Per-app totals from NetworkStatsManager over a window (needs "Usage access").
 * `delta` = bytes since the previous poll – a rough "who is talking right now" signal.
 */
export function useAppTraffic(windowMs: number, pollMs = 10_000) {
  const [granted, setGranted] = useState<boolean | null>(null);
  const [rows, setRows] = useState<AppTrafficRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const prev = useRef<Map<number, number>>(new Map());

  const checkAccess = useCallback(async () => {
    const ok = await TrafficMonitor.hasUsageAccess();
    setGranted(ok);
    return ok;
  }, []);

  const poll = useCallback(async () => {
    try {
      const list = await TrafficMonitor.getAppUsage(Date.now() - windowMs);
      const next = new Map<number, number>();
      setRows(
        list.map(a => {
          const total = a.rxBytes + a.txBytes;
          next.set(a.uid, total);
          const before = prev.current.get(a.uid);
          return {
            ...a,
            delta: before == null ? 0 : Math.max(0, total - before),
          };
        }),
      );
      prev.current = next;
      setError(null);
    } catch (e: any) {
      setError(String(e?.message ?? e));
    }
  }, [windowMs]);

  useEffect(() => {
    let id: ReturnType<typeof setInterval> | undefined;
    prev.current = new Map();
    checkAccess().then(ok => {
      if (!ok) return;
      poll();
      id = setInterval(poll, pollMs);
    });
    // re-check after returning from the Settings screen
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') {
        checkAccess().then(ok => {
          if (ok && !id) {
            poll();
            id = setInterval(poll, pollMs);
          }
        });
      }
    });
    return () => {
      if (id) clearInterval(id);
      sub.remove();
    };
  }, [checkAccess, poll, pollMs]);

  return {
    granted,
    rows,
    error,
    openSettings: () => TrafficMonitor.openUsageAccessSettings(),
  };
}
