import { useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/lib/api';
import { API_URL } from '@/src/lib/config';
import { Button, Card, Muted } from '@/src/components/ui';
import { MonthCalendar, monthKey } from '@/src/components/MonthCalendar';
import { MealDayModal } from '@/src/components/MealDayModal';
import { SkeletonList, ErrorState } from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

type DayMap = Record<string, { lunch: boolean; dinner: boolean; breakfast: boolean }>;

export default function StudentMealsWardenView() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const month = monthKey(cursor);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-student-meals', id, month],
    queryFn: async () =>
      (await api.get(`/meals/student/${id}`, { params: { month } })).data,
  });

  const days: DayMap = data?.days ?? {};

  // Highlight in BLUE only days where the student is eating lunch or dinner
  const marked = new Set<string>(
    Object.keys(days).filter((k) => days[k].lunch || days[k].dinner)
  );

  // Highlight in RED days where student opted OUT (not eating lunch AND not eating dinner)
  const dangerDates = new Set<string>(
    Object.keys(days).filter((k) => !days[k].lunch && !days[k].dinner)
  );

  const selState = selected
    ? days[selected] ?? { lunch: false, dinner: false, breakfast: false }
    : { lunch: false, dinner: false, breakfast: false };

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await api.post('/meals/export-link', { month });
      const token = res.data.token;
      const downloadUrl = `${API_URL}/meals/export?token=${token}&month=${month}`;
      await Linking.openURL(downloadUrl);
    } catch (e: any) {
      Alert.alert('Export Failed', e?.response?.data?.message ?? 'Could not export Excel file.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <Stack.Screen options={{ title: name ?? 'Student meals' }} />

      {isLoading ? (
        <SkeletonList count={2} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <Card style={{ gap: 2 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              {data?.student?.fullName ?? name}
            </Text>
            <Muted>
              {data?.student?.rollNo ? `${data.student.rollNo} · ` : ''}
              {data?.student?.roomNumber
                ? `Room ${data.student.roomNumber}`
                : ''}
            </Muted>
          </Card>

          <Button
            title={exporting ? 'Generating Excel...' : '📥  Export Meals Excel (.xlsx)'}
            onPress={handleExportExcel}
            disabled={exporting}
            variant="outline"
          />

          <Card>
            <MonthCalendar
              monthDate={cursor}
              marked={marked}
              dangerDates={dangerDates}
              onDayPress={setSelected}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
            />
            <View style={{ flexDirection: 'row', gap: 12, marginTop: 8, justifyContent: 'center' }}>
              <Muted style={{ color: colors.primary }}>🔵 Ate / Eating</Muted>
              <Muted style={{ color: colors.danger }}>🔴 Opted Out (Not Eaten)</Muted>
            </View>
          </Card>

          <Card style={{ alignItems: 'center', gap: 4 }}>
            <Text
              style={{ fontSize: 34, fontWeight: '800', color: colors.primary }}
            >
              {data?.daysAte ?? 0}
              <Text style={{ fontSize: 20, color: colors.muted }}>
                {' '}
                / {data?.daysInMonth ?? 0}
              </Text>
            </Text>
            <Muted>days eaten · {data?.percentage ?? 0}%</Muted>
          </Card>
        </>
      )}

      <MealDayModal
        visible={selected !== null}
        dateStr={selected}
        state={selState}
        editable={false}
        onClose={() => setSelected(null)}
      />
    </ScrollView>
  );
}
