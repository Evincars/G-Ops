import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Theme } from '../theme/themes';
import { useStyles } from '../theme/ThemeContext';
import { Cursor, Mono } from './Text';

export function Header({
  code,
  title,
  onBack,
  right,
}: {
  code: string;
  title: string;
  onBack?: () => void;
  right?: React.ReactNode;
}) {
  const s = useStyles(makeStyles);
  return (
    <View style={s.header}>
      {onBack ? (
        <Pressable onPress={onBack} hitSlop={12} style={s.back}>
          <Mono size={16} tone="primary" bold>
            {'<'}
          </Mono>
        </Pressable>
      ) : null}
      <View style={s.titles}>
        <Mono size={10} tone="dim">
          {`g-ops://${code}`}
        </Mono>
        <View style={s.titleRow}>
          <Mono size={20} bold tone="primary" glow upper>
            {title}
          </Mono>
          <Cursor size={18} />
        </View>
      </View>
      {right}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      backgroundColor: `${t.colors.bg}E6`,
    },
    back: { paddingRight: 12, paddingVertical: 4 },
    titles: { flex: 1 },
    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  });
