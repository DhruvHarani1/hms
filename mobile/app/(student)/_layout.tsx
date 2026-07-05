import { Tabs, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/src/lib/theme';
import { BellButton } from '@/src/components/primitives';
import { useUnread } from '@/src/hooks/useUnread';

function icon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function StudentLayout() {
  const router = useRouter();
  const unread = useUnread();
  const bell = () => (
    <BellButton count={unread} onPress={() => router.push('/notifications')} />
  );
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
        name="meals"
        options={{ title: 'Meals', tabBarIcon: icon('🍽️') }}
      />
      <Tabs.Screen
        name="attendance"
        options={{ title: 'Attend', tabBarIcon: icon('📋') }}
      />
      <Tabs.Screen
        name="complaints"
        options={{ title: 'Complaints', tabBarIcon: icon('📝') }}
      />
      <Tabs.Screen
        name="notices"
        options={{ title: 'Notices', tabBarIcon: icon('📢') }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: icon('👤') }}
      />
    </Tabs>
  );
}
