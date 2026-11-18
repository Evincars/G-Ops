/**
 * Multi-feature catalog. A new feature = new folder in src/features + one entry here + its screen
 * in registry.ts
 * (+ a Java TurboModule if it needs native code). Home grid and dock are generated from this.
 */
export type Feature = {
  id: string;
  code: string; // shown as g-ops://<code>
  title: string;
  subtitle: string;
  glyph: string; // single-char icon for the dock
  status: 'ready' | 'beta' | 'planned';
  inDock?: boolean;
};

export const FEATURES: Feature[] = [
  {
    id: 'wifi',
    code: '01/wifi.scan',
    title: 'WiFi Recon',
    subtitle: 'APs, channels, signal, security',
    glyph: '≋',
    status: 'ready',
    inDock: true,
  },
  {
    id: 'lan',
    code: '02/lan.ports',
    title: 'LAN Portscan',
    subtitle: 'host discovery + TCP connect scan',
    glyph: '⌖',
    status: 'ready',
    inDock: true,
  },
  {
    id: 'paranoid',
    code: '03/paranoid',
    title: 'Paranoid',
    subtitle: 'live traffic · per-app · DNS firewall',
    glyph: '◉',
    status: 'beta',
    inDock: true,
  },
  {
    id: 'settings',
    code: '04/sys.config',
    title: 'Sys Config',
    subtitle: 'themes, device, about',
    glyph: '⚙',
    status: 'ready',
    inDock: true,
  },
  {
    id: 'ble',
    code: '05/ble.recon',
    title: 'BLE Recon',
    subtitle: 'Bluetooth LE beacons & trackers',
    glyph: 'ᛒ',
    status: 'planned',
  },
  {
    id: 'cell',
    code: '06/cell.intel',
    title: 'Cell Intel',
    subtitle: 'serving cell, neighbours, IMSI-catcher hints',
    glyph: '⌬',
    status: 'planned',
  },
];

export const HOME: Feature = {
  id: 'home',
  code: '00/root',
  title: 'G-Ops',
  subtitle: 'GrapheneOS field kit',
  glyph: '⌂',
  status: 'ready',
  inDock: true,
};
