import { Alert, FlatList, Pressable, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

const STATUS_COLOR: Record<string, string> = {
  pending: colors.warning,
  in_progress: colors.primary,
  resolved: colors.success,
  closed: colors.muted,
};

const NEXT: Record<string, string> = {
  pending: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
};

export default function WardenComplaints() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['complaints'],
    queryFn: async () => (await api.get('/complaints')).data,
  });

  async function advance(id: string, status: string) {
    const next = NEXT[status];
    if (!next) return;
    try {
      await api.patch(`/complaints/${id}`, { status: next });
      qc.invalidateQueries({ queryKey: ['complaints'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
      data={data ?? []}
      keyExtractor={(item: any) => item.id}
      ListEmptyComponent={<Muted>No complaints yet.</Muted>}
      renderItem={({ item }: { item: any }) => (
        <Card>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontWeight: '700', flex: 1, color: colors.text }}>
              {item.title}
            </Text>
            <View
              style={{
                backgroundColor: STATUS_COLOR[item.status] + '22',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}
            >
              <Text
                style={{
                  color: STATUS_COLOR[item.status],
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {item.status.replace('_', ' ')}
              </Text>
            </View>
          </View>
          <Muted>{item.student?.fullName} · {item.category?.name ?? 'General'}</Muted>
          <Text style={{ color: colors.text, marginTop: 4 }}>
            {item.description}
          </Text>
          {NEXT[item.status] ? (
            <Pressable
              onPress={() => advance(item.id, item.status)}
              style={{
                marginTop: 10,
                backgroundColor: colors.primary,
                borderRadius: 10,
                paddingVertical: 10,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: '#fff', fontWeight: '700' }}>
                Move to {NEXT[item.status].replace('_', ' ')}
              </Text>
            </Pressable>
          ) : null}
        </Card>
      )}
    />
  );
}
