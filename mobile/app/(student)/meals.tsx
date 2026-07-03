import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

const MEALS = [
  { type: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { type: 'lunch', label: 'Lunch', emoji: '🍛' },
  { type: 'dinner', label: 'Dinner', emoji: '🌙' },
] as const;

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentMeals() {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);

  const { data: attendance } = useQuery({
    queryKey: ['meal-attendance'],
    queryFn: async () => (await api.get('/meals/attendance/me')).data,
  });
  const { data: stats } = useQuery({
    queryKey: ['meal-stats'],
    queryFn: async () => (await api.get('/meals/stats/me')).data,
  });

  // Pre-check meals already marked present today.
  useEffect(() => {
    if (!attendance) return;
    const t = todayStr();
    const init: Record<string, boolean> = {};
    for (const a of attendance) {
      if (a.date?.slice(0, 10) === t && a.status === 'present') {
        init[a.mealType] = true;
      }
    }
    setSelected(init);
  }, [attendance]);

  function toggle(type: string) {
    setSelected((s) => ({ ...s, [type]: !s[type] }));
  }

  async function save() {
    const meals = MEALS.filter((m) => selected[m.type]).map((m) => m.type);
    if (meals.length === 0) {
      Alert.alert('Nothing selected', 'Pick at least one meal.');
      return;
    }
    setSaving(true);
    try {
      await api.post('/meals/attendance', { date: todayStr(), meals });
      qc.invalidateQueries({ queryKey: ['meal-stats'] });
      qc.invalidateQueries({ queryKey: ['meal-attendance'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
      Alert.alert('✅ Saved', 'Your meal attendance is recorded.');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <H1>Today's Meal</H1>
      <Muted>Tap the meals you had (or will have) today.</Muted>

      <View style={{ gap: 12 }}>
        {MEALS.map((m) => {
          const on = !!selected[m.type];
          return (
            <Pressable key={m.type} onPress={() => toggle(m.type)}>
              <Card
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  borderColor: on ? colors.primary : colors.border,
                  borderWidth: on ? 2 : 1,
                }}
              >
                <Text style={{ fontSize: 28 }}>{m.emoji}</Text>
                <Text
                  style={{
                    flex: 1,
                    fontWeight: '700',
                    fontSize: 16,
                    color: colors.text,
                  }}
                >
                  {m.label}
                </Text>
                <Text style={{ fontSize: 22 }}>{on ? '✅' : '⬜'}</Text>
              </Card>
            </Pressable>
          );
        })}
      </View>

      <Button title="Save today's meals" onPress={save} loading={saving} />

      <H1>This Month</H1>
      <Card>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>
          {stats?.percentage ?? 0}%
        </Text>
        <Muted>{stats?.summary ?? 'No data yet.'}</Muted>
        {stats?.byMeal ? (
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
            <Muted>🍳 {stats.byMeal.breakfast}</Muted>
            <Muted>🍛 {stats.byMeal.lunch}</Muted>
            <Muted>🌙 {stats.byMeal.dinner}</Muted>
          </View>
        ) : null}
      </Card>
    </ScrollView>
  );
}
