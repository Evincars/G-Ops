import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { Theme } from '../theme/themes';
import { useStyles, useTheme } from '../theme/ThemeContext';
import { Mono } from './Text';

/* ------------------------------------------------------------------ [ BUTTON ] */

type ButtonProps = {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger' | 'accent';
  disabled?: boolean;
  busy?: boolean;
  style?: ViewStyle;
  small?: boolean;
};

export function TButton({
  label,
  onPress,
  variant = 'primary',
  disabled,
  busy,
  style,
  small,
}: ButtonProps) {
  const s = useStyles(makeStyles);
  const { theme } = useTheme();
  const color =
    variant === 'danger'
      ? theme.colors.danger
      : variant === 'accent'
      ? theme.colors.accent
      : theme.colors.primary;
  const filled = variant !== 'ghost';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        s.button,
        small && s.buttonSmall,
        {
          borderColor: color,
          backgroundColor: filled ? `${color}1A` : 'transparent',
        },
        pressed && { backgroundColor: `${color}40` },
        (disabled || busy) && s.disabled,
        style,
      ]}
    >
      {busy ? (
        <ActivityIndicator size="small" color={color} style={s.spinner} />
      ) : null}
      <Mono size={small ? 11 : 13} bold upper style={{ color }}>
        {`[ ${label} ]`}
      </Mono>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ segmented tabs */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
}) {
  const s = useStyles(makeStyles);
  return (
    <View style={[s.segmented, style]}>
      {options.map(o => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={[s.segment, active && s.segmentActive]}
          >
            <Mono
              size={11}
              bold={active}
              tone="dim"
              upper
              style={active ? s.segmentActiveText : undefined}
            >
              {o.label}
            </Mono>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ toggle */

export function Toggle({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const s = useStyles(makeStyles);
  return (
    <Pressable onPress={() => onChange(!value)} style={s.toggle} hitSlop={6}>
      <Mono size={12} tone={value ? 'primary' : 'faint'} bold>
        {value ? '[■]' : '[ ]'}
      </Mono>
      <Mono size={12} tone={value ? 'text' : 'dim'}>
        {label}
      </Mono>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ text field */

export function Field({
  label,
  style,
  ...props
}: TextInputProps & { label?: string }) {
  const s = useStyles(makeStyles);
  const { theme } = useTheme();
  return (
    <View style={s.fieldWrap}>
      {label ? (
        <Mono size={10} tone="dim" upper style={s.fieldLabel}>
          {label}
        </Mono>
      ) : null}
      <View style={s.field}>
        <Mono size={13} tone="primary">
          {'> '}
        </Mono>
        <TextInput
          placeholderTextColor={theme.colors.textFaint}
          selectionColor={theme.colors.primary}
          cursorColor={theme.colors.primary}
          autoCapitalize="none"
          autoCorrect={false}
          {...props}
          style={[s.input, style]}
        />
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------ chip / tag */

export function Tag({ label, color }: { label: string; color?: string }) {
  const { theme } = useTheme();
  const c = color ?? theme.colors.textDim;
  return (
    <View
      style={[
        tagStyle.tag,
        {
          borderColor: `${c}88`,
          backgroundColor: `${c}14`,
          borderRadius: theme.radius,
        },
      ]}
    >
      <Mono size={9} bold upper style={{ color: c }}>
        {label}
      </Mono>
    </View>
  );
}

const tagStyle = StyleSheet.create({
  tag: {
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 5,
    paddingVertical: 1,
    marginRight: 4,
    marginTop: 3,
  },
});

const makeStyles = (t: Theme) =>
  StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderRadius: t.radius,
      paddingVertical: 10,
      paddingHorizontal: 12,
    },
    buttonSmall: { paddingVertical: 6, paddingHorizontal: 8 },
    disabled: { opacity: 0.4 },
    spinner: { marginRight: 8 },
    segmented: {
      flexDirection: 'row',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.borderStrong,
      borderRadius: t.radius,
      overflow: 'hidden',
    },
    segment: { flex: 1, alignItems: 'center', paddingVertical: 7 },
    segmentActive: { backgroundColor: t.colors.primary },
    segmentActiveText: { color: t.colors.bg },
    toggle: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingVertical: 4,
    },
    fieldWrap: { marginBottom: 8 },
    fieldLabel: { marginBottom: 4 },
    field: {
      flexDirection: 'row',
      alignItems: 'center',
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.borderStrong,
      backgroundColor: t.colors.bg,
      borderRadius: t.radius,
      paddingHorizontal: 8,
    },
    input: {
      flex: 1,
      color: t.colors.text,
      fontFamily: t.fontMono,
      fontSize: 13,
      paddingVertical: 8,
    },
  });
