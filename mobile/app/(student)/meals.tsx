import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, H1, Muted } from '@/src/components/ui';
import { MonthCalendar, monthKey } from '@/src/components/MonthCalendar';
import { MealDayModal } from '@/src/components/MealDayModal';
import { SkeletonList, ErrorState } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

type DayMap = Record<string, { lunch: boolean; dinner: boolean; breakfast: boolean }>;

export default function StudentMeals() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const month = monthKey(cursor);
  const qKey = ['meals-month', month];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qKey,
    queryFn: async () =>
      (await api.get('/meals/me', { params: { month } })).data,
  });

  const days: DayMap = data?.days ?? {};
  const marked = new Set<string>(Object.keys(days)); // day is "ate" if any meal

  const selState = selected
    ? days[selected] ?? { lunch: false, dinner: false, breakfast: false }
    : { lunch: false, dinner: false, breakfast: false };

  async function toggleMeal(meal: 'lunch' | 'dinner', next: boolean) {
    if (!selected) return;
    // optimistic
    qc.setQueryData(qKey, (old: any) => {
      const d: DayMap = { ...(old?.days ?? {}) };
      const cur = d[selected] ?? { lunch: false, dinner: false, breakfast: false };
      const updated = { ...cur, [meal]: next };
      updated.breakfast = updated.lunch || updated.dinner;
      if (!updated.lunch && !updated.dinner) delete d[selected];
      else d[selected] = updated;
      return { ...(old ?? {}), days: d, daysAte: Object.keys(d).length };
    });
    try {
      await api.post('/meals/mark', { date: selected, meal, marked: next });
      qc.invalidateQueries({ queryKey: qKey });
      qc.invalidateQueries({ queryKey: ['meal-stats'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: qKey });
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function bulk(meal: 'lunch' | 'dinner' | 'both', marked: boolean) {
    try {
      const res = await api.post('/meals/bulk', { month, meal, marked });
      qc.setQueryData(qKey, res.data);
      qc.invalidateQueries({ queryKey: ['meal-stats'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <H1>My Meals</H1>
      <Muted>Tap a day to set lunch/dinner. Breakfast turns on automatically.</Muted>

      {isLoading ? (
        <SkeletonList count={2} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <Card>
            <MonthCalendar
              monthDate={cursor}
              marked={marked}
              onDayPress={setSelected}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
            />
          </Card>

          {/* Bulk actions */}
          <Card style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              Quick fill this month
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <BulkBtn label="All meals" onPress={() => bulk('both', true)} />
              <BulkBtn label="All lunch" onPress={() => bulk('lunch', true)} />
              <BulkBtn label="All dinner" onPress={() => bulk('dinner', true)} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <BulkBtn label="Clear all" danger onPress={() => bulk('both', false)} />
              <BulkBtn label="Clear lunch" danger onPress={() => bulk('lunch', false)} />
              <BulkBtn label="Clear dinner" danger onPress={() => bulk('dinner', false)} />
            </View>
          </Card>

          <Card style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.primary }}>
              {data?.daysAte ?? 0}
              <Text style={{ fontSize: 20, color: colors.muted }}>
                {' '}
                / {data?.daysInMonth ?? 0}
              </Text>
            </Text>
            <Muted>days eaten this month · {data?.percentage ?? 0}%</Muted>
          </Card>
        </>
      )}

      <MealDayModal
        visible={selected !== null}
        dateStr={selected}
        state={selState}
        editable
        onToggle={toggleMeal}
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}

function BulkBtn({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.primary,
        backgroundColor: danger ? '#fff' : colors.primarySoft,
      }}
    >
      <Text style={{ color: danger ? colors.danger : colors.primary, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}
