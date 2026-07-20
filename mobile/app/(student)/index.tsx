import { ScrollView, Text, View, RefreshControl, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { Card, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function StudentHome() {
  const { user } = useAuth();
  const router = useRouter();
  const { data, refetch, isRefetching } = useQuery({
    queryKey: ['student-dashboard'],
    queryFn: async () => (await api.get('/dashboard/student')).data,
  });

  const stats = data?.mealStats;
  const pct = stats?.percentage ?? 0;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
    >
      <H1>Hi, {user?.fullName?.split(' ')[0] ?? 'there'} 👋</H1>

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
  );
}
