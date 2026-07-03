import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Base API URL.
 * - iOS simulator can reach the host via localhost.
 * - Android emulator must use 10.0.2.2 to reach the host machine's localhost.
 * - On a physical device, replace with your computer's LAN IP (e.g. http://192.168.1.5:3000/api/v1).
 */
function resolveApiUrl(): string {
  const fromConfig = (Constants.expoConfig?.extra as any)?.apiUrl as
    | string
    | undefined;

  if (fromConfig && fromConfig.includes('localhost')) {
    if (Platform.OS === 'android') {
      return fromConfig.replace('localhost', '10.0.2.2');
    }
  }
  return fromConfig ?? 'http://localhost:3000/api/v1';
}

export const API_URL = resolveApiUrl();
