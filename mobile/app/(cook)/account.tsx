import { ScrollView, Text } from 'react-native';
import { useAuth } from '@/src/stores/auth';
import { Button, Card, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function CookAccount() {
  const { user, logout } = useAuth();
  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <Card>
        <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>
          {user?.fullName}
        </Text>
        <Muted>{user?.email} · Cook</Muted>
      </Card>
      <Button title="Log out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}
