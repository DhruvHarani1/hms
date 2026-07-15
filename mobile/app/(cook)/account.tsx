import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/stores/auth';
import { Button, Card, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function CookAccount() {
  const router = useRouter();
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
      <Button
        title="⭐  Meal reviews"
        variant="outline"
        onPress={() => router.push('/(cook)/meal-reviews')}
      />
      <Button title="Log out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}
