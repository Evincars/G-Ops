/**
 * Three switchable "skins". Every colour used in the UI comes from here – never hard-code colours
 * in components, so a new theme is just one more object.
 */
export type ThemeId = 'neon' | 'matrix' | 'amber';

export type Theme = {
  id: ThemeId;
  name: string;
  tagline: string;
  dark: true;
  colors: {
    bg: string;
    surface: string;
    surfaceAlt: string;
    border: string;
    borderStrong: string;
    primary: string;
    accent: string;
    text: string;
    textDim: string;
    textFaint: string;
    ok: string;
    warn: string;
    danger: string;
    grid: string;
    glow: string;
  };
  /** Distinct series colours for charts (SSIDs, apps...). */
  chart: string[];
  fontMono: string;
  radius: number;
};

const neon: Theme = {
  id: 'neon',
  name: 'NEON//GRID',
  tagline: 'cyberdeck · cyan × magenta',
  dark: true,
  colors: {
    bg: '#05070D',
    surface: '#0A1020',
    surfaceAlt: '#0F1830',
    border: '#16304A',
    borderStrong: '#1F5C7A',
    primary: '#00F0FF',
    accent: '#FF2BD6',
    text: '#D7F9FF',
    textDim: '#7FA6B8',
    textFaint: '#3E5A6B',
    ok: '#39FF88',
    warn: '#FFC400',
    danger: '#FF3B5C',
    grid: 'rgba(0,240,255,0.06)',
    glow: 'rgba(0,240,255,0.35)',
  },
  chart: [
    '#00F0FF',
    '#FF2BD6',
    '#39FF88',
    '#FFC400',
    '#8A7BFF',
    '#FF7A45',
    '#00B3FF',
    '#C6FF3D',
    '#FF5C8A',
    '#5CFFE1',
  ],
  fontMono: 'monospace',
  radius: 2,
};

const matrix: Theme = {
  id: 'matrix',
  name: 'MATRIX//PHOSPHOR',
  tagline: 'green phosphor terminal',
  dark: true,
  colors: {
    bg: '#010601',
    surface: '#041104',
    surfaceAlt: '#071A08',
    border: '#0F3A14',
    borderStrong: '#1A6B24',
    primary: '#00FF66',
    accent: '#B6FF00',
    text: '#B8FFC8',
    textDim: '#5FAF72',
    textFaint: '#2C5A36',
    ok: '#00FF66',
    warn: '#E5FF00',
    danger: '#FF4D4D',
    grid: 'rgba(0,255,102,0.05)',
    glow: 'rgba(0,255,102,0.35)',
  },
  chart: [
    '#00FF66',
    '#B6FF00',
    '#00E5B0',
    '#7DFF9B',
    '#E5FF00',
    '#3DDC84',
    '#00C2FF',
    '#9EFF4D',
    '#66FFCC',
    '#C8FF80',
  ],
  fontMono: 'monospace',
  radius: 0,
};

const amber: Theme = {
  id: 'amber',
  name: 'AMBER//CRT',
  tagline: 'retro VT220 amber monitor',
  dark: true,
  colors: {
    bg: '#0A0602',
    surface: '#140C04',
    surfaceAlt: '#1D1206',
    border: '#3A2408',
    borderStrong: '#7A4A0C',
    primary: '#FFB000',
    accent: '#FF6A00',
    text: '#FFD9A0',
    textDim: '#B3874A',
    textFaint: '#5E4220',
    ok: '#C8FF4D',
    warn: '#FFE066',
    danger: '#FF4F2E',
    grid: 'rgba(255,176,0,0.05)',
    glow: 'rgba(255,176,0,0.30)',
  },
  chart: [
    '#FFB000',
    '#FF6A00',
    '#FFE066',
    '#FF8F5A',
    '#E8C27A',
    '#FF4F2E',
    '#FFD24D',
    '#D98A2B',
    '#FFC48A',
    '#C8FF4D',
  ],
  fontMono: 'monospace',
  radius: 1,
};

export const THEMES: Record<ThemeId, Theme> = { neon, matrix, amber };
export const THEME_ORDER: ThemeId[] = ['neon', 'matrix', 'amber'];
export const DEFAULT_THEME: ThemeId = 'neon';
