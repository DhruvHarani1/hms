import { FlatList, RefreshControl, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card } from '@/src/components/ui';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
  Badge,
} from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

export default function StudentNotices() {
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notices'],
    queryFn: async () => (await api.get('/notices')).data,
  });

  if (isLoading) return <SkeletonList count={4} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      data={data ?? []}
      keyExtractor={(item: any) => item.id}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      ListEmptyComponent={
        <EmptyState
          emoji="📢"
          title="No notices yet"
          subtitle="Hostel announcements will show up here."
        />
      }
      renderItem={({ item }: { item: any }) => (
        <Card style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>
            {item.pinned ? '📌 ' : ''}
            {item.title}
          </Text>
          <Badge label={item.category} />
          <Text style={{ color: colors.text, marginTop: 2 }}>{item.body}</Text>
        </Card>
      )}
    />
  );
}
