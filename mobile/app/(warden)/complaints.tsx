import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
  Image,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
  StatusPill,
  Badge,
} from '@/src/components/primitives';
import { colors, priorityColor, radius } from '@/src/lib/theme';
import { SafeAreaView } from 'react-native-safe-area-context';

const NEXT: Record<string, string> = {
  pending: 'in_progress',
  in_progress: 'resolved',
  resolved: 'closed',
};

const STATUSES = ['all', 'pending', 'in_progress', 'resolved', 'closed'] as const;
const PRIORITIES = ['all', 'low', 'medium', 'high', 'urgent'] as const;

export default function WardenComplaints() {
  const qc = useQueryClient();
  const [status, setStatus] = useState<(typeof STATUSES)[number]>('all');
  const [priority, setPriority] = useState<(typeof PRIORITIES)[number]>('all');
  const [assigneeTarget, setAssigneeTarget] = useState<any | null>(null);
  const [resolveTarget, setResolveTarget] = useState<any | null>(null);
  const [resolveNote, setResolveNote] = useState('');
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['complaints', status, priority],
    queryFn: async () =>
      (
        await api.get('/complaints', {
          params: {
            status: status === 'all' ? undefined : status,
            priority: priority === 'all' ? undefined : priority,
          },
        })
      ).data,
  });

  const { data: assignees } = useQuery({
    queryKey: ['complaint-assignees'],
    queryFn: async () => (await api.get('/complaints/assignees')).data,
  });

  async function advance(id: string, currentStatus: string) {
    const next = NEXT[currentStatus];
    if (!next) return;
    if (next === 'resolved') {
      const item = (data ?? []).find((c: any) => c.id === id);
      setResolveTarget(item);
      setResolveNote('');
      return;
    }
    try {
      await api.patch(`/complaints/${id}`, { status: next });
      qc.invalidateQueries({ queryKey: ['complaints'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function confirmResolve() {
    if (!resolveTarget) return;
    setBusy(true);
    try {
      if (resolveNote.trim()) {
        await api.post(`/complaints/${resolveTarget.id}/replies`, {
          message: resolveNote.trim(),
        });
      }
      await api.patch(`/complaints/${resolveTarget.id}`, { status: 'resolved' });
      qc.invalidateQueries({ queryKey: ['complaints'] });
      setResolveTarget(null);
      setResolveNote('');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function assign(userId: string) {
    if (!assigneeTarget) return;
    try {
      await api.patch(`/complaints/${assigneeTarget.id}`, { assignedTo: userId });
      qc.invalidateQueries({ queryKey: ['complaints'] });
      setAssigneeTarget(null);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  function Chips<T extends string>({
    options,
    value,
    onChange,
  }: {
    options: readonly T[];
    value: T;
    onChange: (v: T) => void;
  }) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((o) => (
          <Pressable
            key={o}
            onPress={() => onChange(o)}
            style={{
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 999,
              borderWidth: 1,
              borderColor: value === o ? colors.primary : colors.border,
              backgroundColor: value === o ? colors.primary + '22' : '#fff',
            }}
          >
            <Text style={{ color: value === o ? colors.primary : colors.text, fontSize: 13 }}>
              {o.replace('_', ' ')}
            </Text>
          </Pressable>
        ))}
      </View>
    );
  }

  if (isLoading) return <SkeletonList count={5} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        data={data ?? []}
        keyExtractor={(item: any) => item.id}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
        ListHeaderComponent={
          <View style={{ gap: 10, marginBottom: 4 }}>
            <Muted>Status</Muted>
            <Chips options={STATUSES} value={status} onChange={setStatus} />
            <Muted>Priority</Muted>
            <Chips options={PRIORITIES} value={priority} onChange={setPriority} />
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            emoji="✅"
            title="No complaints"
            subtitle="When students report issues, they'll appear here."
          />
        }
        renderItem={({ item }: { item: any }) => (
          <Card style={{ gap: 6 }}>
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
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <View style={{ flex: 1 }}>
                <Muted>
                  By: {item.student?.fullName} · {item.category?.name ?? 'General'}
                </Muted>
              </View>
              <Badge label={item.priority} color={priorityColor[item.priority] ?? colors.primary} />
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.primary + '11', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 }}>
                <Text style={{ fontSize: 12, color: colors.primary }}>▲</Text>
                <Text style={{ fontWeight: '700', fontSize: 12, color: colors.primary }}>
                  {item.upvoteCount ?? 0}
                </Text>
              </View>
            </View>
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
              onPress={() => setAssigneeTarget(item)}
              style={{
                marginTop: 10,
                paddingVertical: 8,
                paddingHorizontal: 10,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                alignSelf: 'flex-start',
              }}
            >
              <Text style={{ color: colors.text, fontSize: 13 }}>
                {item.assignee ? `👤 Assigned: ${item.assignee.fullName}` : '👤 Assign'}
              </Text>
            </Pressable>

            {NEXT[item.status] ? (
              <Pressable
                onPress={() => advance(item.id, item.status)}
                style={{
                  marginTop: 10,
                  backgroundColor: colors.primary,
                  borderRadius: radius.md,
                  paddingVertical: 10,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>
                  Move to {NEXT[item.status].replace('_', ' ')}
                </Text>
              </Pressable>
            ) : null}
          </Card>
        )}
      />

      {/* Assign modal */}
      <Modal
        visible={!!assigneeTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setAssigneeTarget(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000055',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 16, gap: 8 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>
              Assign to
            </Text>
            {(assignees ?? []).map((a: any) => (
              <Pressable
                key={a.id}
                onPress={() => assign(a.id)}
                style={{
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: radius.sm,
                  backgroundColor:
                    assigneeTarget?.assignee?.id === a.id ? colors.primary + '11' : 'transparent',
                }}
              >
                <Text style={{ color: colors.text }}>
                  {a.fullName} · {a.role}
                </Text>
              </Pressable>
            ))}
            <Button title="Cancel" variant="outline" onPress={() => setAssigneeTarget(null)} />
          </View>
        </View>
      </Modal>

      {/* Resolve with note modal */}
      <Modal
        visible={!!resolveTarget}
        animationType="slide"
        onRequestClose={() => setResolveTarget(null)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
          <H1>Resolve Complaint</H1>
          <Muted>{resolveTarget?.title}</Muted>
          <Field
            label="Resolution note (optional, shown to student)"
            value={resolveNote}
            onChangeText={setResolveNote}
            multiline
            numberOfLines={4}
          />
          <View style={{ flex: 1 }} />
          <Button title="Mark Resolved" onPress={confirmResolve} loading={busy} />
          <Button title="Cancel" variant="outline" onPress={() => setResolveTarget(null)} />
        </SafeAreaView>
      </Modal>
    </View>
  );
}
