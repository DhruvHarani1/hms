import { useState } from 'react';
import { Alert, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/stores/auth';
import { Button, Field, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';
import { registerForPush } from '@/src/notifications/register';

export default function Login() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit() {
    if (!email || !password) {
      Alert.alert('Missing details', 'Enter your email and password.');
      return;
    }
    try {
      await login(email.trim().toLowerCase(), password);
      // Register this device for meal-ready pushes (non-blocking).
      registerForPush();
    } catch (e: any) {
      Alert.alert(
        'Login failed',
        e?.response?.data?.message ?? 'Check your credentials and try again.',
      );
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}>
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Text style={{ fontSize: 48 }}>🏨</Text>
          <H1>Hostel App</H1>
          <Muted>Sign in to continue</Muted>
        </View>

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          placeholder="you@hostel.test"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
        />

        <Button title="Log in" onPress={onSubmit} loading={loading} />
        <Button
          title="New here? Sign up"
          variant="outline"
          onPress={() => router.push('/(auth)/register')}
        />

        <Muted>
          Demo — warden@hostel.test / aarav@hostel.test · Password123!
        </Muted>
      </View>
    </SafeAreaView>
  );
}
