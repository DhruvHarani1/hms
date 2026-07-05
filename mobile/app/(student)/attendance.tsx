import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { MonthCalendar, monthKey } from '@/src/components/MonthCalendar';
import { SkeletonList, ErrorState } from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export default function StudentAttendance() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [start, setStart] = useState(todayStr());
  const [end, setEnd] = useState(todayStr());
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const month = monthKey(cursor);
  const qKey = ['attendance-month', month];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qKey,
    queryFn: async () =>
      (await api.get('/attendance/me', { params: { month } })).data,
  });
  const { data: leaves } = useQuery({
    queryKey: ['my-leaves'],
    queryFn: async () => (await api.get('/leaves/me')).data,
  });

  const absent = new Set<string>(data?.absentDates ?? []);

  async function toggle(dateStr: string) {
    const nowAbsent = !absent.has(dateStr);
    // optimistic
    qc.setQueryData(qKey, (old: any) => {
      const set = new Set<string>(old?.absentDates ?? []);
      if (nowAbsent) set.add(dateStr);
      else set.delete(dateStr);
      const arr = [...set].sort();
      const present = (old?.daysInMonth ?? 0) - arr.length;
      return {
        ...(old ?? {}),
        absentDates: arr,
        absentDays: arr.length,
        presentDays: present,
        percentage: old?.daysInMonth
          ? Math.round((present / old.daysInMonth) * 100)
          : 0,
      };
    });
    try {
      await api.post('/attendance/mark', { date: dateStr, absent: nowAbsent });
      qc.invalidateQueries({ queryKey: qKey });
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: qKey });
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  async function submitLeave() {
    if (!start || !end || !reason) {
      Alert.alert('Missing', 'Fill start date, end date and reason.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
      Alert.alert('Bad date', 'Use format YYYY-MM-DD.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/leaves', { startDate: start, endDate: end, reason });
      setLeaveOpen(false);
      setReason('');
      qc.invalidateQueries({ queryKey: qKey });
      qc.invalidateQueries({ queryKey: ['my-leaves'] });
      qc.invalidateQueries({ queryKey: ['attendance-month', monthKey(new Date(start)) ] });
      Alert.alert('✅ Leave submitted', 'Those days are marked absent and the warden is notified.');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <H1>Attendance</H1>
      <Muted>You're present by default. Tap a day to mark yourself absent (red).</Muted>

      {isLoading ? (
        <SkeletonList count={2} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <Card>
            <MonthCalendar
              monthDate={cursor}
              marked={new Set()}
              dangerDates={absent}
              onDayPress={toggle}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
            />
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

      <Button title="🏖️  Apply for leave" onPress={() => setLeaveOpen(true)} />

      <H1>My Leaves</H1>
      {(leaves ?? []).length === 0 ? (
        <Muted>No leaves yet.</Muted>
      ) : (
        (leaves ?? []).map((l: any) => (
          <Card key={l.id} style={{ gap: 2 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {l.startDate?.slice(0, 10)} → {l.endDate?.slice(0, 10)}
            </Text>
            <Muted>{l.reason}</Muted>
          </Card>
        ))
      )}

      <Modal visible={leaveOpen} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}>
          <View style={{ padding: 16 }}>
            <Card style={{ gap: 12 }}>
              <H1>Apply for leave</H1>
              <Field
                label="Start date (YYYY-MM-DD)"
                value={start}
                onChangeText={setStart}
                autoCapitalize="none"
              />
              <Field
                label="End date (YYYY-MM-DD)"
                value={end}
                onChangeText={setEnd}
                autoCapitalize="none"
              />
              <Field
                label="Reason"
                value={reason}
                onChangeText={setReason}
                placeholder="e.g. Going home"
              />
              <Button title="Submit leave" onPress={submitLeave} loading={busy} />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setLeaveOpen(false)}
              />
            </Card>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}
