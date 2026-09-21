import { useState } from 'react';
import {
  Alert,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  Text,
  View,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { EmptyState, ErrorState, SkeletonList, Badge } from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';
import { pickAndUpload, getFileUrl } from '@/src/lib/upload';

const CATEGORIES = ['announcement', 'event', 'holiday', 'rules', 'exam'] as const;

export default function WardenNotices() {
  const qc = useQueryClient();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState<(typeof CATEGORIES)[number]>('announcement');
  const [pinned, setPinned] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState('');
  const [imageKey, setImageKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-notices'],
    queryFn: async () => (await api.get('/notices', { params: { includeExpired: 'true' } })).data,
  });

  async function handleAddImage() {
    setUploadingImage(true);
    try {
      const key = await pickAndUpload('notice');
      if (key) {
        setImageKey(key);
        const url = await getFileUrl(key);
        setPreviewUrl(url);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message ?? 'Failed to upload image.');
    } finally {
      setUploadingImage(false);
    }
  }

  async function publish() {
    if (!title || !body) {
      Alert.alert('Missing', 'Add a title and body.');
      return;
    }
    setBusy(true);
    try {
      const days = parseInt(expiresInDays, 10);
      const expiresAt =
        Number.isFinite(days) && days > 0
          ? new Date(Date.now() + days * 86400000).toISOString()
          : undefined;
      await api.post('/notices', {
        title,
        body,
        category,
        pinned,
        imageKey: imageKey ?? undefined,
        expiresAt,
      });
      setTitle('');
      setBody('');
      setCategory('announcement');
      setPinned(false);
      setExpiresInDays('');
      setImageKey(null);
      setPreviewUrl(null);
      qc.invalidateQueries({ queryKey: ['warden-notices'] });
      Alert.alert('✅ Posted', 'Students have been notified.');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function togglePin(id: string, next: boolean) {
    try {
      await api.patch(`/notices/${id}`, { pinned: next });
      qc.invalidateQueries({ queryKey: ['warden-notices'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function remove(id: string) {
    Alert.alert('Delete notice?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await api.delete(`/notices/${id}`);
            qc.invalidateQueries({ queryKey: ['warden-notices'] });
          } catch (e: any) {
            Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
          }
        },
      },
    ]);
  }

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
      data={data ?? []}
      keyExtractor={(item: any) => item.id}
      ListHeaderComponent={
        <View style={{ gap: 12, marginBottom: 8 }}>
          <H1>Post a Notice</H1>
          <Card style={{ gap: 12 }}>
            <Field label="Title" value={title} onChangeText={setTitle} />
            <Field
              label="Message"
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
            />

            <Muted>Category</Muted>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {CATEGORIES.map((c) => (
                <Pressable
                  key={c}
                  onPress={() => setCategory(c)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: category === c ? colors.primary : colors.border,
                    backgroundColor: category === c ? colors.primary + '22' : '#fff',
                  }}
                >
                  <Text style={{ color: category === c ? colors.primary : colors.text }}>
                    {c}
                  </Text>
                </Pressable>
              ))}
            </View>

            <Pressable
              onPress={() => setPinned((p) => !p)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
            >
              <Text style={{ fontSize: 18 }}>{pinned ? '📌' : '📍'}</Text>
              <Text style={{ color: colors.text }}>
                {pinned ? 'Pinned to top' : 'Pin to top'}
              </Text>
            </Pressable>

            <Field
              label="Auto-expire after (days, optional)"
              value={expiresInDays}
              onChangeText={setExpiresInDays}
              keyboardType="number-pad"
            />

            <Muted>Image (optional)</Muted>
            {uploadingImage ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <ActivityIndicator color={colors.primary} />
                <Text style={{ color: colors.muted }}>Uploading image...</Text>
              </View>
            ) : imageKey && previewUrl ? (
              <View style={{ gap: 8 }}>
                <Image
                  source={{ uri: previewUrl }}
                  style={{ width: '100%', height: 160, borderRadius: 8, backgroundColor: '#eee' }}
                  resizeMode="cover"
                />
                <Button
                  title="Remove Image"
                  variant="outline"
                  onPress={() => {
                    setImageKey(null);
                    setPreviewUrl(null);
                  }}
                />
              </View>
            ) : (
              <Button title="Attach Image" variant="outline" onPress={handleAddImage} />
            )}

            <Button
              title="Publish & Notify"
              onPress={publish}
              loading={busy || uploadingImage}
            />
          </Card>

          <H1>All Notices</H1>
        </View>
      }
      ListEmptyComponent={
        isLoading ? (
          <SkeletonList count={3} />
        ) : isError ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <EmptyState emoji="📢" title="No notices yet" />
        )
      }
      renderItem={({ item }: { item: any }) => (
        <Card style={{ gap: 6 }}>
          <Text style={{ fontWeight: '700', color: colors.text }}>
            {item.pinned ? '📌 ' : ''}
            {item.title}
          </Text>
          <Badge label={item.category} />
          <Text style={{ color: colors.text, marginTop: 2 }}>{item.body}</Text>
          {item.imageUrl && (
            <Image
              source={{ uri: item.imageUrl }}
              style={{ width: '100%', height: 160, borderRadius: 8, marginTop: 6, backgroundColor: '#eee' }}
              resizeMode="cover"
            />
          )}
          {item.expiresAt && (
            <Muted>Expires {new Date(item.expiresAt).toLocaleDateString()}</Muted>
          )}
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
            <Button
              title={item.pinned ? 'Unpin' : 'Pin'}
              variant="outline"
              onPress={() => togglePin(item.id, !item.pinned)}
            />
            <Button title="Delete" variant="danger" onPress={() => remove(item.id)} />
          </View>
        </Card>
      )}
    />
  );
}
