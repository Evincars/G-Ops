import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Svg, { Polyline, Polygon, Line } from 'react-native-svg';
import { Theme } from '../theme/themes';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { signalBars } from '../utils/format';
import { Mono } from './Text';

/* ------------------------------------------------------------------ stat tile */

export function Stat({
  label,
  value,
  tone = 'text',
  sub,
}: {
  label: string;
  value: string;
  tone?: 'text' | 'primary' | 'accent' | 'ok' | 'warn' | 'danger';
  sub?: string;
}) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.stat}>
      <Mono size={9} tone="dim" upper>
        {label}
      </Mono>
      <Mono size={18} bold tone={tone} glow numberOfLines={1}>
        {value}
      </Mono>
      {sub ? (
        <Mono size={9} tone="faint" numberOfLines={1}>
          {sub}
        </Mono>
      ) : null}
    </View>
  );
}

export function StatRow({ children }: { children: React.ReactNode }) {
  const s = useStyles(makeStyles);
  return <View style={s.statRow}>{children}</View>;
}

/* ------------------------------------------------------------------ key : value */

export function KV({
  k,
  v,
  tone,
}: {
  k: string;
  v: string;
  tone?: 'text' | 'primary' | 'ok' | 'warn' | 'danger' | 'dim';
}) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.kv}>
      <Mono size={11} tone="dim">
        {k.padEnd(10, '.')}
      </Mono>
      <Mono
        size={11}
        tone={tone ?? 'text'}
        style={s.kvValue}
        numberOfLines={1}
        selectable
      >
        {v || '—'}
      </Mono>
    </View>
  );
}

/* ------------------------------------------------------------------ signal bars ▂▄▆█ */

export function SignalBars({ dbm }: { dbm: number }) {
  const { theme } = useTheme();
  const bars = signalBars(dbm);
  const color =
    bars >= 3
      ? theme.colors.ok
      : bars === 2
      ? theme.colors.warn
      : theme.colors.danger;
  return (
    <View style={barsStyle.row}>
      {[0, 1, 2, 3].map(i => (
        <View
          key={i}
          style={[
            barsStyle.bar,
            {
              height: 4 + i * 3,
              backgroundColor: i < bars ? color : theme.colors.border,
            },
          ]}
        />
      ))}
    </View>
  );
}

const barsStyle = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 2, height: 14 },
  bar: { width: 3 },
});

/* ------------------------------------------------------------------ ascii progress */

export function Progress({
  done,
  total,
  width = 24,
}: {
  done: number;
  total: number;
  width?: number;
}) {
  const pct = total > 0 ? Math.min(1, done / total) : 0;
  const filled = Math.round(pct * width);
  return (
    <Mono size={11} tone="primary">
      {'['}
      {'█'.repeat(filled)}
      <Mono size={11} tone="faint">
        {'░'.repeat(width - filled)}
      </Mono>
      {`] ${Math.round(pct * 100)}%  ${done}/${total}`}
    </Mono>
  );
}

/* ------------------------------------------------------------------ sparkline */

export function Sparkline({
  values,
  width,
  height = 48,
  color,
  fill = true,
  max,
  style,
}: {
  values: number[];
  width: number;
  height?: number;
  color?: string;
  fill?: boolean;
  max?: number;
  style?: ViewStyle;
}) {
  const { theme } = useTheme();
  const c = color ?? theme.colors.primary;
  const n = values.length;
  const top = Math.max(1, max ?? Math.max(...values, 1));
  const pts = values.map((v, i) => {
    const x = n <= 1 ? width : (i / (n - 1)) * width;
    const y = height - (Math.max(0, v) / top) * (height - 2) - 1;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  return (
    <View style={style}>
      <Svg width={width} height={height}>
        {[0.25, 0.5, 0.75].map(f => (
          <Line
            key={f}
            x1={0}
            x2={width}
            y1={height * f}
            y2={height * f}
            stroke={theme.colors.grid}
            strokeWidth={1}
          />
        ))}
        {fill && n > 1 ? (
          <Polygon
            points={`0,${height} ${pts.join(' ')} ${width},${height}`}
            fill={c}
            fillOpacity={0.12}
          />
        ) : null}
        {n > 1 ? (
          <Polyline
            points={pts.join(' ')}
            fill="none"
            stroke={c}
            strokeWidth={1.5}
          />
        ) : null}
      </Svg>
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    stat: {
      flex: 1,
      paddingVertical: 6,
      paddingHorizontal: 8,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.borderStrong,
      backgroundColor: t.colors.surfaceAlt,
    },
    statRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    kv: { flexDirection: 'row', paddingVertical: 1 },
    kvValue: { flex: 1 },
  });
