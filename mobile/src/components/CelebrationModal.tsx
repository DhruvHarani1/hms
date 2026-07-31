import { useEffect, useRef } from 'react';
import { View, Text, Modal, Animated, Pressable, Dimensions } from 'react-native';
import { colors } from '@/src/lib/theme';

interface Badge {
  id: string;
  name: string;
  icon: string;
  desc: string;
}

interface Props {
  visible: boolean;
  badge: Badge | null;
  onDismiss: () => void;
}

const { width: SCREEN_W } = Dimensions.get('window');

// Simple confetti-like dots using Animated
function ConfettiDot({ delay, x, color }: { delay: number; x: number; color: string }) {
  const translateY = useRef(new Animated.Value(-20)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    Animated.sequence([
      Animated.delay(delay),
      Animated.parallel([
        Animated.timing(translateY, { toValue: 180, duration: 1200, useNativeDriver: true }),
        Animated.sequence([
          Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }),
          Animated.delay(600),
          Animated.timing(opacity, { toValue: 0, duration: 400, useNativeDriver: true }),
        ]),
        Animated.timing(scale, { toValue: 1, duration: 600, useNativeDriver: true }),
      ]),
    ]).start();
  }, []);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        top: 60,
        left: x,
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    />
  );
}

const CONFETTI_COLORS = ['#f97316', '#eab308', '#22c55e', '#6366f1', '#ec4899', '#06b6d4'];

export default function CelebrationModal({ visible, badge, onDismiss }: Props) {
  const scaleAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      scaleAnim.setValue(0);
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 80,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!badge) return null;

  // Generate confetti positions
  const confetti = Array.from({ length: 18 }, (_, i) => ({
    delay: Math.random() * 400,
    x: Math.random() * (SCREEN_W - 40),
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
  }));

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <Pressable
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
        onPress={onDismiss}
      >
        {/* Confetti */}
        {confetti.map((c, i) => (
          <ConfettiDot key={i} delay={c.delay} x={c.x} color={c.color} />
        ))}

        <Animated.View
          style={{
            transform: [{ scale: scaleAnim }],
            backgroundColor: colors.card,
            borderRadius: 24,
            padding: 32,
            alignItems: 'center',
            gap: 16,
            width: SCREEN_W - 64,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.3,
            shadowRadius: 20,
            elevation: 10,
          }}
        >
          <Text style={{ fontSize: 64 }}>{badge.icon}</Text>
          <Text style={{ fontSize: 22, fontWeight: '900', color: colors.text, textAlign: 'center' }}>
            Badge Unlocked! 🎉
          </Text>
          <Text style={{ fontSize: 18, fontWeight: '700', color: colors.primary }}>
            {badge.name}
          </Text>
          <Text style={{ fontSize: 14, color: colors.muted, textAlign: 'center', lineHeight: 20 }}>
            {badge.desc}
          </Text>
          <Pressable
            onPress={onDismiss}
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 32,
              paddingVertical: 12,
              borderRadius: 999,
              marginTop: 8,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 15 }}>Awesome!</Text>
          </Pressable>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
