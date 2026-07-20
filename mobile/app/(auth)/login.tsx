import { useState } from 'react';
import { Image, Pressable, View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuth } from '@/src/stores/auth';
import { Button, Field, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';
import { showAlert } from '@/src/lib/showAlert';
import { isValidEmail } from '@/src/lib/validation';
import { registerForPush } from '@/src/notifications/register';
import { registerWebPush } from '@/src/notifications/webpush';

export default function Login() {
  const router = useRouter();
  const { login, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  async function onSubmit() {
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedEmail || !password) {
      showAlert('Missing details', 'Enter your email and password.');
      return;
    }
    if (!isValidEmail(trimmedEmail)) {
      showAlert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    try {
      await login(trimmedEmail, password);
      // Register for pushes (non-blocking). Native = FCM/APNs, web = web push.
      registerForPush();
      registerWebPush();
    } catch (e: any) {
      const errData = e?.response?.data;
      const alertMsg =
        typeof errData?.message === 'string'
          ? errData.message
          : errData?.message?.message || e?.message || '';

      // Detect "email not verified" responses — check explicit flags first,
      // then fall back to text matching for maximum resilience.
      const isUnverified =
        errData?.verifyEmailRequired === true ||
        errData?.message?.verifyEmailRequired === true ||
        errData?.emailVerified === false ||
        errData?.message?.emailVerified === false ||
        /verify\s*(your\s*)?email/i.test(alertMsg);

      if (isUnverified) {
        const targetEmail =
          errData?.email || errData?.message?.email || trimmedEmail;
        router.replace({
          pathname: '/(auth)/verify',
          params: { email: targetEmail },
        });
        return;
      }

      // Generic login failure (wrong credentials, pending approval, etc.)
      const failMsg =
        errData?.message ?? 'Check your credentials and try again.';
      showAlert('Login failed', typeof failMsg === 'string' ? failMsg : 'Check your credentials and try again.');
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1, padding: 24, justifyContent: 'center', gap: 20 }}>
        <View style={{ alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Image
            source={require('../../assets/logo.jpg')}
            style={{ width: 160, height: 160, borderRadius: 24 }}
            resizeMode="contain"
          />
          <H1>AIFDMS Hostel App</H1>
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
        <Pressable onPress={() => router.push('/(auth)/forgot')} style={{ alignSelf: 'center', paddingVertical: 4 }}>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>
            Forgot password?
          </Text>
        </Pressable>
        <Button
          title="New here? Sign up"
          variant="outline"
          onPress={() => router.push('/(auth)/register')}
        />

        <Text
          style={{
            textAlign: 'center',
            marginTop: 8,
            fontSize: 18,
            fontWeight: '800',
            color: colors.primary,
            letterSpacing: 1,
          }}
        >
          ॥ जय महेश ॥
        </Text>
        <Muted>New students: tap Sign up — the warden approves your request.</Muted>
      </View>
    </SafeAreaView>
  );
}
