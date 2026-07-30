import { useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, H1, Muted } from '@/src/components/ui';
import { ErrorState, SkeletonList } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

type Status = 'pending' | 'approved' | 'rejected';

const STATUS_TABS: { label: string; value: Status }[] = [
  { label: '⏳ Pending', value: 'pending' },
  { label: '✅ Approved', value: 'approved' },
  { label: '❌ Rejected', value: 'rejected' },
];

export default function WardenEditRequests() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState<Status>('pending');

  const qKey = ['warden-edit-requests', activeTab];

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: qKey,
    queryFn: async () =>
      (await api.get('/edit-requests', { params: { status: activeTab } })).data,
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => api.post(`/edit-requests/${id}/approve`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warden-edit-requests'] });
      qc.invalidateQueries({ queryKey: ['edit-requests-count'] });
      Alert.alert('✅ Approved', 'The record has been updated.');
    },
    onError: (e: any) => {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => api.post(`/edit-requests/${id}/reject`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['warden-edit-requests'] });
      qc.invalidateQueries({ queryKey: ['edit-requests-count'] });
      Alert.alert('❌ Rejected', 'The request has been rejected.');
    },
    onError: (e: any) => {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    },
  });

  function confirmAction(id: string, type: 'approve' | 'reject') {
    Alert.alert(
      type === 'approve' ? 'Approve Request?' : 'Reject Request?',
      type === 'approve'
        ? 'The attendance/meal record will be updated immediately.'
        : 'The student\'s record will remain unchanged.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: type === 'approve' ? 'Approve' : 'Reject',
          style: type === 'approve' ? 'default' : 'destructive',
          onPress: () =>
            type === 'approve'
              ? approveMutation.mutate(id)
              : rejectMutation.mutate(id),
        },
      ],
    );
  }

  const isPending = (id: string) =>
    approveMutation.isPending || rejectMutation.isPending;

  return (
    <FlatList
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 40 }}
      refreshControl={
        <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
      }
      ListHeaderComponent={
        <View style={{ gap: 12 }}>
          <H1>Edit Requests</H1>
          <Muted>
            Students can request corrections for past locked days. Review and
            approve or reject them below.
          </Muted>

          {/* Status tabs */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {STATUS_TABS.map((tab) => (
              <Pressable
                key={tab.value}
                onPress={() => setActiveTab(tab.value)}
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  backgroundColor:
                    activeTab === tab.value ? colors.primary : colors.card,
                  borderWidth: 1,
                  borderColor:
                    activeTab === tab.value ? colors.primary : colors.border,
                }}
              >
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '700',
                    color: activeTab === tab.value ? '#fff' : colors.text,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>
            ))}
          </View>

          {isLoading ? (
            <SkeletonList count={3} />
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : (data ?? []).length === 0 ? (
            <Muted style={{ textAlign: 'center', marginTop: 32 }}>
              No {activeTab} requests.
            </Muted>
          ) : null}
        </View>
      }
      data={isLoading || isError ? [] : (data ?? [])}
      keyExtractor={(item: any) => item.id}
      renderItem={({ item }: { item: any }) => (
        <EditRequestCard
          item={item}
          onApprove={() => confirmAction(item.id, 'approve')}
          onReject={() => confirmAction(item.id, 'reject')}
          loading={isPending(item.id)}
          showActions={activeTab === 'pending'}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
    />
  );
}

function EditRequestCard({
  item,
  onApprove,
  onReject,
  loading,
  showActions,
}: {
  item: any;
  onApprove: () => void;
  onReject: () => void;
  loading: boolean;
  showActions: boolean;
}) {
  const changes = item.changes as Record<string, boolean>;
  const statusColor =
    item.status === 'approved'
      ? colors.success
      : item.status === 'rejected'
        ? colors.danger
        : colors.warning ?? '#f59e0b';

  return (
    <Card style={{ gap: 10 }}>
      {/* Student info + date */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: colors.text }}>
            {item.student?.fullName ?? 'Unknown'}
          </Text>
          {item.student?.studentProfile?.rollNo && (
            <Muted>{item.student.studentProfile.rollNo}</Muted>
          )}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: colors.primary }}>
            {item.date}
          </Text>
          {!showActions && (
            <Text style={{ fontSize: 11, fontWeight: '700', color: statusColor }}>
              {item.status.toUpperCase()}
            </Text>
          )}
        </View>
      </View>

      {/* Requested changes */}
      <View style={{ gap: 4 }}>
        <Text style={{ fontWeight: '700', fontSize: 12, color: colors.muted }}>
          REQUESTED CHANGES
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {typeof changes.attendance === 'boolean' && (
            <ChangeBadge
              label="Attendance"
              value={changes.attendance}
              trueText="Present"
              falseText="Absent"
            />
          )}
          {typeof changes.lunch === 'boolean' && (
            <ChangeBadge
              label="Lunch"
              value={changes.lunch}
              trueText="Eating 🍛"
              falseText="Skipping"
            />
          )}
          {typeof changes.dinner === 'boolean' && (
            <ChangeBadge
              label="Dinner"
              value={changes.dinner}
              trueText="Eating 🌙"
              falseText="Skipping"
            />
          )}
        </View>
      </View>

      {/* Reason */}
      <View style={{ gap: 2 }}>
        <Text style={{ fontWeight: '700', fontSize: 12, color: colors.muted }}>REASON</Text>
        <Text style={{ color: colors.text, fontSize: 14 }}>{item.reason}</Text>
      </View>

      {/* Approve / Reject buttons */}
      {showActions && (
        <View style={{ flexDirection: 'row', gap: 8, marginTop: 4 }}>
          <Pressable
            onPress={onApprove}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: colors.success,
              borderRadius: radius.md,
              paddingVertical: 10,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>✅ Approve</Text>
          </Pressable>
          <Pressable
            onPress={onReject}
            disabled={loading}
            style={{
              flex: 1,
              backgroundColor: colors.danger,
              borderRadius: radius.md,
              paddingVertical: 10,
              alignItems: 'center',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>❌ Reject</Text>
          </Pressable>
        </View>
      )}
    </Card>
  );
}

function ChangeBadge({
  label,
  value,
  trueText,
  falseText,
}: {
  label: string;
  value: boolean;
  trueText: string;
  falseText: string;
}) {
  return (
    <View
      style={{
        backgroundColor: value ? colors.success + '20' : colors.danger + '20',
        borderRadius: radius.sm ?? 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderWidth: 1,
        borderColor: value ? colors.success + '60' : colors.danger + '60',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: value ? colors.success : colors.danger }}>
        {label}: {value ? trueText : falseText}
      </Text>
    </View>
  );
}
