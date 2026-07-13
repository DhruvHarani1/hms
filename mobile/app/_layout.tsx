import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/stores/auth';
import { useUsageTracker } from '@/src/hooks/useUsageTracker';
import { colors } from '@/src/lib/theme';

const queryClient = new QueryClient();

function homeFor(role: string) {
  if (role === 'student') return '/(student)';
  if (role === 'cook') return '/(cook)';
  return '/(warden)';
}

function AuthGate() {
  const { user, initialized, bootstrap } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  useUsageTracker();

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!initialized) return;
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
  }, [user, initialized, segments]);

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
        <AuthGate />
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
