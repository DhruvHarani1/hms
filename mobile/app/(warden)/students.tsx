import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { Card, Muted } from '@/src/components/ui';
import { EmptyState } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';
import { formatStudentName } from '@/src/lib/formatName';

export default function WardenStudents() {
  const router = useRouter();
  const [q, setQ] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['students', q],
    queryFn: async () =>
      (await api.get('/students', { params: { q: q || undefined } })).data,
  });

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
            const displayName = formatStudentName(item);
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
