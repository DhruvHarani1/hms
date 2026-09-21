import { FlatList, Image, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { Card, Muted } from '@/src/components/ui';
import { EmptyState, ErrorState, SkeletonList } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

const MEDALS: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

export default function StudentLeaderboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: async () => (await api.get('/dashboard/leaderboard')).data,
  });

  if (isLoading) return <SkeletonList count={6} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Leaderboard' }} />
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
        data={data ?? []}
        keyExtractor={(item: any) => item.studentId}
        ListEmptyComponent={<EmptyState emoji="🏆" title="No students yet" />}
        renderItem={({ item }: { item: any }) => {
          const isMe = item.studentId === user?.id;
          return (
            <Card
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                borderColor: isMe ? colors.primary : colors.border,
                borderWidth: isMe ? 2 : 1,
                backgroundColor: isMe ? colors.primary + '0c' : colors.card,
              }}
            >
              <Text style={{ width: 32, fontSize: 18, fontWeight: '800', color: colors.muted, textAlign: 'center' }}>
                {MEDALS[item.rank] ?? item.rank}
              </Text>

              {item.avatarUrl ? (
                <Image
                  source={{ uri: item.avatarUrl }}
                  style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.skeleton }}
                />
              ) : (
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: colors.primary + '22',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ color: colors.primary, fontWeight: '800' }}>
                    {item.fullName?.charAt(0) ?? '?'}
                  </Text>
                </View>
              )}

              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {item.fullName}
                  {isMe ? ' (You)' : ''}
                </Text>
                <Muted>
                  {item.roomNumber ? `Room ${item.roomNumber} · ` : ''}
                  🔥 {item.perfectStreak}d streak · 🏅 {item.badgeCount}
                </Muted>
              </View>

              <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.primary }}>
                  {item.weeklyPercentage}%
                </Text>
                <Muted>this week</Muted>
              </View>
            </Card>
          );
        }}
      />
    </View>
  );
}
