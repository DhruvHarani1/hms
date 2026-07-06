import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type DocKind = 'aadhaar' | 'course_proof' | 'photo';

/**
 * Pick an image and upload it directly to Cloudinary (signed by our backend).
 * Returns the stored public_id (save it to the profile), or null if cancelled.
 */
export async function pickAndUpload(kind: DocKind): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) throw new Error('Photo library permission denied');

  const res = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.6,
  });
  if (res.canceled || !res.assets?.length) return null;

  const asset = res.assets[0];
  const contentType = asset.mimeType || 'image/jpeg';

  const sign = await api.post('/uploads/sign', { kind, contentType });
  const { cloudName, apiKey, timestamp, publicId, accessMode, signature, uploadUrl, key } =
    sign.data;

  const fd = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(asset.uri)).blob();
    fd.append('file', blob);
  } else {
    fd.append('file', {
      uri: asset.uri,
      type: contentType,
      name: 'upload.jpg',
    } as any);
  }
  fd.append('api_key', String(apiKey));
  fd.append('timestamp', String(timestamp));
  fd.append('public_id', publicId);
  fd.append('access_mode', accessMode);
  fd.append('signature', signature);

  const up = await fetch(uploadUrl, { method: 'POST', body: fd });
  if (!up.ok) {
    const txt = await up.text().catch(() => '');
    throw new Error(`Upload failed (${up.status}) ${txt.slice(0, 120)}`);
  }
  return key as string;
}

/** Get a short-lived URL to view/download a stored document. */
export async function getFileUrl(key: string): Promise<string> {
  const res = await api.get('/uploads/url', { params: { key } });
  return res.data.url as string;
}
