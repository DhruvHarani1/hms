import Constants from 'expo-constants';

/**
 * Base API URL.
 *
 * In development we AUTO-DERIVE the host from the Metro dev-server IP the app
 * connected to (`hostUri`, e.g. "192.168.29.51:8081"). So whatever LAN IP your
 * PC has today, the API URL follows it automatically — no manual editing when
 * your Wi-Fi / IP changes. Backend is assumed on port 3000.
 *
 * In a production/standalone build there is no dev server, so we fall back to
 * `extra.apiUrl` from app.json (set this to your deployed API before shipping).
 */
const API_PORT = 3000;
const API_PREFIX = '/api/v1';

function resolveApiUrl(): string {
  // Metro dev-server host: "<ip>:<port>". Present in Expo Go and dev builds.
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    (Constants as any).manifest2?.extra?.expoClient?.hostUri;

  if (__DEV__ && hostUri) {
    const host = String(hostUri).split(':')[0];
    if (host) return `http://${host}:${API_PORT}${API_PREFIX}`;
  }

  // Production / standalone fallback.
  const fromConfig = (Constants.expoConfig?.extra as any)?.apiUrl as
    | string
    | undefined;
  return fromConfig ?? `http://localhost:${API_PORT}${API_PREFIX}`;
}

export const API_URL = resolveApiUrl();
