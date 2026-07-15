import { Tabs, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { colors } from '@/src/lib/theme';
import { BellButton } from '@/src/components/primitives';
import { HeaderLogo } from '@/src/components/HeaderLogo';
import { useUnread } from '@/src/hooks/useUnread';
import { useChatUnread } from '@/src/hooks/useChat';
import { ChatButton } from '@/src/components/ChatButton';
import { api } from '@/src/lib/api';

function icon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function WardenLayout() {
  const router = useRouter();
  const unread = useUnread();
  const chatUnread = useChatUnread();
  const headerRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ChatButton count={chatUnread} onPress={() => router.push('/(warden)/chat')} />
      <BellButton count={unread} onPress={() => router.push('/notifications')} />
    </View>
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
        options={{
          title: 'Home',
          tabBarIcon: icon('🏠'),
          headerTitle: () => <HeaderLogo />,
          headerRight,
        }}
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
      {/* Not in tab bar — reached via navigation */}
      <Tabs.Screen name="meal-students" options={{ href: null }} />
      <Tabs.Screen name="student-meals" options={{ href: null }} />
      <Tabs.Screen name="attendance-students" options={{ href: null }} />
      <Tabs.Screen name="student-attendance" options={{ href: null }} />
      <Tabs.Screen name="leaves" options={{ href: null }} />
      <Tabs.Screen name="student-profile" options={{ href: null }} />
      <Tabs.Screen name="meal-reviews" options={{ href: null }} />
      <Tabs.Screen name="menu" options={{ href: null }} />
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}

