import { Alert, FlatList, Pressable, RefreshControl, Text, View, Image } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
  StatusPill,
} from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

const NEXT: Record<string, string> = {
  pending: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
};



export default function WardenComplaints() {
  const qc = useQueryClient();
  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
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

  if (isLoading) return <SkeletonList count={5} />;
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
          emoji="✅"
          title="No complaints"
          subtitle="When students report issues, they'll appear here."
        />
      }
      renderItem={({ item }: { item: any }) => (
        <Card style={{ gap: 6 }}>
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
            <StatusPill status={item.status} />
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ flex: 1 }}>
              <Muted>
                By: {item.student?.fullName} · {item.category?.name ?? 'General'}
              </Muted>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '11', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
              <Text style={{ fontSize: 12, color: colors.primary }}>▲</Text>
              <Text style={{ fontWeight: '700', fontSize: 12, color: colors.primary }}>
                {item.upvoteCount ?? 0}
              </Text>
            </View>
          </View>
          <Text style={{ color: colors.text, marginTop: 4 }}>
            {item.description}
          </Text>
          {item.attachments && item.attachments.length > 0 && (
            <Image
              source={{ uri: item.attachments[0].fileUrl }}
              style={{
                width: '100%',
                height: 180,
                borderRadius: 8,
                marginTop: 10,
                backgroundColor: '#eee',
              }}
              resizeMode="cover"
            />
          )}
          {NEXT[item.status] ? (
            <Pressable
              onPress={() => advance(item.id, item.status)}
              style={{
                marginTop: 10,
                backgroundColor: colors.primary,
                borderRadius: radius.md,
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
