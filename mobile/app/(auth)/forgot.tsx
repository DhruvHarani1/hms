import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { Button, Field, H1, Muted } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

export default function Forgot() {
  const router = useRouter();
  const [step, setStep] = useState<'email' | 'reset'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function sendCode() {
    setMsg(null);
    if (!email) {
      setMsg({ kind: 'err', text: 'Enter your email.' });
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/forgot-password', { email: email.trim().toLowerCase() });
      setStep('reset');
      setMsg({ kind: 'ok', text: `If that email exists, a 6-digit code was sent to ${email}. Check your inbox (and spam).` });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.message ?? 'Try again.' });
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    setMsg(null);
    if (!code || password.length < 8) {
      setMsg({ kind: 'err', text: 'Enter the code and a password (min 8 chars).' });
      return;
    }
    setBusy(true);
    try {
      await api.post('/auth/reset-password', {
        email: email.trim().toLowerCase(),
        code: code.trim(),
        newPassword: password,
      });
      setMsg({ kind: 'ok', text: '✅ Password changed. You can log in now.' });
    } catch (e: any) {
      setMsg({ kind: 'err', text: e?.response?.data?.message ?? 'Invalid or expired code.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 14 }}>
        <View style={{ alignItems: 'center', gap: 6, marginBottom: 8 }}>
          <Image
            source={require('../../assets/logo.jpg')}
            style={{ width: 100, height: 100, borderRadius: 18 }}
            resizeMode="contain"
          />
          <H1>Reset password</H1>
          <Muted>
            {step === 'email'
              ? 'Enter your email to get a reset code.'
              : 'Enter the code from your email + a new password.'}
          </Muted>
        </View>

        {msg ? (
          <View
            style={{
              padding: 14,
              borderRadius: radius.md,
              backgroundColor: msg.kind === 'ok' ? '#dcfce7' : '#fee2e2',
              borderWidth: 1,
              borderColor: msg.kind === 'ok' ? colors.success : colors.danger,
            }}
          >
            <Text style={{ color: msg.kind === 'ok' ? '#166534' : '#991b1b', fontWeight: '700' }}>
              {msg.text}
            </Text>
          </View>
        ) : null}

        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          editable={step === 'email'}
        />

        {step === 'email' ? (
          <Button title="Send code" onPress={sendCode} loading={busy} />
        ) : (
          <>
            <Field
              label="6-digit code"
              value={code}
              onChangeText={setCode}
              keyboardType="number-pad"
              placeholder="123456"
            />
            <Field
              label="New password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="min 8 characters"
            />
            <Button title="Reset password" onPress={reset} loading={busy} />
            <Button title="Resend code" variant="outline" onPress={sendCode} />
          </>
        )}

        <Button
          title="Back to login"
          variant="outline"
          onPress={() => router.replace('/(auth)/login')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
