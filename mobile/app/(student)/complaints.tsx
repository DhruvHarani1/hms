import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View, Modal, Image, ActivityIndicator } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
  StatusPill,
} from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';
import { pickAndUpload, getFileUrl } from '@/src/lib/upload';

export default function StudentComplaints() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const [photoKey, setPhotoKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  const {
    data: complaints,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['my-complaints'],
    queryFn: async () => (await api.get('/complaints')).data,
  });
  const { data: categories } = useQuery({
    queryKey: ['complaint-categories'],
    queryFn: async () => (await api.get('/complaint-categories')).data,
  });

  async function handleAddPhoto() {
    setUploadingPhoto(true);
    try {
      const key = await pickAndUpload('complaint');
      if (key) {
        setPhotoKey(key);
        const url = await getFileUrl(key);
        setPreviewUrl(url);
      }
    } catch (e: any) {
      Alert.alert('Upload Error', e?.message ?? 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function submit() {
    if (!title || !description) {
      Alert.alert('Missing', 'Add a title and description.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/complaints', {
        title,
        description,
        categoryId,
        attachments: photoKey ? [photoKey] : [],
      });
      setTitle('');
      setDescription('');
      setCategoryId(undefined);
      setPhotoKey(null);
      setPreviewUrl(null);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  function handleCancel() {
    setTitle('');
    setDescription('');
    setCategoryId(undefined);
    setPhotoKey(null);
    setPreviewUrl(null);
    setOpen(false);
  }

  async function toggleUpvote(id: string) {
    try {
      await api.post(`/complaints/${id}/upvote`);
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not toggle upvote.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        data={complaints ?? []}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={
          <View style={{ marginBottom: 8 }}>
            <Button title="+ New complaint" onPress={() => setOpen(true)} />
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={3} />
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : (
            <EmptyState
              emoji="📝"
              title="No complaints yet"
              subtitle="Tap + New complaint to report an issue."
            />
          )
        }
        renderItem={({ item }: { item: any }) => (
          <Card style={{ gap: 4 }}>
            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', flex: 1, color: colors.text }}>
                {item.title}
              </Text>
              <StatusPill status={item.status} />
            </View>
            <Muted>{item.category?.name ?? 'General'}</Muted>
            <Text style={{ color: colors.text, marginTop: 4 }}>
              {item.description}
            </Text>

            {item.attachments && item.attachments.length > 0 && (
              <Image
                source={{ uri: item.attachments[0].fileUrl }}
                style={{
                  width: '100%',
                  height: 180,
                  borderRadius: 8,
                  marginTop: 10,
                  backgroundColor: '#eee',
                }}
                resizeMode="cover"
              />
            )}

            <Pressable
              onPress={() => toggleUpvote(item.id)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 10,
                alignSelf: 'flex-start',
                paddingHorizontal: 12,
                paddingVertical: 6,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: item.hasUpvoted ? colors.primary : colors.border,
                backgroundColor: item.hasUpvoted ? colors.primary + '11' : 'transparent',
                gap: 6,
              }}
            >
              <Text style={{ fontSize: 14, color: item.hasUpvoted ? colors.primary : colors.muted }}>▲</Text>
              <Text style={{ fontWeight: '600', fontSize: 13, color: item.hasUpvoted ? colors.primary : colors.text }}>
                {item.hasUpvoted ? 'Upvoted' : 'Upvote'} ({item.upvoteCount ?? 0})
              </Text>
            </Pressable>
          </Card>
        )}
      />

      <Modal visible={open} animationType="slide">
        <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
          <H1>New Complaint</H1>
          <Field label="Title" value={title} onChangeText={setTitle} />
          <Field
            label="Description"
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={4}
          />
          <Muted>Category</Muted>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {(categories ?? []).map((c: any) => (
              <Pressable
                key={c.id}
                onPress={() => setCategoryId(c.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor:
                    categoryId === c.id ? colors.primary : colors.border,
                  backgroundColor:
                    categoryId === c.id ? colors.primary + '22' : '#fff',
                }}
              >
                <Text
                  style={{
                    color: categoryId === c.id ? colors.primary : colors.text,
                  }}
                >
                  {c.name}
                </Text>
              </Pressable>
            ))}
          </View>

          <Muted>Photo Attachment</Muted>
          {uploadingPhoto ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ActivityIndicator color={colors.primary} />
              <Text style={{ color: colors.muted }}>Uploading photo...</Text>
            </View>
          ) : photoKey && previewUrl ? (
            <View style={{ gap: 8 }}>
              <Image
                source={{ uri: previewUrl }}
                style={{ width: '100%', height: 160, borderRadius: 8, backgroundColor: '#eee' }}
                resizeMode="cover"
              />
              <Button
                title="Remove Photo"
                variant="outline"
                onPress={() => {
                  setPhotoKey(null);
                  setPreviewUrl(null);
                }}
              />
            </View>
          ) : (
            <Button
              title="Attach Photo"
              variant="outline"
              onPress={handleAddPhoto}
            />
          )}

          <View style={{ flex: 1 }} />
          <Button title="Submit" onPress={submit} loading={busy || uploadingPhoto} />
          <Button
            title="Cancel"
            variant="outline"
            onPress={handleCancel}
          />
        </View>
      </Modal>
    </View>
  );
}
