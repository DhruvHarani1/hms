import { ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/stores/auth';
import { Button, Card, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function WardenMore() {
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
        <Muted>{user?.email} · Warden</Muted>
      </Card>

      <Button
        title="🍲  Set today's menu"
        variant="outline"
        onPress={() => router.push('/(warden)/menu')}
      />
      <Button
        title="⭐  Meal reviews"
        variant="outline"
        onPress={() => router.push('/(warden)/meal-reviews')}
      />
      <Button
        title="🍽️  Meal attendance"
        variant="outline"
        onPress={() => router.push('/(warden)/meal-students')}
      />
      <Button
        title="📋  Attendance"
        variant="outline"
        onPress={() => router.push('/(warden)/attendance-students')}
      />
      <Button
        title="🏖️  Leave requests"
        variant="outline"
        onPress={() => router.push('/(warden)/leaves')}
      />
      <Button
        title="📢  Notices"
        variant="outline"
        onPress={() => router.push('/(warden)/notices')}
      />
      <Button
        title="📊  Analytics"
        variant="outline"
        onPress={() => router.push('/(warden)/analytics')}
      />

      <Button title="Log out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}
