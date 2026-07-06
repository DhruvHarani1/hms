import { Platform } from 'react-native';
import { api } from '@/src/lib/api';

/* Web Push (VAPID) registration — web only. On iOS this only works inside an
 * installed PWA (Add to Home Screen), iOS 16.4+. No-op everywhere else. */

const g: any = typeof globalThis !== 'undefined' ? globalThis : {};

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = g.atob(b64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export function webPushSupported(): boolean {
  return (
    Platform.OS === 'web' &&
    !!g.navigator &&
    'serviceWorker' in g.navigator &&
    'PushManager' in g &&
    'Notification' in g
  );
}

export function webPushGranted(): boolean {
  return webPushSupported() && g.Notification?.permission === 'granted';
}

/** Ask permission + subscribe. Call from a user gesture (button/login tap). */
export async function registerWebPush(): Promise<boolean> {
  if (!webPushSupported()) return false;
  try {
    const reg = await g.navigator.serviceWorker.register('/sw.js');
    const perm = await g.Notification.requestPermission();
    if (perm !== 'granted') return false;

    const { data } = await api.get('/web-push/public-key');
    if (!data?.key) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(data.key),
      });
    }
    await api.post('/web-push/subscribe', { subscription: sub.toJSON() });
    return true;
  } catch {
    return false;
  }
}
