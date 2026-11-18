import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subscribe,
  WifiConnection,
  WifiNetwork,
  WifiScanner,
  WifiStatus,
} from '../../native';
import { ensureWifiPermissions } from '../../native/permissions';

export type WifiScanState = {
  permitted: boolean | null;
  status: WifiStatus | null;
  networks: WifiNetwork[];
  connection: WifiConnection | null;
  lastScan: number;
  lastScanOk: boolean;
  scanning: boolean;
  autoScan: boolean;
  scanCount: number;
  error: string | null;
  scan: () => Promise<void>;
  setAutoScan: (on: boolean, intervalMs?: number) => void;
};

/**
 * Wi-Fi scan state shared by the WiFi screen and the Paranoid dashboard.
 * Results arrive as `GOps.WifiScan` events from the native BroadcastReceiver.
 */
export function useWifiScan({
  autoStart = false,
  intervalMs = 8000,
} = {}): WifiScanState {
  const [permitted, setPermitted] = useState<boolean | null>(null);
  const [status, setStatus] = useState<WifiStatus | null>(null);
  const [networks, setNetworks] = useState<WifiNetwork[]>([]);
  const [connection, setConnection] = useState<WifiConnection | null>(null);
  const [lastScan, setLastScan] = useState(0);
  const [lastScanOk, setLastScanOk] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [autoScan, setAutoScanState] = useState(false);
  const [scanCount, setScanCount] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const interval = useRef(intervalMs);

  const refreshMeta = useCallback(async () => {
    const [st, conn] = await Promise.all([
      WifiScanner.getStatus(),
      WifiScanner.getConnectionInfo(),
    ]);
    setStatus(st);
    setConnection(conn);
  }, []);

  useEffect(() => {
    let alive = true;
    const sub = subscribe('GOps.WifiScan', e => {
      if (!alive) return;
      setNetworks(e.results);
      setLastScan(e.timestamp);
      setLastScanOk(e.success);
      setScanning(false);
      setScanCount(c => c + 1);
    });
    (async () => {
      const ok = await ensureWifiPermissions();
      if (!alive) return;
      setPermitted(ok);
      await refreshMeta();
      if (!ok) return;
      setNetworks(await WifiScanner.getScanResults());
      if (autoStart) {
        WifiScanner.setAutoScan(true, interval.current);
        setAutoScanState(true);
      }
    })().catch(e => setError(String(e?.message ?? e)));
    return () => {
      alive = false;
      sub.remove();
      WifiScanner.setAutoScan(false, interval.current);
    };
  }, [autoStart, refreshMeta]);

  const scan = useCallback(async () => {
    setError(null);
    setScanning(true);
    try {
      const accepted = await WifiScanner.startScan();
      if (!accepted) {
        setScanning(false);
        setError(
          'scan throttled by Android – disable "Wi-Fi scan throttling" in Developer options',
        );
      }
      await refreshMeta();
    } catch (e: any) {
      setScanning(false);
      setError(String(e?.message ?? e));
    }
  }, [refreshMeta]);

  const setAutoScan = useCallback((on: boolean, ms?: number) => {
    if (ms) interval.current = ms;
    WifiScanner.setAutoScan(on, interval.current);
    setAutoScanState(on);
  }, []);

  return {
    permitted,
    status,
    networks,
    connection,
    lastScan,
    lastScanOk,
    scanning,
    autoScan,
    scanCount,
    error,
    scan,
    setAutoScan,
  };
}
