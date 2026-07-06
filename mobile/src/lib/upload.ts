import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type DocKind = 'aadhaar' | 'course_proof' | 'photo';

/**
 * Pick an image and upload it to R2 via a presigned PUT.
 * Returns the stored object key (save it to the profile), or null if cancelled.
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
  const { uploadUrl, key } = sign.data;

  const fileRes = await fetch(asset.uri);
  const blob = await fileRes.blob();
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    body: blob,
    headers: { 'Content-Type': contentType },
  });
  if (!put.ok) throw new Error(`Upload failed (${put.status})`);

  return key as string;
}

/** Get a short-lived URL to view/download a stored document. */
export async function getFileUrl(key: string): Promise<string> {
  const res = await api.get('/uploads/url', { params: { key } });
  return res.data.url as string;
}
