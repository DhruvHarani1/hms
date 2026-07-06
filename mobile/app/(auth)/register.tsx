import { useState } from 'react';
import { Alert, Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { Button, Field, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function Register() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit() {
    if (!fullName || !email || !password) {
      Alert.alert('Missing details', 'Name, email and password are required.');
      return;
    }
    if (password.length < 8) {
      Alert.alert('Weak password', 'Use at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const res = await api.post('/auth/register', {
        fullName,
        email: email.trim().toLowerCase(),
        phone: phone || undefined,
        password,
      });
      const reapplied = res.data?.reapplied;
      Alert.alert(
        '✅ Request sent',
        reapplied
          ? 'Your request was re-submitted. The warden will review it again.'
          : 'Your join request was sent. You can log in once the warden approves it.',
        [{ text: 'OK', onPress: () => router.replace('/(auth)/login') }],
      );
    } catch (e: any) {
      Alert.alert(
        'Could not register',
        e?.response?.data?.message ?? 'Please try again.',
      );
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
