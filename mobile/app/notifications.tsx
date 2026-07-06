import { FlatList, Pressable, RefreshControl, Text, View } from 'react-native';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { useState } from 'react';
import { api } from '@/src/lib/api';
import { colors, radius } from '@/src/lib/theme';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
} from '@/src/components/primitives';
import {
  registerWebPush,
  webPushSupported,
  webPushGranted,
} from '@/src/notifications/webpush';

const TYPE_EMOJI: Record<string, string> = {
  meal: '🍽️',
  announcement: '📢',
  emergency: '🚨',
  maintenance: '🔧',
  event: '📅',
  complaint: '📝',
  individual: '✉️',
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function NotificationsScreen() {
  const qc = useQueryClient();

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => (await api.get('/notifications')).data,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
  });

  const markAll = useMutation({
    mutationFn: () => api.post('/notifications/read-all'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['inbox'] });
      qc.invalidateQueries({ queryKey: ['unread'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    },
  });

  const hasUnread = (data ?? []).some((r: any) => !r.readAt);

  const [pushBusy, setPushBusy] = useState(false);
  const [pushOn, setPushOn] = useState(() => webPushGranted());
  const showEnable = webPushSupported() && !pushOn;

  async function enablePush() {
    setPushBusy(true);
    const ok = await registerWebPush();
    setPushOn(ok);
    setPushBusy(false);
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: 'Notifications',
          headerRight: () =>
            hasUnread ? (
              <Pressable
                onPress={() => markAll.mutate()}
                style={{ paddingHorizontal: 12 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>
                  Mark all
                </Text>
              </Pressable>
            ) : null,
        }}
      />

      {showEnable ? (
        <Pressable
          onPress={enablePush}
          style={{
            margin: 16,
            marginBottom: 0,
            padding: 14,
            borderRadius: radius.lg,
            backgroundColor: colors.primarySoft,
            borderWidth: 1,
            borderColor: colors.primary,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
          }}
        >
          <Text style={{ fontSize: 22 }}>🔔</Text>
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>
              {pushBusy ? 'Enabling…' : 'Turn on notifications'}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12 }}>
              Get alerts even when the app is closed. On iPhone: add this app to
              your Home Screen first.
            </Text>
          </View>
        </Pressable>
      ) : null}

      {isLoading ? (
        <SkeletonList count={6} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <FlatList
          contentContainerStyle={{ padding: 16, gap: 10, flexGrow: 1 }}
          data={data ?? []}
          keyExtractor={(item: any) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
          }
          ListEmptyComponent={
            <EmptyState
              emoji="🔔"
              title="No notifications yet"
              subtitle="Meal alerts and announcements will show up here."
            />
          }
          renderItem={({ item }: { item: any }) => {
            const n = item.notification;
            const unread = !item.readAt;
            return (
              <Pressable
                onPress={() => unread && markRead.mutate(item.id)}
                style={{
                  backgroundColor: unread ? colors.primarySoft : colors.card,
                  borderRadius: radius.lg,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: unread ? colors.primary : colors.border,
                  flexDirection: 'row',
                  gap: 12,
                }}
              >
                <Text style={{ fontSize: 24 }}>
                  {TYPE_EMOJI[n?.type] ?? '🔔'}
                </Text>
                <View style={{ flex: 1 }}>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '700',
                        color: colors.text,
                        flex: 1,
                      }}
                    >
                      {n?.title}
                    </Text>
                    {unread ? (
                      <View
                        style={{
                          width: 10,
                          height: 10,
                          borderRadius: 5,
                          backgroundColor: colors.primary,
                          marginTop: 4,
                        }}
                      />
                    ) : null}
                  </View>
                  <Text style={{ color: colors.muted, marginTop: 2 }}>
                    {n?.body}
                  </Text>
                  <Text
                    style={{ color: colors.muted, fontSize: 12, marginTop: 6 }}
                  >
                    {n?.createdAt ? timeAgo(n.createdAt) : ''}
                  </Text>
                </View>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
