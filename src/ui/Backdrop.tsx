import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Defs, Line, Pattern, Rect } from 'react-native-svg';
import { useTheme } from '../theme/ThemeContext';

/** Blueprint grid + optional CRT scanlines, drawn behind/over every screen. */
export function GridBackdrop() {
  const { theme } = useTheme();
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern
            id="grid"
            width={24}
            height={24}
            patternUnits="userSpaceOnUse"
          >
            <Line
              x1={0}
              y1={0}
              x2={24}
              y2={0}
              stroke={theme.colors.grid}
              strokeWidth={1}
            />
            <Line
              x1={0}
              y1={0}
              x2={0}
              y2={24}
              stroke={theme.colors.grid}
              strokeWidth={1}
            />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#grid)" />
      </Svg>
    </View>
  );
}

export function Scanlines() {
  const { scanlines } = useTheme();
  if (!scanlines) return null;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <Pattern id="scan" width={4} height={3} patternUnits="userSpaceOnUse">
            <Rect width={4} height={1} fill="rgba(0,0,0,0.28)" />
          </Pattern>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#scan)" />
      </Svg>
    </View>
  );
}
