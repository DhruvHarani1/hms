import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  Text,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import { EmptyState } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

const DESKTOP_BREAKPOINT = 900;

export default function WardenStudents() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width >= DESKTOP_BREAKPOINT;

  const { data, isLoading } = useQuery({
    queryKey: ['students', q],
    queryFn: async () =>
      (await api.get('/students', { params: { q: q || undefined } })).data,
  });

  if (isDesktopWeb) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, gap: 12 }}>
        <TextInput
          placeholder="Search by name or email..."
          placeholderTextColor={colors.muted}
          value={q}
          onChangeText={setQ}
          style={{
            backgroundColor: colors.card,
            color: colors.text,
            padding: 12,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            maxWidth: 420,
          }}
        />
        {isLoading ? (
          <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
        ) : (
          <View
            style={{
              backgroundColor: colors.card,
              borderRadius: radius.md,
              borderWidth: 1,
              borderColor: colors.border,
              overflow: 'hidden',
            }}
          >
            <View
              style={{
                flexDirection: 'row',
                paddingVertical: 10,
                paddingHorizontal: 16,
                backgroundColor: colors.bg,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ flex: 2, fontWeight: '700', color: colors.muted, fontSize: 12 }}>NAME</Text>
              <Text style={{ flex: 2, fontWeight: '700', color: colors.muted, fontSize: 12 }}>EMAIL</Text>
              <Text style={{ flex: 1, fontWeight: '700', color: colors.muted, fontSize: 12 }}>ROOM</Text>
              <Text style={{ flex: 1, fontWeight: '700', color: colors.muted, fontSize: 12 }}>ROLL NO</Text>
              <Text style={{ width: 24 }} />
            </View>
            {(data ?? []).length === 0 ? (
              <View style={{ padding: 24 }}>
                <EmptyState
                  emoji="🔍"
                  title={q ? 'No matches' : 'No students yet'}
                  subtitle={q ? 'Try a different search.' : undefined}
                />
              </View>
            ) : (
              (data ?? []).map((item: any) => (
                <Pressable
                  key={item.id}
                  onPress={() =>
                    router.push({
                      pathname: '/(warden)/student-profile',
                      params: { id: item.id, name: item.fullName },
                    })
                  }
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderBottomWidth: 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ flex: 2, color: colors.text, fontWeight: '600' }}>{item.fullName}</Text>
                  <Text style={{ flex: 2, color: colors.muted }}>{item.email}</Text>
                  <Text style={{ flex: 1, color: colors.text }}>
                    {item.studentProfile?.roomNumber ?? '—'}
                  </Text>
                  <Text style={{ flex: 1, color: colors.text }}>
                    {item.studentProfile?.rollNo ?? '—'}
                  </Text>
                  <Text style={{ width: 24, color: colors.muted, textAlign: 'right' }}>›</Text>
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16, gap: 12 }}>
      <TextInput
        placeholder="Search by name or email..."
        placeholderTextColor={colors.muted}
        value={q}
        onChangeText={setQ}
        style={{
          backgroundColor: colors.card,
          color: colors.text,
          padding: 12,
          borderRadius: radius.md,
          borderWidth: 1,
          borderColor: colors.border,
        }}
      />

      {isLoading ? (
        <ActivityIndicator color={colors.primary} style={{ marginTop: 24 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(item: any) => item.id}
          ListEmptyComponent={
            <EmptyState
              emoji="🔍"
              title={q ? 'No matches' : 'No students yet'}
              subtitle={q ? 'Try a different search.' : undefined}
            />
          }
          renderItem={({ item }: { item: any }) => {
            const displayName = item.fullName;
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(warden)/student-profile',
                    params: { id: item.id, name: displayName },
                  })
                }
              >
                <Card
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                  }}
                >
                  <View>
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {displayName}
                    </Text>
                    <Muted>
                      {item.email}
                      {item.studentProfile?.roomNumber
                        ? ` · Room ${item.studentProfile.roomNumber}`
                        : ''}
                    </Muted>
                  </View>
                  <Text style={{ fontSize: 20, color: colors.muted }}>›</Text>
                </Card>
              </Pressable>
            );
          }}
        />
      )}
    </View>
  );
}
