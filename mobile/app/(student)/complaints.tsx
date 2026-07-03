import { useState } from 'react';
import { Alert, FlatList, Pressable, Text, View, Modal } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

const STATUS_COLOR: Record<string, string> = {
  pending: colors.warning,
  in_progress: colors.primary,
  resolved: colors.success,
  closed: colors.muted,
};

export default function StudentComplaints() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const { data: complaints } = useQuery({
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
        contentContainerStyle={{ padding: 16, gap: 12 }}
        data={complaints ?? []}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={
          <Button title="+ New complaint" onPress={() => setOpen(true)} />
        }
        ListEmptyComponent={<Muted>You have no complaints.</Muted>}
        renderItem={({ item }: { item: any }) => (
          <Card>
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
              <Text
                style={{
                  color: STATUS_COLOR[item.status],
                  fontWeight: '700',
                  fontSize: 12,
                }}
              >
                {item.status.replace('_', ' ')}
              </Text>
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
