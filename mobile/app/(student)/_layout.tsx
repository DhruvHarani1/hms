import { Tabs, useRouter } from 'expo-router';
import { Text, View } from 'react-native';
import { colors } from '@/src/lib/theme';
import { BellButton } from '@/src/components/primitives';
import { HeaderLogo } from '@/src/components/HeaderLogo';
import { useUnread } from '@/src/hooks/useUnread';
import { useChatUnread } from '@/src/hooks/useChat';
import { ChatButton } from '@/src/components/ChatButton';

function icon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function StudentLayout() {
  const router = useRouter();
  const unread = useUnread();
  const chatUnread = useChatUnread();
  const headerRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ChatButton count={chatUnread} onPress={() => router.push('/(student)/chat')} />
      <BellButton count={unread} onPress={() => router.push('/notifications')} />
    </View>
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
          title: 'Home',
          tabBarIcon: icon('🏠'),
          headerTitle: () => <HeaderLogo />,
          headerRight,
        }}
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
      {/* Not in tab bar — reached via navigation */}
      <Tabs.Screen name="chat" options={{ href: null }} />
    </Tabs>
  );
}

