import { useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { API_URL } from '@/src/lib/config';
import { Button, Card, Muted } from '@/src/components/ui';
import { EmptyState, ErrorState, SkeletonList } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

export default function AttendanceStudents() {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [exporting, setExporting] = useState(false);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-attendance-students', q],
    queryFn: async () => (await api.get('/students', { params: { q: q || undefined } })).data,
  });

  async function handleExportExcel() {
    setExporting(true);
    try {
      const res = await api.post('/attendance/export-link');
      const token = res.data.token;
      const downloadUrl = `${API_URL}/attendance/export?token=${token}`;
      await Linking.openURL(downloadUrl);
    } catch (e: any) {
      Alert.alert('Export Failed', e?.response?.data?.message ?? 'Could not export Excel file.');
    } finally {
      setExporting(false);
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ padding: 16, gap: 10 }}>
        <Button
          title={exporting ? 'Generating Excel...' : '📊  Export Attendance Excel (.xlsx)'}
          onPress={handleExportExcel}
          disabled={exporting}
          variant="outline"
        />

        <TextInput
          placeholder="Search student..."
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
          ListEmptyComponent={<EmptyState emoji="📋" title="No students" />}
          renderItem={({ item }: { item: any }) => {
            const displayName = item.fullName;
            return (
              <Pressable
                onPress={() =>
                  router.push({
                    pathname: '/(warden)/student-attendance',
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
                      {item.studentProfile?.roomNumber
                        ? `Room ${item.studentProfile.roomNumber}`
                        : item.email}
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
