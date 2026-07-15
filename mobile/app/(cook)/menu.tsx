import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

const MEALS = [
  { type: 'breakfast', label: 'Breakfast', emoji: '🍳' },
  { type: 'lunch', label: 'Lunch', emoji: '🍛' },
  { type: 'dinner', label: 'Dinner', emoji: '🌙' },
] as const;

export default function CookMenu() {
  const qc = useQueryClient();
  const [meal, setMeal] = useState<'breakfast' | 'lunch' | 'dinner'>('breakfast');
  const [newDish, setNewDish] = useState('');
  const [selected, setSelected] = useState<Record<string, Set<string>>>({
    breakfast: new Set(),
    lunch: new Set(),
    dinner: new Set(),
  });
  const [busy, setBusy] = useState(false);

  const { data: dishes } = useQuery({
    queryKey: ['dishes', meal],
    queryFn: async () => (await api.get('/meals/dishes', { params: { mealType: meal } })).data,
  });
  const { data: todayMenu } = useQuery({
    queryKey: ['today-menu'],
    queryFn: async () => (await api.get('/meals/menu')).data,
  });

  // Pre-select today's saved menu.
  useEffect(() => {
    if (!todayMenu) return;
    setSelected({
      breakfast: new Set(todayMenu.breakfast ?? []),
      lunch: new Set(todayMenu.lunch ?? []),
      dinner: new Set(todayMenu.dinner ?? []),
    });
  }, [todayMenu]);

  function toggle(name: string) {
    setSelected((s) => {
      const set = new Set(s[meal]);
      if (set.has(name)) set.delete(name);
      else set.add(name);
      return { ...s, [meal]: set };
    });
  }

  async function addDish() {
    if (!newDish.trim()) return;
    try {
      await api.post('/meals/dishes', { mealType: meal, name: newDish.trim() });
      setNewDish('');
      qc.invalidateQueries({ queryKey: ['dishes', meal] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function removeDish(id: string, name: string) {
    try {
      await api.delete(`/meals/dishes/${id}`);
      qc.invalidateQueries({ queryKey: ['dishes', meal] });
      setSelected((s) => {
        const set = new Set(s[meal]);
        set.delete(name);
        return { ...s, [meal]: set };
      });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function save() {
    setBusy(true);
    try {
      await api.post('/meals/menu', {
        mealType: meal,
        dishes: [...selected[meal]],
      });
      qc.invalidateQueries({ queryKey: ['today-menu'] });
      Alert.alert('✅ Saved', `Today's ${meal} set. Students & cook notified.`);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <Stack.Screen options={{ title: "Today's Menu" }} />
      <H1>Set today's menu</H1>

      {/* Meal selector */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {MEALS.map((m) => {
          const on = meal === m.type;
          return (
            <Pressable
              key={m.type}
              onPress={() => setMeal(m.type)}
              style={{
                flex: 1,
                paddingVertical: 12,
                borderRadius: radius.md,
                alignItems: 'center',
                backgroundColor: on ? colors.primary : '#fff',
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
              }}
            >
              <Text style={{ fontSize: 20 }}>{m.emoji}</Text>
              <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>
                {m.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <Muted>Tick dishes for today. Add or remove dishes from the list.</Muted>

      <Card style={{ gap: 8 }}>
        {(dishes ?? []).length === 0 ? (
          <Muted>No dishes yet. Add some below.</Muted>
        ) : (
          (dishes ?? []).map((d: any) => {
            const on = selected[meal].has(d.name);
            return (
              <View
                key={d.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
              >
                <Pressable
                  onPress={() => toggle(d.name)}
                  style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 }}
                >
                  <Text style={{ fontSize: 20 }}>{on ? '✅' : '⬜'}</Text>
                  <Text style={{ color: colors.text, fontWeight: '600' }}>{d.name}</Text>
                </Pressable>
                <Pressable onPress={() => removeDish(d.id, d.name)} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontWeight: '800', fontSize: 18 }}>×</Text>
                </Pressable>
              </View>
            );
          })
        )}
      </Card>

      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field label="Add dish" value={newDish} onChangeText={setNewDish} placeholder="e.g. Poha" />
        </View>
        <Button title="Add" onPress={addDish} />
      </View>

      <Button title="Save & notify" onPress={save} loading={busy} />
    </ScrollView>
  );
}
