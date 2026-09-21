import { ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, H1, Muted } from '@/src/components/ui';
import { ErrorState, SkeletonList, StatusPill } from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

function TrendBars({
  data,
  valueKey,
  color,
}: {
  data: { date: string; percentage: number }[];
  valueKey: 'percentage';
  color: string;
}) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 100, gap: 4 }}>
      {data.map((d) => (
        <View key={d.date} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View
            style={{
              width: '100%',
              height: Math.max(4, (d[valueKey] / 100) * 80),
              backgroundColor: color,
              borderRadius: 3,
            }}
          />
          <Text style={{ fontSize: 9, color: colors.muted }}>
            {new Date(d.date).getDate()}
          </Text>
        </View>
      ))}
    </View>
  );
}

function HBar({ label, count, max, color }: { label: string; count: number; max: number; color: string }) {
  const pct = max > 0 ? (count / max) * 100 : 0;
  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text style={{ color: colors.text, fontSize: 13 }}>{label}</Text>
        <Text style={{ color: colors.muted, fontSize: 13 }}>{count}</Text>
      </View>
      <View style={{ height: 8, backgroundColor: colors.border, borderRadius: 4 }}>
        <View
          style={{
            width: `${pct}%`,
            height: 8,
            backgroundColor: color,
            borderRadius: 4,
          }}
        />
      </View>
    </View>
  );
}

export default function WardenAnalytics() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-analytics'],
    queryFn: async () => (await api.get('/dashboard/analytics', { params: { days: 14 } })).data,
  });

  if (isLoading) return <SkeletonList count={4} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const maxCategoryCount = Math.max(1, ...(data.complaintsByCategory ?? []).map((c: any) => c.count));

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <H1>Analytics</H1>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>🍽️ Meal attendance (last 14 days)</Text>
        <TrendBars data={data.mealTrend} valueKey="percentage" color={colors.lunch} />
        <Muted>% of students who ate at least one meal that day</Muted>
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>📋 Attendance (last 14 days)</Text>
        <TrendBars data={data.attendanceTrend} valueKey="percentage" color={colors.primary} />
        <Muted>% of students marked present each day</Muted>
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>📝 Complaints by category</Text>
        {(data.complaintsByCategory ?? []).length === 0 ? (
          <Muted>No complaints yet.</Muted>
        ) : (
          data.complaintsByCategory.map((c: any) => (
            <HBar
              key={c.category}
              label={c.category}
              count={c.count}
              max={maxCategoryCount}
              color={colors.primary}
            />
          ))
        )}
      </Card>

      <Card style={{ gap: 10 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>Complaints by status</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(data.complaintsByStatus ?? []).map((s: any) => (
            <View key={s.status} style={{ alignItems: 'center', gap: 4 }}>
              <StatusPill status={s.status} />
              <Text style={{ fontWeight: '800', fontSize: 18, color: colors.text }}>{s.count}</Text>
            </View>
          ))}
        </View>
      </Card>
    </ScrollView>
  );
}
