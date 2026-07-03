import { FlatList, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function StudentNotices() {
  const { data } = useQuery({
    queryKey: ['notices'],
    queryFn: async () => (await api.get('/notices')).data,
  });

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={data ?? []}
      keyExtractor={(item: any) => item.id}
      ListEmptyComponent={<Muted>No notices yet.</Muted>}
      renderItem={({ item }: { item: any }) => (
        <Card>
          <Text style={{ fontWeight: '700', color: colors.text }}>
            {item.pinned ? '📌 ' : ''}
            {item.title}
          </Text>
          <Muted>{item.category}</Muted>
          <Text style={{ color: colors.text, marginTop: 6 }}>{item.body}</Text>
        </Card>
      )}
    />
  );
}
