import { useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
} from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

export default function JoinRequests() {
  const qc = useQueryClient();
  const [rejecting, setRejecting] = useState<any | null>(null);
  const [reason, setReason] = useState('');

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['join-requests'],
    queryFn: async () => (await api.get('/students/requests')).data,
  });

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['join-requests'] });
    qc.invalidateQueries({ queryKey: ['join-requests-count'] });
    qc.invalidateQueries({ queryKey: ['students'] });
  }

  async function approve(id: string, name: string) {
    try {
      await api.patch(`/students/${id}/approve`);
      invalidate();
      Alert.alert('Approved', `${name} can now log in.`);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function confirmReject() {
    if (!rejecting) return;
    try {
      await api.patch(`/students/${rejecting.id}/reject`, {
        reason: reason || undefined,
      });
      invalidate();
      setRejecting(null);
      setReason('');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  if (isLoading) return <SkeletonList count={4} />;
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
        ListEmptyComponent={
          <EmptyState
            emoji="🎉"
            title="No pending requests"
            subtitle="New students who sign up will appear here for approval."
          />
        }
        renderItem={({ item }: { item: any }) => (
          <Card style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>
              {item.fullName}
            </Text>
            <Muted>
              {item.email}
              {item.studentProfile?.rollNo
                ? ` · ${item.studentProfile.rollNo}`
                : ''}
              {item.studentProfile?.roomNumber
                ? ` · Room ${item.studentProfile.roomNumber}`
                : ''}
            </Muted>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <Pressable
                onPress={() => approve(item.id, item.fullName)}
                style={{
                  flex: 1,
                  backgroundColor: colors.success,
                  borderRadius: radius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Approve</Text>
              </Pressable>
              <Pressable
                onPress={() => setRejecting(item)}
                style={{
                  flex: 1,
                  backgroundColor: '#fff',
                  borderWidth: 1,
                  borderColor: colors.danger,
                  borderRadius: radius.md,
                  paddingVertical: 12,
                  alignItems: 'center',
                }}
              >
                <Text style={{ color: colors.danger, fontWeight: '700' }}>
                  Reject
                </Text>
              </Pressable>
            </View>
          </Card>
        )}
      />

      <Modal visible={!!rejecting} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: '#0008',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Card style={{ gap: 12 }}>
            <H1>Reject request</H1>
            <Muted>{rejecting?.fullName} — add an optional reason.</Muted>
            <Field
              label="Reason (optional)"
              value={reason}
              onChangeText={setReason}
              placeholder="e.g. Not a resident of this hostel"
            />
            <Button title="Confirm reject" variant="danger" onPress={confirmReject} />
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => {
                setRejecting(null);
                setReason('');
              }}
            />
          </Card>
        </View>
      </Modal>
    </View>
  );
}
