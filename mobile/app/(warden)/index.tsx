import { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Text,
  View,
  RefreshControl,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

const MEALS = [
  { type: 'breakfast', label: 'Breakfast', emoji: '🍳', color: colors.breakfast },
  { type: 'lunch', label: 'Lunch', emoji: '🍛', color: colors.lunch },
  { type: 'dinner', label: 'Dinner', emoji: '🌙', color: colors.dinner },
] as const;

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <Card style={{ flex: 1, minWidth: 150 }}>
      <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>
        {value}
      </Text>
      <Muted>{label}</Muted>
    </Card>
  );
}

export default function WardenHome() {
  const qc = useQueryClient();
  const [sending, setSending] = useState<string | null>(null);

  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['warden-dashboard'],
    queryFn: async () => (await api.get('/dashboard/warden')).data,
  });

  async function sendMeal(type: string, label: string) {
    setSending(type);
    try {
      const res = await api.post('/notifications/meal', { mealType: type });
      Alert.alert(
        '✅ Sent',
        `"${label} is ready" pushed to ${res.data.notified} student(s).`,
      );
      qc.invalidateQueries({ queryKey: ['warden-dashboard'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Could not send.');
    } finally {
      setSending(null);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <H1>Quick Actions</H1>
      <Muted>Tap to instantly notify all students.</Muted>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        {MEALS.map((m) => (
          <Pressable
            key={m.type}
            onPress={() => sendMeal(m.type, m.label)}
            disabled={sending !== null}
            style={{
              flex: 1,
              backgroundColor: m.color,
              borderRadius: 16,
              padding: 16,
              alignItems: 'center',
              gap: 6,
              opacity: sending && sending !== m.type ? 0.5 : 1,
            }}
          >
            <Text style={{ fontSize: 32 }}>{m.emoji}</Text>
            <Text style={{ color: '#fff', fontWeight: '700' }}>{m.label}</Text>
            <Text style={{ color: '#fff', fontSize: 12 }}>
              {sending === m.type ? 'Sending…' : 'Ready'}
            </Text>
          </Pressable>
        ))}
      </View>

      <H1>Overview</H1>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
        <Stat label="Total Students" value={data?.totalStudents ?? '—'} />
        <Stat label="Pending Complaints" value={data?.pendingComplaints ?? '—'} />
      </View>

      <Card style={{ alignItems: 'center', gap: 2 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>
          Ate today
        </Text>
        <Text style={{ fontSize: 30, fontWeight: '800', color: colors.primary }}>
          {data?.ateToday ?? 0}
          <Text style={{ fontSize: 18, color: colors.muted }}>
            {' '}
            / {data?.totalStudents ?? 0}
          </Text>
        </Text>
        <Muted>students marked a meal today</Muted>
      </Card>
    </ScrollView>
  );
}
