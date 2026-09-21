import { Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { colors, radius } from '@/src/lib/theme';

const NAV_ITEMS = [
  { href: '/(warden)', match: '/(warden)/index', icon: '🏠', label: 'Home' },
  { href: '/(warden)/complaints', match: '/(warden)/complaints', icon: '📝', label: 'Complaints' },
  { href: '/(warden)/students', match: '/(warden)/students', icon: '👥', label: 'Students' },
  { href: '/(warden)/requests', match: '/(warden)/requests', icon: '🙋', label: 'Requests' },
  { href: '/(warden)/edit-requests', match: '/(warden)/edit-requests', icon: '✏️', label: 'Edit requests' },
  { href: '/(warden)/leaves', match: '/(warden)/leaves', icon: '🏖️', label: 'Leave requests' },
  { href: '/(warden)/notices', match: '/(warden)/notices', icon: '📢', label: 'Notices' },
  { href: '/(warden)/analytics', match: '/(warden)/analytics', icon: '📊', label: 'Analytics' },
  { href: '/(warden)/chat', match: '/(warden)/chat', icon: '💬', label: 'Chat' },
  { href: '/(warden)/more', match: '/(warden)/more', icon: '⚙️', label: 'More' },
] as const;

export const SIDEBAR_WIDTH = 240;

export function WardenSidebar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <View
      style={{
        width: SIDEBAR_WIDTH,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        backgroundColor: colors.card,
        paddingTop: 16,
      }}
    >
      <Text
        style={{
          fontWeight: '800',
          fontSize: 18,
          color: colors.primary,
          paddingHorizontal: 16,
          marginBottom: 16,
        }}
      >
        🏨 Warden
      </Text>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 8, gap: 2 }}>
        {NAV_ITEMS.map((item) => {
          const active =
            pathname === item.match || (item.label === 'Home' && pathname === '/(warden)');
          return (
            <Pressable
              key={item.href}
              onPress={() => router.push(item.href as any)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
                borderRadius: radius.md,
                backgroundColor: active ? colors.primary + '18' : 'transparent',
              }}
            >
              <Text style={{ fontSize: 16 }}>{item.icon}</Text>
              <Text
                style={{
                  color: active ? colors.primary : colors.text,
                  fontWeight: active ? '700' : '500',
                  fontSize: 14,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}
