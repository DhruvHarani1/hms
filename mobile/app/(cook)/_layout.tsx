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

export default function CookLayout() {
  const router = useRouter();
  const unread = useUnread();
  const chatUnread = useChatUnread();
  const headerRight = () => (
    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
      <ChatButton count={chatUnread} onPress={() => router.push('/(cook)/chat')} />
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
          title: 'Kitchen',
          tabBarIcon: icon('🍳'),
          headerTitle: () => <HeaderLogo />,
          headerRight,
        }}
      />
      <Tabs.Screen
        name="menu"
        options={{
          title: 'Menu',
          tabBarIcon: icon('📋'),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: icon('👤') }}
      />
      {/* Not in tab bar — reached via navigation */}
      <Tabs.Screen name="chat" options={{ href: null }} />
      <Tabs.Screen name="chat/[id]" options={{ href: null, tabBarStyle: { display: 'none' } }} />
    </Tabs>
  );
}

