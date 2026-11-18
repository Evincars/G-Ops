import React, { useMemo } from 'react';
import { ScrollView, useWindowDimensions, View } from 'react-native';
import Svg, { G, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { WifiNetwork } from '../../native';
import { useTheme } from '../../theme/ThemeContext';
import { hash } from '../../utils/format';
import { Band, BANDS, channelToFreq } from './wifiUtils';

const DBM_TOP = -20;
const DBM_BOTTOM = -100;
const PAD_LEFT = 30;
const PAD_BOTTOM = 22;
const PAD_TOP = 8;

/**
 * Classic "Wi-Fi analyzer" view: each AP is a curve spanning its real channel width
 * (20/40/80/160/320 MHz) with height = signal strength. Same SSID = same colour.
 */
export function ChannelGraph({
  networks,
  band,
  height = 240,
  highlightBssid,
}: {
  networks: WifiNetwork[];
  band: Band;
  height?: number;
  highlightBssid?: string;
}) {
  const { theme } = useTheme();
  const { width: screenW } = useWindowDimensions();
  const spec = BANDS[band];
  const span = spec.maxFreq - spec.minFreq;
  const plotW = Math.max(screenW - 48 - PAD_LEFT, span * spec.pxPerMhz);
  const width = plotW + PAD_LEFT + 8;
  const plotH = height - PAD_BOTTOM - PAD_TOP;

  const x = (f: number) => PAD_LEFT + ((f - spec.minFreq) / span) * plotW;
  const y = (dbm: number) =>
    PAD_TOP +
    ((DBM_TOP - Math.max(DBM_BOTTOM, Math.min(DBM_TOP, dbm))) /
      (DBM_TOP - DBM_BOTTOM)) *
      plotH;
  const base = y(DBM_BOTTOM);

  const curves = useMemo(
    () =>
      networks
        .filter(n => n.band === band)
        .sort((a, b) => a.level - b.level) // strongest drawn last (on top)
        .map(n => {
          const x0 = x(n.centerFrequency - n.channelWidth / 2);
          const x1 = x(n.centerFrequency + n.channelWidth / 2);
          const xc = (x0 + x1) / 2;
          const yp = y(n.level);
          const color =
            theme.chart[hash(n.ssid || n.bssid) % theme.chart.length];
          // quadratic bezier whose apex sits exactly at the signal level
          const d = `M ${x0} ${base} Q ${xc} ${2 * yp - base} ${x1} ${base}`;
          return { n, d, xc, yp, color };
        }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [networks, band, theme, plotW, height],
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View>
        <Svg width={width} height={height}>
          <Rect
            x={PAD_LEFT}
            y={PAD_TOP}
            width={plotW}
            height={plotH}
            fill={theme.colors.bg}
            fillOpacity={0.5}
          />
          {[-30, -50, -70, -90].map(db => (
            <G key={db}>
              <Line
                x1={PAD_LEFT}
                x2={PAD_LEFT + plotW}
                y1={y(db)}
                y2={y(db)}
                stroke={theme.colors.grid}
                strokeWidth={1}
              />
              <SvgText
                x={2}
                y={y(db) + 3}
                fontSize={9}
                fill={theme.colors.textFaint}
                fontFamily={theme.fontMono}
              >
                {db}
              </SvgText>
            </G>
          ))}
          {spec.ticks.map(ch => {
            const fx = x(channelToFreq(band, ch));
            return (
              <G key={ch}>
                <Line
                  x1={fx}
                  x2={fx}
                  y1={PAD_TOP}
                  y2={base}
                  stroke={theme.colors.grid}
                  strokeWidth={1}
                />
                <SvgText
                  x={fx}
                  y={height - 6}
                  fontSize={9}
                  fill={theme.colors.textDim}
                  textAnchor="middle"
                  fontFamily={theme.fontMono}
                >
                  {ch}
                </SvgText>
              </G>
            );
          })}
          {curves.map(({ n, d, xc, yp, color }) => {
            const hl = highlightBssid && n.bssid === highlightBssid;
            return (
              <G key={n.bssid}>
                <Path
                  d={d}
                  fill={color}
                  fillOpacity={hl ? 0.3 : 0.1}
                  stroke={color}
                  strokeWidth={hl ? 2.5 : 1.3}
                />
                <SvgText
                  x={xc}
                  y={Math.max(PAD_TOP + 9, yp - 4)}
                  fontSize={9}
                  fill={color}
                  textAnchor="middle"
                  fontFamily={theme.fontMono}
                >
                  {(n.ssid || '<hidden>').slice(0, 14)}
                </SvgText>
              </G>
            );
          })}
          <Line
            x1={PAD_LEFT}
            x2={PAD_LEFT + plotW}
            y1={base}
            y2={base}
            stroke={theme.colors.borderStrong}
            strokeWidth={1}
          />
        </Svg>
      </View>
    </ScrollView>
  );
}
