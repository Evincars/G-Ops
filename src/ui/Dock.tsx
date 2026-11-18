import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { FEATURES, HOME } from '../features/catalog';
import { useRouter } from '../navigation/Router';
import { Theme } from '../theme/themes';
import { useStyles } from '../theme/ThemeContext';
import { Mono } from './Text';

/** Bottom dock generated from the feature registry. */
export function Dock({ bottomInset }: { bottomInset: number }) {
  const s = useStyles(makeStyles);
  const { current, navigate, reset } = useRouter();
  const items = [
    HOME,
    ...FEATURES.filter(f => f.inDock && f.status !== 'planned'),
  ];
  return (
    <View style={[s.dock, { paddingBottom: Math.max(bottomInset, 6) }]}>
      {items.map(f => {
        const active = current === f.id;
        return (
          <Pressable
            key={f.id}
            style={s.item}
            onPress={() => (f.id === HOME.id ? reset() : navigate(f.id))}
            hitSlop={4}
          >
            <Mono size={18} tone={active ? 'primary' : 'faint'} glow={active}>
              {f.glyph}
            </Mono>
            <Mono
              size={8}
              tone={active ? 'primary' : 'faint'}
              upper
              numberOfLines={1}
            >
              {f.id}
            </Mono>
            {active ? <View style={s.activeBar} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    dock: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.borderStrong,
      backgroundColor: `${t.colors.surface}F2`,
      paddingTop: 6,
    },
    item: { flex: 1, alignItems: 'center', gap: 1 },
    activeBar: {
      position: 'absolute',
      top: -6,
      height: 2,
      width: 28,
      backgroundColor: t.colors.primary,
    },
  });
