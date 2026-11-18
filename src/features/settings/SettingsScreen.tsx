import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { DeviceInfo } from '../../native';
import { Theme, THEMES, THEME_ORDER } from '../../theme/themes';
import { useStyles, useTheme } from '../../theme/ThemeContext';
import { Mono, Panel, Screen, TButton, Toggle } from '../../ui';

export function SettingsScreen() {
  const s = useStyles(makeStyles);
  const { themeId, setThemeId, scanlines, setScanlines } = useTheme();

  return (
    <Screen code="04/sys.config" title="Sys Config">
      <Panel title="skin">
        {THEME_ORDER.map(id => {
          const t = THEMES[id];
          const active = id === themeId;
          return (
            <Pressable
              key={id}
              onPress={() => setThemeId(id)}
              style={[
                s.themeCard,
                {
                  backgroundColor: t.colors.bg,
                  borderColor: active ? t.colors.primary : t.colors.border,
                },
              ]}
            >
              <View style={s.themeHead}>
                <Mono size={14} bold style={{ color: t.colors.primary }}>
                  {active ? '▶ ' : '  '}
                  {t.name}
                </Mono>
              </View>
              <Mono size={10} style={{ color: t.colors.textDim }}>
                {t.tagline}
              </Mono>
              <View style={s.palette}>
                {[
                  t.colors.primary,
                  t.colors.accent,
                  t.colors.ok,
                  t.colors.warn,
                  t.colors.danger,
                  t.colors.text,
                ].map(c => (
                  <View key={c} style={[s.chip, { backgroundColor: c }]} />
                ))}
              </View>
              <Mono size={10} style={{ color: t.colors.text }}>
                <Mono size={10} style={{ color: t.colors.primary }}>
                  {'root@pixel10'}
                </Mono>
                <Mono size={10} style={{ color: t.colors.textDim }}>
                  {':~$ '}
                </Mono>
                {'gops --scan --paranoid'}
              </Mono>
            </Pressable>
          );
        })}
        <Toggle
          label="CRT scanlines overlay"
          value={scanlines}
          onChange={setScanlines}
        />
      </Panel>

      <Panel title="grapheneos checklist">
        {[
          [
            'Network permission',
            'GrapheneOS per-app "Network" toggle must be ON for G-Ops.',
          ],
          [
            'Location + Nearby devices',
            'Needed for Wi-Fi scan results (Android API rule). Location toggle must be ON.',
          ],
          [
            'Wi-Fi scan throttling',
            'Developer options → "Wi-Fi scan throttling" OFF for continuous scanning.',
          ],
          [
            'Usage access',
            'Special app access → Usage access → G-Ops (per-app traffic).',
          ],
          [
            'Private DNS',
            '"Off" or "Automatic" while the DNS monitor runs – strict mode bypasses it.',
          ],
          [
            'One VPN only',
            'The DNS monitor is a local VPN; it replaces any other active VPN.',
          ],
        ].map(([k, v]) => (
          <View key={k} style={s.tip}>
            <Mono size={12} tone="primary" bold>{`» ${k}`}</Mono>
            <Mono size={11} tone="dim">
              {v}
            </Mono>
          </View>
        ))}
        <TButton
          label="app permissions"
          variant="ghost"
          onPress={() => DeviceInfo.openAppSettings()}
          style={s.mt}
        />
      </Panel>

      <Panel title="about">
        <Mono size={11} tone="dim">
          G-Ops – modular network field kit for GrapheneOS on Pixel 10. Java
          TurboModules + React Native UI. Scans only private address ranges.
        </Mono>
      </Panel>
    </Screen>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    mt: { marginTop: 8 },
    themeCard: {
      borderWidth: 1,
      padding: 10,
      marginBottom: 8,
      gap: 4,
      borderRadius: t.radius,
    },
    themeHead: { flexDirection: 'row', alignItems: 'center' },
    palette: { flexDirection: 'row', gap: 4, marginVertical: 4 },
    chip: { width: 18, height: 8 },
    tip: { marginBottom: 8 },
  });
