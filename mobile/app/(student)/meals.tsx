import { useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View, TextInput } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Card, H1, Muted } from '@/src/components/ui';
import { MonthCalendar, monthKey } from '@/src/components/MonthCalendar';
import { MealDayModal } from '@/src/components/MealDayModal';
import { EditRequestSheet } from '@/src/components/EditRequestSheet';
import { SkeletonList, ErrorState } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

type DayMap = Record<string, { lunch: boolean; dinner: boolean; breakfast: boolean }>;

export default function StudentMeals() {
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(() => new Date());
  const [selected, setSelected] = useState<string | null>(null);
  const [editDay, setEditDay] = useState<string | null>(null);
  const month = monthKey(cursor);
  const qKey = ['meals-month', month];

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: qKey,
    queryFn: async () =>
      (await api.get('/meals/me', { params: { month } })).data,
  });

  const { data: menu } = useQuery({
    queryKey: ['today-menu'],
    queryFn: async () => (await api.get('/meals/menu')).data,
  });

  // Fetch edit requests to show ⏳ badge on past days with pending requests
  const { data: editRequests } = useQuery({
    queryKey: ['my-edit-requests'],
    queryFn: async () => (await api.get('/edit-requests/mine')).data,
  });

  const days: DayMap = data?.days ?? {};
  // Only highlight days where the student is eating lunch or dinner
  const marked = new Set<string>(
    Object.keys(days).filter((k) => days[k].lunch || days[k].dinner)
  );

  const today = new Date().toISOString().slice(0, 10);

  // Build pending set for calendar badges
  const pendingDates = new Set<string>(
    (editRequests ?? [])
      .filter((r: any) => r.status === 'pending')
      .map((r: any) => r.date as string),
  );

  const selState = selected
    ? days[selected] ?? { lunch: false, dinner: false, breakfast: false }
    : { lunch: false, dinner: false, breakfast: false };

  // editDay current values for the EditRequestSheet
  const editDayCurrentValues = editDay
    ? {
        lunch: days[editDay]?.lunch ?? false,
        dinner: days[editDay]?.dinner ?? false,
      }
    : { lunch: false, dinner: false };

  // Reviews logic
  const todayObj = new Date();
  const yesterdayObj = new Date();
  yesterdayObj.setDate(yesterdayObj.getDate() - 1);
  const todayStr = todayObj.toISOString().slice(0, 10);
  const yesterdayStr = yesterdayObj.toISOString().slice(0, 10);

  const { data: myReviews, refetch: refetchMyReviews } = useQuery({
    queryKey: ['my-reviews', todayStr, yesterdayStr],
    queryFn: async () =>
      (
        await api.get('/meals/reviews/me', {
          params: { dates: [todayStr, yesterdayStr] },
        })
      ).data,
  });

  const [activeReviewInput, setActiveReviewInput] = useState<{
    date: string;
    mealType: 'breakfast' | 'lunch' | 'dinner';
    rating: number;
  } | null>(null);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  async function submitReview() {
    if (!activeReviewInput) return;
    setSubmittingReview(true);
    try {
      await api.post('/meals/reviews', {
        date: activeReviewInput.date,
        mealType: activeReviewInput.mealType,
        rating: activeReviewInput.rating,
        comment: reviewComment,
      });
      setActiveReviewInput(null);
      setReviewComment('');
      refetchMyReviews();
      Alert.alert('✅ Thank you!', 'Your review has been submitted.');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Could not submit review.');
    } finally {
      setSubmittingReview(false);
    }
  }

  async function toggleMeal(meal: 'lunch' | 'dinner', next: boolean) {
    if (!selected) return;
    // optimistic
    qc.setQueryData(qKey, (old: any) => {
      const d: DayMap = { ...(old?.days ?? {}) };
      const cur = d[selected] ?? { lunch: false, dinner: false, breakfast: false };
      const updated = { ...cur, [meal]: next };
      updated.breakfast = updated.lunch || updated.dinner;
      if (!updated.lunch && !updated.dinner) delete d[selected];
      else d[selected] = updated;
      return { ...(old ?? {}), days: d, daysAte: Object.keys(d).length };
    });
    try {
      await api.post('/meals/mark', { date: selected, meal, marked: next });
      qc.invalidateQueries({ queryKey: qKey });
      qc.invalidateQueries({ queryKey: ['meal-stats'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      qc.invalidateQueries({ queryKey: qKey });
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function bulk(meal: 'lunch' | 'dinner' | 'both', marked: boolean) {
    try {
      const res = await api.post('/meals/bulk', { month, meal, marked });
      qc.setQueryData(qKey, res.data);
      qc.invalidateQueries({ queryKey: ['meal-stats'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <H1>My Meals</H1>

      <Card style={{ gap: 6 }}>
        <Text style={{ fontWeight: '800', color: colors.text }}>Today's Menu</Text>
        {(['breakfast', 'lunch', 'dinner'] as const).map((m) => {
          const emoji = m === 'breakfast' ? '🍳' : m === 'lunch' ? '🍛' : '🌙';
          const items = menu?.[m] ?? [];
          return (
            <View key={m} style={{ flexDirection: 'row', gap: 6 }}>
              <Text>{emoji}</Text>
              <Text style={{ color: items.length ? colors.text : colors.muted, flex: 1 }}>
                {items.length ? items.join(', ') : 'Not set'}
              </Text>
            </View>
          );
        })}
      </Card>

      {/* Rate Recent Meals Card */}
      {(() => {
        const eligibleMeals: { dateStr: string; label: string; type: 'breakfast' | 'lunch' | 'dinner' }[] = [];
        [
          { dateStr: todayStr, label: 'Today' },
          { dateStr: yesterdayStr, label: 'Yesterday' }
        ].forEach(({ dateStr, label }) => {
          const eaten = days[dateStr];
          if (eaten) {
            (['breakfast', 'lunch', 'dinner'] as const).forEach((m) => {
              if (eaten[m]) {
                eligibleMeals.push({ dateStr, label, type: m });
              }
            });
          }
        });

        if (eligibleMeals.length === 0) return null;

        return (
          <Card style={{ gap: 10 }}>
            <Text style={{ fontWeight: '800', color: colors.text }}>Rate Recent Meals</Text>
            <Muted>Help us improve! Share your rating for meals you ate.</Muted>
            <View style={{ gap: 12, marginTop: 4 }}>
              {eligibleMeals.map(({ dateStr, label, type }) => {
                const emoji = type === 'breakfast' ? '🍳' : type === 'lunch' ? '🍛' : '🌙';
                const mealLabel = type.charAt(0).toUpperCase() + type.slice(1);
                
                // Check if already reviewed
                const existing = myReviews?.find(
                  (r: any) =>
                    r.date.slice(0, 10) === dateStr && r.mealType === type
                );

                const isActiveInput =
                  activeReviewInput?.date === dateStr &&
                  activeReviewInput?.mealType === type;

                return (
                  <View key={`${dateStr}-${type}`} style={{ gap: 6, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: 10 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={{ fontWeight: '700', color: colors.text }}>
                        {emoji} {mealLabel} ({label})
                      </Text>
                      {existing ? (
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#eab308' }}>
                          {'★'.repeat(existing.rating) + '☆'.repeat(5 - existing.rating)}
                        </Text>
                      ) : (
                        <View style={{ flexDirection: 'row', gap: 4 }}>
                          {[1, 2, 3, 4, 5].map((star) => {
                            const currentVal = isActiveInput ? activeReviewInput.rating : 0;
                            return (
                              <Pressable
                                key={star}
                                onPress={() => {
                                  setActiveReviewInput({ date: dateStr, mealType: type, rating: star });
                                }}
                              >
                                <Text style={{ fontSize: 18, color: star <= currentVal ? '#eab308' : colors.muted }}>
                                  {star <= currentVal ? '★' : '☆'}
                                </Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      )}
                    </View>

                    {existing?.comment && (
                      <Text style={{ fontSize: 13, fontStyle: 'italic', color: colors.muted, marginLeft: 6 }}>
                        "{existing.comment}"
                      </Text>
                    )}

                    {isActiveInput && (
                      <View style={{ gap: 8, marginTop: 6, paddingLeft: 6 }}>
                        <TextInput
                          value={reviewComment}
                          onChangeText={setReviewComment}
                          placeholder="Optional: Tell us what you liked or disliked..."
                          maxLength={150}
                          style={{
                            borderWidth: 1,
                            borderColor: colors.border,
                            borderRadius: radius.md,
                            padding: 8,
                            fontSize: 14,
                            backgroundColor: '#fff',
                          }}
                        />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <Pressable
                            onPress={() => {
                              setActiveReviewInput(null);
                              setReviewComment('');
                            }}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: radius.md,
                              borderWidth: 1,
                              borderColor: colors.border,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontWeight: '700', color: colors.text }}>Cancel</Text>
                          </Pressable>
                          <Pressable
                            onPress={submitReview}
                            disabled={submittingReview}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: radius.md,
                              backgroundColor: colors.primary,
                              alignItems: 'center',
                            }}
                          >
                            <Text style={{ fontWeight: '700', color: '#fff' }}>
                              {submittingReview ? 'Submitting...' : 'Submit'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Card>
        );
      })()}

      <Muted>Tap a day to set lunch/dinner. Breakfast turns on automatically.</Muted>

      {isLoading ? (
        <SkeletonList count={2} />
      ) : isError ? (
        <ErrorState onRetry={refetch} />
      ) : (
        <>
          <Card>
            <MonthCalendar
              monthDate={cursor}
              marked={marked}
              pendingDates={pendingDates}
              onDayPress={(dateStr) => {
                if (dateStr < today) {
                  setEditDay(dateStr); // past day → edit request sheet
                } else {
                  setSelected(dateStr); // today/future → normal meal modal
                }
              }}
              onPrev={() => shift(-1)}
              onNext={() => shift(1)}
            />
          </Card>

          {/* Bulk actions */}
          <Card style={{ gap: 8 }}>
            <Text style={{ fontWeight: '700', color: colors.text }}>
              Quick fill this month
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <BulkBtn label="All meals" onPress={() => bulk('both', true)} />
              <BulkBtn label="All lunch" onPress={() => bulk('lunch', true)} />
              <BulkBtn label="All dinner" onPress={() => bulk('dinner', true)} />
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              <BulkBtn label="Clear all" danger onPress={() => bulk('both', false)} />
              <BulkBtn label="Clear lunch" danger onPress={() => bulk('lunch', false)} />
              <BulkBtn label="Clear dinner" danger onPress={() => bulk('dinner', false)} />
            </View>
          </Card>

          <Card style={{ alignItems: 'center', gap: 4 }}>
            <Text style={{ fontSize: 34, fontWeight: '800', color: colors.primary }}>
              {data?.daysAte ?? 0}
              <Text style={{ fontSize: 20, color: colors.muted }}>
                {' '}
                / {data?.daysInMonth ?? 0}
              </Text>
            </Text>
            <Muted>days eaten this month · {data?.percentage ?? 0}%</Muted>
          </Card>
        </>
      )}

      <MealDayModal
        visible={selected !== null}
        dateStr={selected}
        state={selState}
        editable
        onToggle={toggleMeal}
        onClose={() => setSelected(null)}
      />

      {/* Past-day edit request sheet */}
      <EditRequestSheet
        day={editDay}
        currentValues={editDayCurrentValues}
        onClose={() => setEditDay(null)}
        invalidateKeys={[qKey, ['my-edit-requests']]}
      />
    </ScrollView>
  );
}

function BulkBtn({
  label,
  onPress,
  danger,
}: {
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: danger ? colors.danger : colors.primary,
        backgroundColor: danger ? '#fff' : colors.primarySoft,
      }}
    >
      <Text style={{ color: danger ? colors.danger : colors.primary, fontWeight: '700' }}>
        {label}
      </Text>
    </Pressable>
  );
}
