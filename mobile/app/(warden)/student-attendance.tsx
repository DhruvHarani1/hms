import { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import { MonthCalendar, monthKey } from '@/src/components/MonthCalendar';
import { SkeletonList, ErrorState } from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

export default function StudentAttendanceWardenView() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const [cursor, setCursor] = useState(() => new Date());
  const month = monthKey(cursor);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-student-attendance', id, month],
    queryFn: async () =>
      (await api.get(`/attendance/student/${id}`, { params: { month } })).data,
  });

  const absent = new Set<string>(data?.absentDates ?? []);

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <Stack.Screen options={{ title: name ?? 'Attendance' }} />
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
              {data?.student?.roomNumber ? `Room ${data.student.roomNumber}` : ''}
            </Muted>
          </Card>

          <Card>
            <MonthCalendar
              monthDate={cursor}
              marked={new Set()}
              dangerDates={absent}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
            />
            <Muted>Red = absent</Muted>
          </Card>

          <Card style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.success }}>
              {data?.presentDays ?? 0}
              <Text style={{ fontSize: 20, color: colors.muted }}>
                {' '}
                / {data?.daysInMonth ?? 0}
              </Text>
            </Text>
            <Muted>days present · {data?.percentage ?? 0}%</Muted>
          </Card>
        </>
      )}
    </ScrollView>
  );
}
