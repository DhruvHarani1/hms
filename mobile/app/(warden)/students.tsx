import { useState } from 'react';
import { FlatList, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, Field, Muted } from '@/src/components/ui';
import {
  EmptyState,
  ErrorState,
  SkeletonList,
} from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

export default function WardenStudents() {
  const [q, setQ] = useState('');
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['students', q],
    queryFn: async () =>
      (await api.get('/students', { params: q ? { q } : {} })).data,
  });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16 }}>
        <Field
          placeholder="Search students…"
          value={q}
          onChangeText={setQ}
          autoCapitalize="none"
        />
      </View>
      {isLoading ? (
        <SkeletonList count={5} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
      <FlatList
        contentContainerStyle={{ padding: 16, paddingTop: 0, gap: 10, flexGrow: 1 }}
        data={data ?? []}
        keyExtractor={(item: any) => item.id}
        ListEmptyComponent={
          <EmptyState
            emoji="🔍"
            title={q ? 'No matches' : 'No students yet'}
            subtitle={q ? 'Try a different search.' : undefined}
          />
        }
        renderItem={({ item }: { item: any }) => (
          <Card>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              {item.fullName}
            </Text>
            <Muted>
              {item.email}
              {item.studentProfile?.roomNumber
                ? ` · Room ${item.studentProfile.roomNumber}`
                : ''}
            </Muted>
          </Card>
        )}
      />
      )}
    </View>
  );
}
