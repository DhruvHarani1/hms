import { useState } from 'react';
import { View, TextInput, Pressable, Text, ActivityIndicator, Platform, Alert } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, radius } from '@/src/lib/theme';
import { api } from '@/src/lib/api';

export function ChatInput({
  onSend,
  conversationId,
}: {
  onSend: (content: string, type: 'text' | 'image') => Promise<any>;
  conversationId: string;
}) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    try {
      await onSend(trimmed, 'text');
      setText('');
    } catch {}
    setSending(false);
  };

  const uploadAndSendChatPhoto = async (asset: ImagePicker.ImagePickerAsset) => {
    setSending(true);
    try {
      const contentType = asset.mimeType || 'image/jpeg';

      // Get signed upload params from backend.
      const sign = await api.post('/uploads/sign', { kind: 'photo', contentType });
      const { apiKey, timestamp, publicId, accessMode, signature, uploadUrl, key } = sign.data;

      // Upload directly to Cloudinary.
      const fd = new FormData();
      if (Platform.OS === 'web') {
        const blob = await (await fetch(asset.uri)).blob();
        fd.append('file', blob);
      } else {
        fd.append('file', {
          uri: asset.uri,
          type: contentType,
          name: 'chat_photo.jpg',
        } as any);
      }
      fd.append('api_key', String(apiKey));
      fd.append('timestamp', String(timestamp));
      fd.append('public_id', publicId);
      fd.append('access_mode', accessMode);
      fd.append('signature', signature);

      const up = await fetch(uploadUrl, { method: 'POST', body: fd });
      if (!up.ok) throw new Error('Upload failed');

      // Send image message with the Cloudinary key.
      await onSend(key, 'image');
    } catch (e: any) {
      Alert.alert('Error', e?.message ?? 'Upload failed');
    } finally {
      setSending(false);
    }
  };

  const handlePhoto = async () => {
    if (sending) return;

    Alert.alert(
      'Select Image Source',
      'Choose how you want to upload the photo:',
      [
        {
          text: 'Take Photo',
          onPress: async () => {
            const perm = await ImagePicker.requestCameraPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Permission Denied', 'Camera permission is required to capture photos.');
              return;
            }
            const res = await ImagePicker.launchCameraAsync({
              mediaTypes: ['images'],
              quality: 0.5,
            });
            if (!res.canceled && res.assets?.length) {
              uploadAndSendChatPhoto(res.assets[0]);
            }
          },
        },
        {
          text: 'Choose from Gallery',
          onPress: async () => {
            const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!perm.granted) {
              Alert.alert('Permission Denied', 'Photo library permission is required to select photos.');
              return;
            }
            const res = await ImagePicker.launchImageLibraryAsync({
              mediaTypes: ['images'],
              quality: 0.5,
            });
            if (!res.canceled && res.assets?.length) {
              uploadAndSendChatPhoto(res.assets[0]);
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
        },
      ],
      { cancelable: true }
    );
  };

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'flex-end',
        paddingHorizontal: 10,
        paddingVertical: 8,
        backgroundColor: colors.card,
        borderTopWidth: 1,
        borderTopColor: colors.border,
        gap: 8,
      }}
    >
      {/* Photo button */}
      <Pressable
        onPress={handlePhoto}
        disabled={sending}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: colors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 18 }}>📷</Text>
      </Pressable>

      {/* Text input */}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Type a message..."
        placeholderTextColor={colors.muted}
        multiline
        maxLength={4000}
        style={{
          flex: 1,
          minHeight: 40,
          maxHeight: 120,
          backgroundColor: colors.bg,
          borderRadius: radius.lg,
          paddingHorizontal: 14,
          paddingVertical: 10,
          fontSize: 14,
          color: colors.text,
          borderWidth: 1,
          borderColor: colors.border,
        }}
        editable={!sending}
        onSubmitEditing={handleSend}
        blurOnSubmit={false}
      />

      {/* Send button */}
      <Pressable
        onPress={handleSend}
        disabled={sending || !text.trim()}
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: text.trim() ? colors.primary : colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <Text style={{ fontSize: 18, color: '#fff' }}>➤</Text>
        )}
      </Pressable>
    </View>
  );
}
