import { Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { api } from './api';

export type DocKind = 'aadhaar' | 'course_proof' | 'photo' | 'complaint';

/** Helper to upload asset to Cloudinary. */
async function uploadAsset(asset: ImagePicker.ImagePickerAsset, kind: DocKind): Promise<string> {
  const contentType = asset.mimeType || 'image/jpeg';
  const sign = await api.post('/uploads/sign', { kind, contentType });
  const { apiKey, timestamp, publicId, accessMode, signature, uploadUrl, key } = sign.data;

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

/**
 * Pick an image (camera or gallery) and upload it directly to Cloudinary.
 * Returns the stored public_id (save it to the profile), or null if cancelled.
 */
export async function pickAndUpload(kind: DocKind): Promise<string | null> {
  return new Promise((resolve, reject) => {
    Alert.alert(
      'Select Image Source',
      'Choose how you want to upload the photo:',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestCameraPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
                resolve(null);
                return;
              }
              const res = await ImagePicker.launchCameraAsync({
                mediaTypes: ['images'],
                quality: 0.6,
              });
              if (res.canceled || !res.assets?.length) {
                resolve(null);
                return;
              }
              const key = await uploadAsset(res.assets[0], kind);
              resolve(key);
            } catch (err: any) {
              reject(err);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            try {
              const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
              if (!perm.granted) {
                Alert.alert('Permission Denied', 'Photo library permission is required to select photos.');
                resolve(null);
                return;
              }
              const res = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                quality: 0.6,
              });
              if (res.canceled || !res.assets?.length) {
                resolve(null);
                return;
              }
              const key = await uploadAsset(res.assets[0], kind);
              resolve(key);
            } catch (err: any) {
              reject(err);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve(null),
        },
      ],
      { cancelable: true }
    );
  });
}

/** Get a short-lived URL to view/download a stored document. */
export async function getFileUrl(key: string): Promise<string> {
  const res = await api.get('/uploads/url', { params: { key } });
  return res.data.url as string;
}
