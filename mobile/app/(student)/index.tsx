import { useState, useEffect } from 'react';
import { ScrollView, Text, View, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { Card, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';
import StreakCard from '@/src/components/StreakCard';
import WeeklyRing from '@/src/components/WeeklyRing';
import CelebrationModal from '@/src/components/CelebrationModal';

export default function StudentHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => (await api.get('/dashboard/student')).data,
  });

  const stats = data?.mealStats;
  const pct = stats?.percentage ?? 0;
  const gam = data?.gamification;

  // Celebration: detect newly earned badges
  const [celebBadge, setCelebBadge] = useState<any>(null);

  useEffect(() => {
    if (!gam?.badges?.earned?.length) return;
    (async () => {
      const key = 'seen_badges';
      const raw = await AsyncStorage.getItem(key);
      const seen: string[] = raw ? JSON.parse(raw) : [];
      const newBadge = gam.badges.earned.find((b: any) => !seen.includes(b.id));
      if (newBadge) {
        setCelebBadge(newBadge);
        // Mark all currently earned badges as seen
        await AsyncStorage.setItem(key, JSON.stringify(gam.badges.earned.map((b: any) => b.id)));
      }
    })();
  }, [gam?.badges?.earned]);

  return (
  <>
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <H1>Hi, {user?.fullName?.split(' ')[0] ?? 'there'} 👋</H1>

      {/* Gamification: Streaks + Weekly Ring */}
      {gam?.streaks && (
        <StreakCard
          attendance={gam.streaks.attendance}
          meals={gam.streaks.meals}
          perfect={gam.streaks.perfect}
        />
      )}
      {gam?.weeklyScore && (
        <WeeklyRing
          percentage={gam.weeklyScore.percentage}
          daysPresent={gam.weeklyScore.daysPresent}
          daysTotal={gam.weeklyScore.daysTotal}
          mealsEaten={gam.weeklyScore.mealsEaten}
          mealsTotal={gam.weeklyScore.mealsTotal}
        />
      )}

      {/* Achievements button */}
      {gam?.badges && (
        <Pressable
          onPress={() => router.push('/(student)/achievements')}
          style={{
            backgroundColor: colors.card,
            borderRadius: 14,
            padding: 14,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={{ fontSize: 22 }}>🏅</Text>
            <View>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>
                Achievements
              </Text>
              <Text style={{ fontSize: 11, color: colors.muted }}>
                {gam.badges.earnedCount}/{gam.badges.total} unlocked
              </Text>
            </View>
          </View>
          <Text style={{ fontSize: 18, color: colors.muted }}>›</Text>
        </Pressable>
      )}

      <Card>
        <Muted>Room</Muted>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
          {data?.profile?.roomNumber ?? 'Not assigned'}
        </Text>
      </Card>

      <Card>
        <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 8 }}>
          This month's meals
        </Text>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.primary }}>
          {pct}%
        </Text>
        <Muted>{stats?.summary ?? 'No meals marked yet.'}</Muted>
        <View
          style={{
            height: 10,
            backgroundColor: colors.border,
            borderRadius: 999,
            marginTop: 10,
            overflow: 'hidden',
          }}
        >
          <View
            style={{
              width: `${pct}%`,
              height: '100%',
              backgroundColor: colors.primary,
            }}
          />
        </View>
      </Card>

      <View style={{ flexDirection: 'row', gap: 12 }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
            {data?.unreadNotifications ?? 0}
          </Text>
          <Muted>Unread alerts</Muted>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text }}>
            {data?.openComplaints ?? 0}
          </Text>
          <Muted>Open complaints</Muted>
        </Card>
      </View>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>
          💰 Money & Expenses
        </Text>
        <Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
          Split dining/room bills with peers and wardens, upload receipts, and monitor monthly spending budgets.
        </Text>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
          <Pressable
            onPress={() => router.push('/(student)/splits')}
            style={{
              flex: 1,
              backgroundColor: colors.primary,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
              Bills & Splits
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(student)/expenditure')}
            style={{
              flex: 1,
              borderColor: colors.primary,
              borderWidth: 1,
              paddingVertical: 12,
              borderRadius: 8,
              alignItems: 'center',
            }}
          >
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>
              Budget & Spend
            </Text>
          </Pressable>
        </View>
      </Card>

      <H1>Latest Notices</H1>
      {(data?.latestNotices ?? []).length === 0 ? (
        <Muted>No notices yet.</Muted>
      ) : (
        (data?.latestNotices ?? []).map((n: any) => (
          <Card key={n.id}>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {n.pinned ? '📌 ' : ''}
              {n.title}
            </Text>
            <Muted>{n.body}</Muted>
          </Card>
        ))
      )}
    </ScrollView>

    {/* Celebration modal */}
    <CelebrationModal
      visible={!!celebBadge}
      badge={celebBadge}
      onDismiss={() => setCelebBadge(null)}
    />
  </>
  );
}
