import { useState } from 'react';
import { Alert, FlatList, Linking, Pressable, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Stack, useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { API_URL } from '@/src/lib/config';
import { Button, Card, Field, Muted } from '@/src/components/ui';
import { monthKey } from '@/src/components/MonthCalendar';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
} from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

export default function MealStudents() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [exporting, setExporting] = useState(false);

  async function exportExcel() {
    setExporting(true);
    try {
      const month = monthKey(new Date());
      const res = await api.post('/meals/export-link', { month });
      const url = `${API_URL}/meals/export?month=${month}&token=${res.data.token}`;
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Cannot open', url);
    } catch (e: any) {
      Alert.alert('Export failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setExporting(false);
    }
  }
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['meal-students', q],
    queryFn: async () =>
      (await api.get('/students', { params: q ? { q } : {} })).data,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Meal attendance' }} />
      <View style={{ padding: 16, gap: 12 }}>
        <Button
          title={exporting ? 'Preparing…' : '⬇️  Export this month to Excel'}
          onPress={exportExcel}
          loading={exporting}
        />
        <Field
          placeholder="Search students…"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
      </View>
      {isLoading ? (
        <SkeletonList count={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, flexGrow: 1 }}
          data={data ?? []}
          keyExtractor={(item: any) => item.id}
          ListEmptyComponent={
            <EmptyState emoji="🍽️" title="No students" />
          }
          renderItem={({ item }: { item: any }) => (
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/(warden)/student-meals',
                  params: { id: item.id, name: item.fullName },
                })
              }
            >
              <Card
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <View>
                  <Text style={{ fontWeight: '700', color: colors.text }}>
                    {item.fullName}
                  </Text>
                  <Muted>
                    {item.studentProfile?.roomNumber
                      ? `Room ${item.studentProfile.roomNumber}`
                      : item.email}
                  </Muted>
                </View>
                <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
              </Card>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}
