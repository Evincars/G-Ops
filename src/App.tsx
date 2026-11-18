import React from 'react';
import { StatusBar, StyleSheet, View } from 'react-native';
import {
  SafeAreaProvider,
  useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { HOME, SCREENS } from './features/registry';
import { RouterProvider, useRouter } from './navigation/Router';
import { ThemeProvider, useTheme } from './theme/ThemeContext';
import { GridBackdrop, Scanlines } from './ui';
import { Dock } from './ui/Dock';

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <RouterProvider initial={HOME.id}>
          <Shell />
        </RouterProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

function Shell() {
  const { theme } = useTheme();
  const { current } = useRouter();
  const insets = useSafeAreaInsets();
  const Current = SCREENS[current] ?? SCREENS[HOME.id];
  return (
    <View
      style={[
        styles.root,
        { backgroundColor: theme.colors.bg, paddingTop: insets.top },
      ]}
    >
      <StatusBar barStyle="light-content" />
      <GridBackdrop />
      <View style={styles.root}>
        <Current />
      </View>
      <Dock bottomInset={insets.bottom} />
      <Scanlines />
    </View>
  );
}

const styles = StyleSheet.create({ root: { flex: 1 } });
