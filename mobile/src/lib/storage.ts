import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Tokens are kept in the device secure enclave (iOS Keychain / Android Keystore).
 * On web (Expo web preview) SecureStore is unavailable, so fall back to localStorage.
 */
const ACCESS = 'hms_access_token';
const REFRESH = 'hms_refresh_token';

async function setItem(key: string, value: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem(key, value);
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    return localStorage.getItem(key);
  }
  return SecureStore.getItemAsync(key);
}

async function deleteItem(key: string) {
  if (Platform.OS === 'web') {
    localStorage.removeItem(key);
    return;
  }
  await SecureStore.deleteItemAsync(key);
}

export const tokenStore = {
  async save(accessToken: string, refreshToken: string) {
    await setItem(ACCESS, accessToken);
    await setItem(REFRESH, refreshToken);
  },
  getAccess: () => getItem(ACCESS),
  getRefresh: () => getItem(REFRESH),
  async clear() {
    await deleteItem(ACCESS);
    await deleteItem(REFRESH);
  },
};
