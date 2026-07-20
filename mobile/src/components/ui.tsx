import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '@/src/lib/theme';

export function Card({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  return (
    <View
      style={[
        {
          backgroundColor: colors.card,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function Button({
  title,
  onPress,
  loading,
  disabled,
  variant = 'primary',
}: {
  title: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'danger';
}) {
  const bg =
    variant === 'primary'
      ? colors.primary
      : variant === 'danger'
        ? colors.danger
        : 'transparent';
  const fg = variant === 'outline' ? colors.primary : '#fff';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={{
        backgroundColor: bg,
        borderWidth: variant === 'outline' ? 1 : 0,
        borderColor: colors.primary,
        paddingVertical: 14,
        borderRadius: 12,
        alignItems: 'center',
        opacity: disabled || loading ? 0.6 : 1,
      }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={{ color: fg, fontWeight: '700', fontSize: 16 }}>
          {title}
        </Text>
      )}
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label?: string }) {
  const { label, secureTextEntry, ...rest } = props;
  // For password fields, show an eye button to toggle visibility.
  const [hidden, setHidden] = React.useState(!!secureTextEntry);
  const isPassword = !!secureTextEntry;

  return (
    <View style={{ gap: 6 }}>
      {label ? (
        <Text style={{ color: colors.muted, fontWeight: '600' }}>{label}</Text>
      ) : null}
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          placeholderTextColor={colors.muted}
          secureTextEntry={isPassword ? hidden : false}
          {...rest}
          style={{
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 12,
            padding: 14,
            paddingRight: isPassword ? 52 : 14,
            fontSize: 16,
            backgroundColor: '#fff',
            color: colors.text,
          }}
        />
        {isPassword ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            style={{ position: 'absolute', right: 14 }}
          >
            <Text style={{ fontSize: 18 }}>{hidden ? '👁️' : '🙈'}</Text>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

export function Screen({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
      {children}
    </View>
  );
}

export function H1({ children }: { children: React.ReactNode }) {
  return (
    <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
      {children}
    </Text>
  );
}

export function Muted({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: TextStyle;
}) {
  return (
    <Text style={[{ color: colors.muted }, style]}>
      {children}
    </Text>
  );
}
