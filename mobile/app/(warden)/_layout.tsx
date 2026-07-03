import { Tabs, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/src/lib/theme';
import { BellButton } from '@/src/components/primitives';
import { useUnread } from '@/src/hooks/useUnread';
import { api } from '@/src/lib/api';

function icon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function WardenLayout() {
  const router = useRouter();
  const unread = useUnread();
  const bell = () => (
    <BellButton count={unread} onPress={() => router.push('/notifications')} />
  );

  const { data: requests } = useQuery({
    queryKey: ['join-requests-count'],
    queryFn: async () => (await api.get('/students/requests')).data,
    refetchInterval: 20000,
  });
  const pendingCount = (requests ?? []).length;
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        headerStyle: { backgroundColor: colors.card },
        headerTitleStyle: { fontWeight: '800' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', tabBarIcon: icon('🏠'), headerRight: bell }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: 'Complaints', tabBarIcon: icon('📝') }}
      />
      <Tabs.Screen
        name="students"
        options={{ title: 'Students', tabBarIcon: icon('👥') }}
      />
      <Tabs.Screen
        name="requests"
        options={{
          title: 'Requests',
          tabBarIcon: icon('🙋'),
          tabBarBadge: pendingCount > 0 ? pendingCount : undefined,
        }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: 'More', tabBarIcon: icon('⚙️') }}
      />
    </Tabs>
  );
}
