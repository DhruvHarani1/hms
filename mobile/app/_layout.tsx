import { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/src/stores/auth';
import { colors } from '@/src/lib/theme';

const queryClient = new QueryClient();

function AuthGate() {
  const { user, initialized, bootstrap } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    bootstrap();
  }, []);

  useEffect(() => {
    if (!initialized) return;
    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Route by role.
      if (user.role === 'student') router.replace('/(student)');
      else router.replace('/(warden)');
    } else if (user && (segments as string[]).length === 0) {
      if (user.role === 'student') router.replace('/(student)');
      else router.replace('/(warden)');
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
