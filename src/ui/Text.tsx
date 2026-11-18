import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, TextProps, TextStyle } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

type Tone =
  | 'text'
  | 'dim'
  | 'faint'
  | 'primary'
  | 'accent'
  | 'ok'
  | 'warn'
  | 'danger';

export type MonoProps = TextProps & {
  size?: number;
  tone?: Tone;
  bold?: boolean;
  glow?: boolean;
  upper?: boolean;
};

/** The only text component: monospace, theme-aware. */
export function Mono({
  size = 13,
  tone = 'text',
  bold,
  glow,
  upper,
  style,
  children,
  ...rest
}: MonoProps) {
  const { theme } = useTheme();
  const c = theme.colors;
  const color = {
    text: c.text,
    dim: c.textDim,
    faint: c.textFaint,
    primary: c.primary,
    accent: c.accent,
    ok: c.ok,
    warn: c.warn,
    danger: c.danger,
  }[tone];
  const glowStyle: TextStyle | null = glow
    ? { textShadowColor: theme.colors.glow, textShadowRadius: 8 }
    : null;
  const base: TextStyle = {
    fontFamily: theme.fontMono,
    fontSize: size,
    color,
    fontWeight: bold ? '700' : '400',
    letterSpacing: upper ? 1.2 : 0.2,
    textTransform: upper ? 'uppercase' : 'none',
  };
  return (
    <Text {...rest} style={[base, glowStyle, style]}>
      {children}
    </Text>
  );
}

/** Blinking block cursor ▮ */
export function Cursor({ size = 13 }: { size?: number }) {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setOn(v => !v), 530);
    return () => clearInterval(t);
  }, []);
  return (
    <Mono
      size={size}
      tone="primary"
      style={on ? cursorStyles.on : cursorStyles.off}
    >
      ▮
    </Mono>
  );
}

const cursorStyles = StyleSheet.create({
  on: { opacity: 1 },
  off: { opacity: 0 },
});
