import { useEffect, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View, Text, Linking, KeyboardAvoidingView, Platform } from 'react-native';
import Constants from 'expo-constants';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { useUsageTracker } from '@/src/hooks/useUsageTracker';
import { Button, Card, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

const queryClient = new QueryClient();

function homeFor(role: string) {
  if (role === 'student') return '/(student)';
  if (role === 'cook') return '/(cook)';
  return '/(warden)';
}

function isOutdated(currentVer: string, minVer: string): boolean {
  const p1 = currentVer.split('.').map(Number);
  const p2 = minVer.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const v1 = p1[i] || 0;
    const v2 = p2[i] || 0;
    if (v1 < v2) return true;
    if (v1 > v2) return false;
  }
  return false;
}

function AuthGate() {
  const { user, initialized, bootstrap } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useUsageTracker();

  const [outdated, setOutdated] = useState(false);
  const [versionDetails, setVersionDetails] = useState<{
    current: string;
    latest: string;
    minRequired: string;
    downloadUrl: string;
  } | null>(null);

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    async function checkAppVersion() {
      try {
        const res = await api.get('/download/version');
        const { minRequiredVersion, latestVersion, downloadUrl } = res.data;
        const localVer = Constants.expoConfig?.version || '1.0.0';

        if (isOutdated(localVer, minRequiredVersion)) {
          setVersionDetails({
            current: localVer,
            latest: latestVersion,
            minRequired: minRequiredVersion,
            downloadUrl: downloadUrl || 'https://hms-api-47qf.onrender.com/api/v1/download',
          });
          setOutdated(true);
        }
      } catch (e) {
        // Silently ignore network check errors so offline app still functions
      }
    }
    checkAppVersion();
  }, []);

  useEffect(() => {
    if (!initialized || outdated) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && (user.role === 'student' || user.role === 'cook') && !user.emailVerified) {
      const pathSegments = segments as string[];
      const onVerifyScreen = pathSegments[0] === '(auth)' && pathSegments[1] === 'verify';
      if (!onVerifyScreen) {
        router.replace(`/(auth)/verify?email=${encodeURIComponent(user.email)}`);
      }
    } else if (user && inAuthGroup) {
      // Route by role.
      router.replace(homeFor(user.role));
    } else if (user && (segments as string[]).length === 0) {
      router.replace(homeFor(user.role));
    }
  }, [user, initialized, segments, outdated]);

  if (outdated && versionDetails) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, justifyContent: 'center', alignItems: 'center' }}>
        <Card style={{ width: '100%', padding: 24, gap: 16, alignItems: 'center' }}>
          <Text style={{ fontSize: 54, marginBottom: 4 }}>🚨</Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
            Update Required
          </Text>
          <Muted style={{ textAlign: 'center', fontSize: 14, lineHeight: 20 }}>
            A mandatory app update is required to continue using AIFDMS. Please download the latest version.
          </Muted>

          <View style={{ backgroundColor: colors.bg, padding: 12, borderRadius: 10, width: '100%', gap: 6 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Muted style={{ fontSize: 12 }}>Your Version:</Muted>
              <Text style={{ fontWeight: '700', fontSize: 12, color: colors.danger }}>v{versionDetails.current}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Muted style={{ fontSize: 12 }}>Required Version:</Muted>
              <Text style={{ fontWeight: '700', fontSize: 12, color: colors.primary }}>v{versionDetails.minRequired}</Text>
            </View>
          </View>

          <Button
            title="📥 Download Update"
            onPress={() => Linking.openURL(versionDetails.downloadUrl)}
          />
        </Card>
      </View>
    );
  }

  if (!initialized) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(warden)" />
      <Stack.Screen name="(student)" />
      <Stack.Screen name="(cook)" />
      <Stack.Screen name="notifications" options={{ headerShown: true }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={0}
        >
          <AuthGate />
        </KeyboardAvoidingView>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
