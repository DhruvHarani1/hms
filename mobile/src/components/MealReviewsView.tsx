import { useState } from 'react';
import { Pressable, ScrollView, Text, View, ActivityIndicator } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, H1, Muted } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

type Role = 'warden' | 'cook';

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function MealReviewsView({ role }: { role: Role }) {
  const [date, setDate] = useState(() => new Date());
  const dateStr = formatDate(date);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['meal-reviews-stats', dateStr],
    queryFn: async () => (await api.get('/meals/reviews/stats', { params: { date: dateStr } })).data,
  });

  function adjustDay(delta: number) {
    setDate((prev) => {
      const next = new Date(prev);
      next.setDate(next.getDate() + delta);
      return next;
    });
  }

  const averages = data?.averages ?? { breakfast: 0, lunch: 0, dinner: 0 };
  const feed = data?.feed ?? [];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      {/* Date selector header */}
      <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12 }}>
        <Pressable onPress={() => adjustDay(-1)} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: colors.primary, fontWeight: '800' }}>◀</Text>
        </Pressable>
        <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
          {date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
        </Text>
        <Pressable onPress={() => adjustDay(1)} style={{ padding: 8 }}>
          <Text style={{ fontSize: 20, color: colors.primary, fontWeight: '800' }}>▶</Text>
        </Pressable>
      </Card>

      {/* Averages Section */}
      <H1>Meal Ratings Summary</H1>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <AverageItem emoji="🍳" label="Breakfast" rating={averages.breakfast} />
        <AverageItem emoji="🍛" label="Lunch" rating={averages.lunch} />
        <AverageItem emoji="🌙" label="Dinner" rating={averages.dinner} />
      </View>

      {/* Feedback Feed Section */}
      <H1>Student Feedback</H1>
      {isLoading ? (
        <View style={{ padding: 40, alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : isError ? (
        <Card style={{ padding: 20, alignItems: 'center' }}>
          <Text style={{ color: colors.danger, fontWeight: '600', marginBottom: 8 }}>Failed to load reviews</Text>
          <Pressable onPress={() => refetch()} style={{ padding: 8, backgroundColor: colors.primarySoft, borderRadius: radius.md }}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Retry</Text>
          </Pressable>
        </Card>
      ) : feed.length === 0 ? (
        <Card style={{ padding: 24, alignItems: 'center' }}>
          <Text style={{ fontSize: 32, marginBottom: 8 }}>🍽️</Text>
          <Muted>No reviews submitted for this date.</Muted>
        </Card>
      ) : (
        <View style={{ gap: 12 }}>
          {feed.map((r: any) => (
            <Card key={r.id} style={{ gap: 8 }}>
              {/* Top row: Meal type, Rating, Time */}
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: colors.primary, paddingHorizontal: 8, paddingVertical: 3, backgroundColor: colors.primarySoft, borderRadius: radius.pill, textTransform: 'capitalize' }}>
                    {r.mealType}
                  </Text>
                  <Text style={{ fontSize: 15, fontWeight: '700', color: '#eab308' }}>
                    {'★'.repeat(r.rating) + '☆'.repeat(5 - r.rating)}
                  </Text>
                </View>
                <Text style={{ fontSize: 12, color: colors.muted }}>
                  {new Date(r.createdAt).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>

              {/* Comment */}
              {r.comment ? (
                <Text style={{ fontSize: 15, color: colors.text, lineHeight: 20 }}>
                  "{r.comment}"
                </Text>
              ) : (
                <Text style={{ fontStyle: 'italic', color: colors.muted }}>No comment written.</Text>
              )}

              {/* Reviewer name (masked for cook) */}
              <View style={{ borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 6, marginTop: 2 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>
                  By: {role === 'cook' ? 'Anonymous Student' : r.studentName}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

function AverageItem({ emoji, label, rating }: { emoji: string; label: string; rating: number }) {
  return (
    <Card style={{ flex: 1, alignItems: 'center', paddingVertical: 12, gap: 4 }}>
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <Text style={{ fontSize: 12, fontWeight: '700', color: colors.muted }}>{label}</Text>
      <Text style={{ fontSize: 18, fontWeight: '800', color: rating > 0 ? '#eab308' : colors.muted }}>
        {rating > 0 ? `★ ${rating}` : '—'}
      </Text>
    </Card>
  );
}
