export function formatBytes(b: number, digits = 1): string {
  if (!isFinite(b) || b < 0) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let i = 0;
  let v = b;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(i === 0 ? 0 : digits)} ${units[i]}`;
}

export const formatRate = (bytesPerSec: number) =>
  `${formatBytes(bytesPerSec)}/s`;

export function formatAgo(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  return `${Math.floor(s / 3600)}h`;
}

export function formatTime(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/** Rough dBm -> 0..100 % (−100 dBm = 0, −40 dBm = 100). */
export const signalPercent = (dbm: number) =>
  Math.max(0, Math.min(100, Math.round(((dbm + 100) / 60) * 100)));

export const signalBars = (dbm: number) =>
  dbm >= -55 ? 4 : dbm >= -67 ? 3 : dbm >= -75 ? 2 : dbm >= -85 ? 1 : 0;

export const pad = (s: string | number, n: number) => String(s).padEnd(n, ' ');

/** Stable small hash for colour assignment. */
export function hash(s: string): number {
  let h = 0;
  // eslint-disable-next-line no-bitwise
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
