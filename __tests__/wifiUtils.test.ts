import {
  channelCongestion,
  securityGrade,
  sortNetworks,
} from '../src/features/wifi/wifiUtils';
import type { WifiNetwork } from '../src/native/specs/NativeWifiScanner';
import { formatBytes, signalBars } from '../src/utils/format';

const net = (p: Partial<WifiNetwork>): WifiNetwork => ({
  ssid: 'x',
  bssid: Math.random().toString(),
  hidden: false,
  level: -60,
  frequency: 2437,
  centerFrequency: 2437,
  channel: 6,
  centerChannel: 6,
  band: '2.4',
  channelWidth: 20,
  security: 'WPA2',
  capabilities: '',
  wifiStandard: 'Wi-Fi 6 (ax)',
  wps: false,
  mldMac: '',
  rttResponder: false,
  ageMs: 0,
  ...p,
});

test('security grading', () => {
  expect(securityGrade('OPEN')).toBe('bad');
  expect(securityGrade('WEP')).toBe('bad');
  expect(securityGrade('WPA/WPA2')).toBe('weak');
  expect(securityGrade('WPA2')).toBe('ok');
  expect(securityGrade('WPA3')).toBe('good');
});

test('2.4 GHz congestion counts overlapping 40 MHz networks', () => {
  const list = [
    net({ channel: 6 }),
    net({
      channel: 1,
      frequency: 2412,
      centerFrequency: 2422,
      channelWidth: 40,
    }),
  ];
  const c = channelCongestion(list, '2.4');
  expect(c.find(x => x.channel === 6)?.count).toBe(2); // own AP + the 40 MHz block (2402-2442 MHz)
  expect(c.find(x => x.channel === 1)?.count).toBe(1);
  expect(c.find(x => x.channel === 3)?.count).toBe(1); // inside the 40 MHz block
  expect(c.find(x => x.channel === 11)?.count).toBe(0);
});

test('sort by signal', () => {
  const sorted = sortNetworks(
    [net({ level: -80 }), net({ level: -40 })],
    'signal',
  );
  expect(sorted[0].level).toBe(-40);
});

test('format helpers', () => {
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(signalBars(-50)).toBe(4);
  expect(signalBars(-90)).toBe(0);
});
