import { useState, useEffect } from 'react';
import { Image, ScrollView, Text, View, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { Button, Field, H1, Muted } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

export default function Verify() {
  const router = useRouter();
  const { email: initialEmail } = useLocalSearchParams<{ email: string }>();
  const { user, updateEmailVerification, logout } = useAuth();

  const [currentEmail, setCurrentEmail] = useState(initialEmail || user?.email || '');
  const [editingEmail, setEditingEmail] = useState(initialEmail || user?.email || '');
  const [isEditing, setIsEditing] = useState(false);
  const [otp, setOtp] = useState('');
  
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Handle countdown timer for resend cooldown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((c) => c - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function sendOtp() {
    setMsg(null);
    setBusy(true);
    try {
      const payload: any = { email: currentEmail };
      if (isEditing && editingEmail.trim().toLowerCase() !== currentEmail.toLowerCase()) {
        payload.newEmail = editingEmail.trim().toLowerCase();
      }

      const res = await api.post('/auth/resend-otp', payload);
      
      if (res.data?.sentTo) {
        setCurrentEmail(res.data.sentTo);
        setEditingEmail(res.data.sentTo);
      }
      
      setIsEditing(false);
      setCooldown(30); // 30 seconds cooldown
      setMsg({
        kind: 'ok',
        text: '✅ Verification code sent to your email address.',
      });
    } catch (e: any) {
      setMsg({
        kind: 'err',
        text: e?.response?.data?.message ?? 'Could not send verification code. Try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (otp.length !== 6) {
      setMsg({ kind: 'err', text: 'Please enter a valid 6-digit code.' });
      return;
    }
    setMsg(null);
    setBusy(true);
    try {
      const payload: any = { email: currentEmail, otp };
      if (editingEmail.trim().toLowerCase() !== currentEmail.toLowerCase()) {
        payload.newEmail = editingEmail.trim().toLowerCase();
      }

      const res = await api.post('/auth/verify-otp', payload);
      
      // Update local auth store if user is already logged in
      const finalEmail = res.data.email || currentEmail;
      if (user) {
        updateEmailVerification(finalEmail, new Date().toISOString());
      }

      Alert.alert('✅ Verified', 'Email address verified successfully!', [
        {
          text: 'Proceed',
          onPress: () => {
            if (!user) {
              router.replace('/(auth)/login');
            }
          },
        },
      ]);
    } catch (e: any) {
      setMsg({
        kind: 'err',
        text: e?.response?.data?.message ?? 'Incorrect verification code. Please check and try again.',
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleLogout() {
    setBusy(true);
    try {
      await logout();
      router.replace('/(auth)/login');
    } catch {
      Alert.alert('Error', 'Logout failed.');
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
          <H1>Verify Email Address</H1>
          <Muted>We need to verify your email to secure your account.</Muted>
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
          </View>
        ) : null}

        <View style={{ gap: 8, padding: 14, backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: colors.muted }}>
            Target Email Address:
          </Text>
          
          {isEditing ? (
            <View style={{ gap: 8 }}>
              <TextInput
                value={editingEmail}
                onChangeText={setEditingEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: radius.md,
                  padding: 10,
                  fontSize: 15,
                  backgroundColor: '#fff',
                }}
                placeholder="Enter your real email address"
              />
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Cancel"
                    variant="outline"
                    onPress={() => {
                      setEditingEmail(currentEmail);
                      setIsEditing(false);
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="Send Code"
                    onPress={sendOtp}
                    loading={busy}
                  />
                </View>
              </View>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, flex: 1, marginRight: 8 }} numberOfLines={1}>
                {currentEmail}
              </Text>
              <View>
                <Button
                  title="Change Email"
                  variant="outline"
                  onPress={() => setIsEditing(true)}
                />
              </View>
            </View>
          )}
        </View>

        {!isEditing && (
          <View style={{ gap: 14 }}>
            <Field
              label="6-Digit Verification Code (OTP)"
              value={otp}
              onChangeText={setOtp}
              keyboardType="number-pad"
              maxLength={6}
              placeholder="123456"
            />

            <Button title="Verify Code" onPress={onVerify} loading={busy} />

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={cooldown > 0 ? `Resend Code (${cooldown}s)` : 'Send/Resend Code'}
                  variant="outline"
                  onPress={sendOtp}
                  disabled={cooldown > 0 || busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Button
                  title="Logout"
                  variant="danger"
                  onPress={handleLogout}
                  disabled={busy}
                />
              </View>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
