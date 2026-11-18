import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { Theme } from '../theme/themes';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { Mono } from './Text';

type Props = {
  title?: string;
  right?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
  accent?: boolean;
  padded?: boolean;
};

/** Bordered box with HUD corner brackets and a "[ TITLE ]" label. */
export function Panel({
  title,
  right,
  children,
  style,
  accent,
  padded = true,
}: Props) {
  const s = useStyles(makeStyles);
  const { theme } = useTheme();
  const cornerColor = accent ? theme.colors.accent : theme.colors.primary;
  return (
    <View style={[s.panel, style]}>
      <Corner pos="tl" color={cornerColor} />
      <Corner pos="tr" color={cornerColor} />
      <Corner pos="bl" color={cornerColor} />
      <Corner pos="br" color={cornerColor} />
      {title ? (
        <View style={s.header}>
          <Mono size={11} tone={accent ? 'accent' : 'primary'} bold upper>
            {'[ '}
            {title}
            {' ]'}
          </Mono>
          <View style={s.rule} />
          {right}
        </View>
      ) : null}
      <View style={padded ? s.body : undefined}>{children}</View>
    </View>
  );
}

function Corner({
  pos,
  color,
}: {
  pos: 'tl' | 'tr' | 'bl' | 'br';
  color: string;
}) {
  const size = 8;
  const st: ViewStyle = {
    position: 'absolute',
    width: size,
    height: size,
    borderColor: color,
  };
  if (pos[0] === 't') Object.assign(st, { top: -1, borderTopWidth: 2 });
  else Object.assign(st, { bottom: -1, borderBottomWidth: 2 });
  if (pos[1] === 'l') Object.assign(st, { left: -1, borderLeftWidth: 2 });
  else Object.assign(st, { right: -1, borderRightWidth: 2 });
  return <View style={st} pointerEvents="none" />;
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    panel: {
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.radius,
      marginBottom: 12,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
      paddingTop: 8,
      gap: 8,
    },
    rule: {
      flex: 1,
      height: StyleSheet.hairlineWidth,
      backgroundColor: t.colors.border,
    },
    body: { padding: 10 },
  });
