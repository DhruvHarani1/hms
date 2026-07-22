import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import { EmptyState, ErrorState, SkeletonList } from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

function fmt(iso?: string) {
  return iso ? iso.slice(0, 10) : '';
}



export default function WardenLeaves() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-leaves'],
    queryFn: async () => (await api.get('/leaves')).data,
  });

  if (isLoading) return <SkeletonList count={5} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Leave requests' }} />
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        data={data ?? []}
        keyExtractor={(item: any) => item.id}
        ListEmptyComponent={
          <EmptyState emoji="🏖️" title="No leave requests" />
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
