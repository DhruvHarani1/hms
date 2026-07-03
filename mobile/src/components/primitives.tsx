import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius } from '@/src/lib/theme';

/* ── Skeleton (animated shimmer, no deps) ───────────────────────── */

export function Skeleton({
  height = 16,
  width = '100%',
  style,
}: {
  height?: number;
  width?: number | `${number}%` | 'auto';
  style?: ViewStyle;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 650,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 650,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        {
          height,
          width,
          borderRadius: radius.sm,
          backgroundColor: colors.skeleton,
          opacity,
        },
        style,
      ]}
    />
  );
}

/** A card-shaped skeleton row, repeated `count` times. */
export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 12, padding: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            backgroundColor: colors.card,
            borderRadius: radius.lg,
            padding: 16,
            borderWidth: 1,
            borderColor: colors.border,
            gap: 10,
          }}
        >
          <Skeleton height={18} width="60%" />
          <Skeleton height={12} width="40%" />
          <Skeleton height={12} width="90%" />
        </View>
      ))}
    </View>
  );
}

/* ── Empty & Error states ───────────────────────────────────────── */

export function EmptyState({
  emoji = '📭',
  title,
  subtitle,
}: {
  emoji?: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <View style={{ alignItems: 'center', padding: 40, gap: 8 }}>
      <Text style={{ fontSize: 44 }}>{emoji}</Text>
      <Text
        style={{
          fontSize: 16,
          fontWeight: '700',
          color: colors.text,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {subtitle ? (
        <Text style={{ color: colors.muted, textAlign: 'center' }}>
          {subtitle}
        </Text>
      ) : null}
    </View>
  );
}

export function ErrorState({ onRetry }: { onRetry?: () => void }) {
  return (
    <View style={{ alignItems: 'center', padding: 40, gap: 12 }}>
      <Text style={{ fontSize: 44 }}>⚠️</Text>
      <Text style={{ fontWeight: '700', color: colors.text }}>
        Something went wrong
      </Text>
      <Text style={{ color: colors.muted, textAlign: 'center' }}>
        Check your connection and try again.
      </Text>
      {onRetry ? (
        <Pressable
          onPress={onRetry}
          style={{
            marginTop: 4,
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: radius.md,
            backgroundColor: colors.primary,
          }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Retry</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/* ── Badge / StatusPill ─────────────────────────────────────────── */

export function Badge({
  label,
  color = colors.primary,
}: {
  label: string;
  color?: string;
}) {
  return (
    <View
      style={{
        backgroundColor: color + '22',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: radius.sm,
        alignSelf: 'flex-start',
      }}
    >
      <Text style={{ color, fontWeight: '700', fontSize: 12 }}>{label}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  // Lazy import to avoid a cycle with theme's statusColor.
  const { statusColor } = require('@/src/lib/theme');
  const color = statusColor[status] ?? colors.muted;
  return <Badge label={status.replace('_', ' ')} color={color} />;
}

/* ── SectionHeader ──────────────────────────────────────────────── */

export function SectionHeader({
  title,
  action,
}: {
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 4,
      }}
    >
      <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
        {title}
      </Text>
      {action}
    </View>
  );
}

/* ── Bell with unread badge (header button) ─────────────────────── */

export function BellButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 12 }}>
      <Text style={{ fontSize: 22 }}>🔔</Text>
      {count > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: 4,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: colors.danger,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
