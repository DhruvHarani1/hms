import { useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, Text, View } from 'react-native';
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

const CATEGORIES = ['all', 'announcement', 'event', 'holiday', 'rules', 'exam'] as const;

export default function StudentNotices() {
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('all');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['notices', category],
    queryFn: async () =>
      (
        await api.get('/notices', {
          params: category === 'all' ? undefined : { category },
        })
      ).data,
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
      ListHeaderComponent={
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 }}
        >
          {CATEGORIES.map((c) => (
            <Pressable
              key={c}
              onPress={() => setCategory(c)}
              style={{
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: category === c ? colors.primary : colors.border,
                backgroundColor: category === c ? colors.primary + '22' : '#fff',
              }}
            >
              <Text style={{ color: category === c ? colors.primary : colors.text }}>
                {c}
              </Text>
            </Pressable>
          ))}
        </View>
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
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={{
                width: '100%',
                height: 180,
                borderRadius: 8,
                marginTop: 6,
                backgroundColor: '#eee',
              }}
              resizeMode="cover"
            />
          )}
        </Card>
      )}
    />
  );
}
