import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

const MEALS = [
  { type: 'breakfast', label: 'Breakfast', emoji: '🍳', color: colors.breakfast },
  { type: 'lunch', label: 'Lunch', emoji: '🍛', color: colors.lunch },
  { type: 'dinner', label: 'Dinner', emoji: '🌙', color: colors.dinner },
] as const;

export default function CookHome() {
  const [sending, setSending] = useState<string | null>(null);

  const { data: menu, refetch, isRefetching } = useQuery({
    queryKey: ['today-menu'],
    queryFn: async () => (await api.get('/meals/menu')).data,
  });

  async function ready(type: string, label: string) {
    setSending(type);
    try {
      const res = await api.post('/notifications/meal', { mealType: type });
      Alert.alert('✅ Sent', `"${label} is ready" sent to ${res.data.notified} people.`);
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
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} />}
    >
      <H1>Mark meal ready</H1>
      <Muted>Tap when the food is ready — everyone gets notified.</Muted>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        {MEALS.map((m) => (
          <Pressable
            key={m.type}
            onPress={() => ready(m.type, m.label)}
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

      <H1>Today's Menu</H1>
      {MEALS.map((m) => (
        <Card key={m.type} style={{ gap: 4 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>
            {m.emoji} {m.label}
          </Text>
          {menu?.[m.type]?.length ? (
            <Text style={{ color: colors.text }}>{menu[m.type].join(', ')}</Text>
          ) : (
            <Muted>Not set yet.</Muted>
          )}
        </Card>
      ))}
    </ScrollView>
  );
}
