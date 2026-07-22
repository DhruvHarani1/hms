import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, Muted } from '@/src/components/ui';
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
  const [busy, setBusy] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['join-requests'],
    queryFn: async () => (await api.get('/students/requests')).data,
  });

  async function approve(id: string, fullName: string) {
    setBusy(true);
    try {
      await api.patch(`/students/${id}/approve`);
      qc.invalidateQueries({ queryKey: ['join-requests'] });
      qc.invalidateQueries({ queryKey: ['students'] });
    } catch (e: any) {
      const err = e.response?.data?.message ?? 'Failed to approve request';
      console.warn('Approve error:', err);
    } finally {
      setBusy(false);
    }
  }

  async function reject() {
    if (!rejecting) return;
    setBusy(true);
    try {
      await api.patch(`/students/${rejecting.id}/reject`, {
        reason: reason.trim() || undefined,
      });
      setRejecting(null);
      setReason('');
      qc.invalidateQueries({ queryKey: ['join-requests'] });
    } catch (e: any) {
      const err = e.response?.data?.message ?? 'Failed to reject request';
      console.warn('Reject error:', err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {isLoading ? (
        <SkeletonList count={4} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
          data={data ?? []}
          keyExtractor={(item: any) => item.id}
          ListEmptyComponent={
            <EmptyState
              emoji="🎉"
              title="No pending requests"
              subtitle="New students who sign up will appear here for approval."
            />
          }
          renderItem={({ item }: { item: any }) => {
            const displayName = item.fullName;
            return (
              <Card style={{ gap: 8 }}>
                <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>
                  {displayName}
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
                    onPress={() => approve(item.id, displayName)}
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
                      backgroundColor: colors.danger + '18',
                      borderWidth: 1,
                      borderColor: colors.danger + '40',
                      borderRadius: radius.md,
                      paddingVertical: 12,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: colors.danger, fontWeight: '700' }}>Reject</Text>
                  </Pressable>
                </View>
              </Card>
            );
          }}
        />
      )}

      {/* Reject Modal */}
      <Modal visible={!!rejecting} transparent animationType="fade">
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.6)',
            justifyContent: 'center',
            padding: 24,
          }}
        >
          <Card style={{ gap: 14 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              Reject request
            </Text>
            <Muted>{rejecting?.fullName} — add an optional reason.</Muted>
            <Field
              label="Reason (optional)"
              placeholder="e.g. Incorrect room assignment"
              value={reason}
              onChangeText={setReason}
            />
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
              <Button
                variant="outline"
                title="Cancel"
                onPress={() => {
                  setRejecting(null);
                  setReason('');
                }}
              />
              <Button title="Confirm Reject" variant="danger" loading={busy} onPress={reject} />
            </View>
          </Card>
        </View>
      </Modal>
    </View>
  );
}
