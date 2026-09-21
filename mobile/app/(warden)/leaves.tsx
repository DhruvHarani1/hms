import { useMemo, useState } from 'react';
import { FlatList, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import { EmptyState, ErrorState, SkeletonList } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

function fmt(iso?: string) {
  return iso ? iso.slice(0, 10) : '';
}

export default function WardenLeaves() {
  const [q, setQ] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-leaves'],
    queryFn: async () => (await api.get('/leaves')).data,
  });

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (!q.trim()) return list;
    const needle = q.trim().toLowerCase();
    return list.filter((item: any) =>
      item.student?.fullName?.toLowerCase().includes(needle) ||
      item.student?.email?.toLowerCase().includes(needle) ||
      item.reason?.toLowerCase().includes(needle),
    );
  }, [data, q]);

  if (isLoading) return <SkeletonList count={5} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Leave requests' }} />
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        data={filtered}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by student name or reason..."
            placeholderTextColor={colors.muted}
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              paddingHorizontal: 12,
              paddingVertical: 10,
              color: colors.text,
              marginBottom: 4,
            }}
          />
        }
        ListEmptyComponent={
          <EmptyState
            emoji="🏖️"
            title="No leave requests"
            subtitle={q ? 'Try a different search.' : undefined}
          />
        }
        renderItem={({ item }: { item: any }) => (
          <Card style={{ gap: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: colors.text }}>
                {item.student?.fullName}
              </Text>
              <Text style={{ color: colors.primary, fontWeight: '700' }}>
                {fmt(item.startDate)} → {fmt(item.endDate)}
              </Text>
            </View>
            <Muted>{item.reason}</Muted>
          </Card>
        )}
      />
    </View>
  );
}
