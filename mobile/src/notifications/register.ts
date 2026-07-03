import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '@/src/lib/api';

/**
 * Push registration.
 *
 * IMPORTANT: `expo-notifications` remote-push was removed from Expo Go in
 * SDK 53+. Even *importing* the module in Expo Go throws a red error. So we
 * lazy-require it and skip entirely when running inside Expo Go. Remote push
 * works only in a Dev Build / production build (EAS). In Expo Go the app still
 * works fully via the in-app notification inbox.
 */

const isExpoGo = Constants.executionEnvironment === 'storeClient';

export async function registerForPush(): Promise<void> {
  if (isExpoGo) {
    // Expo Go: remote push unsupported — no-op. In-app inbox covers the demo.
    return;
  }

  try {
    // Lazy require so Expo Go never loads the module.
    const Notifications = require('expo-notifications');
    const Device = require('expo-device');

    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });

    // Android needs a channel for heads-up (lock-screen) notifications.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Hostel alerts',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#4f46e5',
        sound: 'default',
      });
    }

    if (!Device.isDevice) return;

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (existing !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return;

    // Pass projectId explicitly (dev-client builds don't always auto-detect it).
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      (Constants as any).easConfig?.projectId;
    const tokenData = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await api.post('/device-tokens', { platform, token: tokenData.data });
  } catch {
    // Non-fatal — app still works with in-app notifications.
  }
}
