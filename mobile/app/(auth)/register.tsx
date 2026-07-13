import { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { SelectField } from '@/src/components/form';
import { Button, Field, H1, Muted } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('Student');
  const [busy, setBusy] = useState(false);
  // Inline messages (Alert is unreliable on web).
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  async function onSubmit() {
    setMsg(null);
    if (!fullName || !email || !password) {
      setMsg({ kind: 'err', text: 'Name, email and password are required.' });
      return;
    }
    if (password.length < 8) {
      setMsg({ kind: 'err', text: 'Password must be at least 8 characters.' });
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/auth/register', {
        fullName,
        email: email.trim().toLowerCase(),
        phone: phone || undefined,
        password,
        role: role === 'Cook' ? 'cook' : 'student',
      });
      const reapplied = res.data?.reapplied;
      if (reapplied) {
        setMsg({
          kind: 'ok',
          text: '✅ Request re-submitted. The warden will review it again.',
        });
      } else {
        if (Platform.OS === 'web') {
          alert('Verification Required: A verification code was sent to your email. Please verify to complete your signup.');
          router.replace({
            pathname: '/(auth)/verify',
            params: { email: email.trim().toLowerCase() },
          });
        } else {
          Alert.alert(
            'Verification Required',
            'A verification code was sent to your email. Please verify to complete your signup.',
            [
              {
                text: 'OK',
                onPress: () => {
                  router.replace({
                    pathname: '/(auth)/verify',
                    params: { email: email.trim().toLowerCase() },
                  });
                },
              },
            ]
          );
        }
      }
    } catch (e: any) {
      setMsg({
        kind: 'err',
        text: e?.response?.data?.message ?? 'Could not register. Please try again.',
      });
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
            style={{ width: 110, height: 110, borderRadius: 18 }}
            resizeMode="contain"
          />
          <H1>Join AIFDMS Hostel</H1>
          <Muted>Create an account — warden approves before first login.</Muted>
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
            <Text
              style={{
                color: msg.kind === 'ok' ? '#166534' : '#991b1b',
                fontWeight: '700',
              }}
            >
              {msg.text}
            </Text>
            {msg.kind === 'ok' ? (
              <Pressable onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 8 }}>
                <Text style={{ color: colors.primary, fontWeight: '800' }}>
                  Go to login →
                </Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        <SelectField
          label="I am a"
          value={role}
          options={['Student', 'Cook']}
          onChange={setRole}
        />
        <Field label="Full name" value={fullName} onChangeText={setFullName} />
        <Field
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <Field
          label="Mobile number"
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
        <Field
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="min 8 characters"
        />
        <Muted>You can add the rest of your details in Profile after login.</Muted>

        <Button title="Send join request" onPress={onSubmit} loading={busy} />
        <Button
          title="Back to login"
          variant="outline"
          onPress={() => router.replace('/(auth)/login')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
