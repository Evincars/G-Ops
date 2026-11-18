import { useEffect, useRef, useState } from 'react';
import { TrafficMonitor, TrafficTotals } from '../../native';

export type ThroughputSample = { ts: number; rx: number; tx: number };

/** Polls device-wide TrafficStats counters and derives bytes/s. */
export function useThroughput(intervalMs = 1000, historySize = 60) {
  const [history, setHistory] = useState<ThroughputSample[]>([]);
  const [totals, setTotals] = useState<TrafficTotals | null>(null);
  const prev = useRef<TrafficTotals | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      const t = await TrafficMonitor.getTotals();
      if (!alive) return;
      const p = prev.current;
      prev.current = t;
      setTotals(t);
      if (!p) return;
      const dt = Math.max(0.001, (t.timestamp - p.timestamp) / 1000);
      const sample = {
        ts: t.timestamp,
        rx: Math.max(0, (t.rxBytes - p.rxBytes) / dt),
        tx: Math.max(0, (t.txBytes - p.txBytes) / dt),
      };
      setHistory(h => [...h, sample].slice(-historySize));
    };
    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [intervalMs, historySize]);

  const last = history[history.length - 1];
  return { history, totals, rx: last?.rx ?? 0, tx: last?.tx ?? 0 };
}
