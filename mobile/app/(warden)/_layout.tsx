import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '@/src/lib/theme';

function icon(emoji: string) {
  return ({ color }: { color: string }) => (
    <Text style={{ fontSize: 20, color }}>{emoji}</Text>
  );
}

export default function WardenLayout() {
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
        options={{ title: 'Home', tabBarIcon: icon('🏠') }}
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
        name="more"
        options={{ title: 'More', tabBarIcon: icon('⚙️') }}
      />
    </Tabs>
  );
}
