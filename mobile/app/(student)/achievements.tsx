import { ScrollView, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { colors } from '@/src/lib/theme';
import BadgeGrid from '@/src/components/BadgeGrid';

export default function AchievementsScreen() {
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => (await api.get('/dashboard/student')).data,
  });

  const badges = data?.gamification?.badges;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      {badges && (
        <BadgeGrid
          earned={badges.earned}
          locked={badges.locked}
          total={badges.total}
          earnedCount={badges.earnedCount}
        />
      )}
    </ScrollView>
  );
}
