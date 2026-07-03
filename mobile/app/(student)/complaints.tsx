import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View, Modal } from 'react-native';
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

export default function StudentComplaints() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

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

  async function submit() {
    if (!title || !description) {
      Alert.alert('Missing', 'Add a title and description.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/complaints', { title, description, categoryId });
      setTitle('');
      setDescription('');
      setCategoryId(undefined);
      setOpen(false);
      qc.invalidateQueries({ queryKey: ['my-complaints'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        data={complaints ?? []}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={
          <Button title="+ New complaint" onPress={() => setOpen(true)} />
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
          <View style={{ flex: 1 }} />
          <Button title="Submit" onPress={submit} loading={busy} />
          <Button
            title="Cancel"
            variant="outline"
            onPress={() => setOpen(false)}
          />
        </View>
      </Modal>
    </View>
  );
}
