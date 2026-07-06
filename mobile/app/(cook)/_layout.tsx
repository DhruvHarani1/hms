import { Tabs, useRouter } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/src/lib/theme';
import { BellButton } from '@/src/components/primitives';
import { HeaderLogo } from '@/src/components/HeaderLogo';
import { useUnread } from '@/src/hooks/useUnread';

function icon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function CookLayout() {
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
        options={{
          title: 'Kitchen',
          tabBarIcon: icon('🍳'),
          headerTitle: () => <HeaderLogo />,
          headerRight: bell,
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: icon('👤') }}
      />
    </Tabs>
  );
}
