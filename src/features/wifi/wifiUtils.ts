import type { WifiNetwork } from '../../native';

export type Band = '2.4' | '5' | '6';

export type BandSpec = {
  band: Band;
  label: string;
  /** Frequency window drawn on the x axis (MHz). */
  minFreq: number;
  maxFreq: number;
  /** Channels labelled on the axis. */
  ticks: number[];
  /** Pixels per MHz before scaling to screen width. */
  pxPerMhz: number;
};

export const BANDS: Record<Band, BandSpec> = {
  '2.4': {
    band: '2.4',
    label: '2.4 GHz',
    minFreq: 2400,
    maxFreq: 2496,
    ticks: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    pxPerMhz: 3.6,
  },
  '5': {
    band: '5',
    label: '5 GHz',
    minFreq: 5150,
    maxFreq: 5905,
    ticks: [36, 44, 52, 60, 100, 108, 116, 124, 132, 140, 149, 157, 165, 173],
    pxPerMhz: 1.3,
  },
  '6': {
    band: '6',
    label: '6 GHz',
    minFreq: 5925,
    maxFreq: 7125,
    ticks: [1, 33, 65, 97, 129, 161, 193, 225],
    pxPerMhz: 0.9,
  },
};

export function channelToFreq(band: Band, ch: number): number {
  if (band === '2.4') return ch === 14 ? 2484 : 2407 + ch * 5;
  if (band === '5') return 5000 + ch * 5;
  return 5950 + ch * 5;
}

export type SortKey = 'signal' | 'ssid' | 'channel';

export function sortNetworks(list: WifiNetwork[], key: SortKey): WifiNetwork[] {
  const out = [...list];
  if (key === 'signal') out.sort((a, b) => b.level - a.level);
  else if (key === 'ssid')
    out.sort((a, b) => (a.ssid || '￿').localeCompare(b.ssid || '￿'));
  else out.sort((a, b) => a.frequency - b.frequency || b.level - a.level);
  return out;
}

export type SecurityGrade = 'bad' | 'weak' | 'ok' | 'good';

export function securityGrade(sec: string): SecurityGrade {
  if (sec === 'OPEN' || sec === 'WEP') return 'bad';
  if (sec === 'WPA' || sec === 'WPA/WPA2' || sec === 'OWE') return 'weak';
  if (sec.startsWith('WPA3') || sec === 'WPA2/WPA3') return 'good';
  return 'ok';
}

/** How many APs overlap each 20 MHz channel – congestion indicator. */
export function channelCongestion(
  list: WifiNetwork[],
  band: Band,
): { channel: number; count: number; strongest: number }[] {
  const spec = BANDS[band];
  const res = spec.ticks.map(ch => ({
    channel: ch,
    count: 0,
    strongest: -127,
  }));
  for (const n of list) {
    if (n.band !== band) continue;
    const lo = n.centerFrequency - n.channelWidth / 2;
    const hi = n.centerFrequency + n.channelWidth / 2;
    for (const r of res) {
      const f = channelToFreq(band, r.channel);
      if (f > lo && f < hi) {
        r.count++;
        r.strongest = Math.max(r.strongest, n.level);
      }
    }
  }
  return res;
}
