import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { DeviceInfo, DeviceInfoData } from '../../native';
import { useRouter } from '../../navigation/Router';
import { Theme, THEMES, THEME_ORDER } from '../../theme/themes';
import { useStyles, useTheme } from '../../theme/ThemeContext';
import { Cursor, KV, Mono, Panel, Tag } from '../../ui';
import { FEATURES } from '../catalog';

const BANNER = ['╔═╗   ╔═╗╔═╗╔═╗', '║ ╦───║ ║╠═╝╚═╗', '╚═╝   ╚═╝╩  ╚═╝'];

export function HomeScreen() {
  const s = useStyles(makeStyles);
  const { theme, themeId, setThemeId } = useTheme();
  const { navigate } = useRouter();
  const [info, setInfo] = useState<DeviceInfoData | null>(null);

  useEffect(() => {
    DeviceInfo.getInfo().then(setInfo);
  }, []);

  return (
    <ScrollView contentContainerStyle={s.root}>
      <View style={s.bannerWrap}>
        {BANNER.map(l => (
          <Mono key={l} size={22} tone="primary" glow style={s.bannerLine}>
            {l}
          </Mono>
        ))}
        <View style={s.subtitle}>
          <Mono size={11} tone="dim">
            {'// grapheneos field kit · '}
          </Mono>
          <Mono size={11} tone="accent">{`v${info?.appVersion ?? '…'}`}</Mono>
          <Cursor size={11} />
        </View>
      </View>

      <Panel title="host" accent={!info?.isGrapheneOS}>
        <KV
          k="os"
          v={
            info
              ? info.isGrapheneOS
                ? 'GrapheneOS ✓'
                : 'NOT GrapheneOS ✗'
              : '…'
          }
          tone={info?.isGrapheneOS ? 'ok' : 'danger'}
        />
        <KV
          k="device"
          v={
            info
              ? `${info.model} (${info.device})${
                  info.isPixel10Family ? '' : ' – untested'
                }`
              : ''
          }
          tone={info?.isPixel10Family ? 'text' : 'warn'}
        />
        <KV
          k="android"
          v={info ? `${info.release} · API ${info.sdkInt}` : ''}
        />
        <KV k="patch" v={info?.securityPatch ?? ''} />
        <KV k="build" v={info?.buildId ?? ''} tone="dim" />
      </Panel>

      <Mono size={10} tone="dim" upper style={s.sectionLabel}>
        {'> modules'}
      </Mono>
      <View style={s.grid}>
        {FEATURES.map(f => {
          const planned = f.status === 'planned';
          return (
            <Pressable
              key={f.id}
              disabled={planned}
              onPress={() => navigate(f.id)}
              style={({ pressed }) => [
                s.tile,
                planned && s.tilePlanned,
                pressed && s.tilePressed,
              ]}
            >
              <View style={s.tileTop}>
                <Mono
                  size={22}
                  tone={planned ? 'faint' : 'primary'}
                  glow={!planned}
                >
                  {f.glyph}
                </Mono>
                <Tag
                  label={f.status}
                  color={
                    planned
                      ? theme.colors.textFaint
                      : f.status === 'beta'
                      ? theme.colors.warn
                      : theme.colors.ok
                  }
                />
              </View>
              <Mono size={9} tone="faint">
                {f.code}
              </Mono>
              <Mono size={14} bold tone={planned ? 'faint' : 'text'} upper>
                {f.title}
              </Mono>
              <Mono size={10} tone="dim" numberOfLines={2}>
                {f.subtitle}
              </Mono>
            </Pressable>
          );
        })}
      </View>

      <View style={s.themeBar}>
        <Mono size={10} tone="dim" upper>
          skin
        </Mono>
        {THEME_ORDER.map(id => (
          <Pressable
            key={id}
            onPress={() => setThemeId(id)}
            style={[s.swatch, themeId === id && s.swatchActive]}
          >
            <View
              style={[
                s.swatchDot,
                { backgroundColor: THEMES[id].colors.primary },
              ]}
            />
            <View
              style={[
                s.swatchDot,
                { backgroundColor: THEMES[id].colors.accent },
              ]}
            />
          </Pressable>
        ))}
        <Mono size={10} tone="primary" style={s.flex} numberOfLines={1}>
          {theme.name}
        </Mono>
      </View>
    </ScrollView>
  );
}

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    root: { flexGrow: 1, padding: 12 },
    flex: { flex: 1, textAlign: 'right' },
    bannerWrap: { alignItems: 'center', paddingVertical: 14 },
    bannerLine: { lineHeight: 24 },
    subtitle: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
    sectionLabel: { marginBottom: 6 },
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    tile: {
      width: '48.6%',
      minHeight: 116,
      padding: 10,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.borderStrong,
      borderLeftWidth: 2,
      borderLeftColor: t.colors.primary,
      borderRadius: t.radius,
      gap: 2,
    },
    tilePlanned: {
      borderLeftColor: t.colors.textFaint,
      borderColor: t.colors.border,
      opacity: 0.6,
    },
    tilePressed: { backgroundColor: t.colors.surfaceAlt },
    tileTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
    },
    themeBar: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginTop: 'auto',
      paddingTop: 12,
    },
    swatch: {
      flexDirection: 'row',
      padding: 4,
      gap: 3,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius,
    },
    swatchActive: { borderColor: t.colors.primary },
    swatchDot: { width: 10, height: 10 },
  });
