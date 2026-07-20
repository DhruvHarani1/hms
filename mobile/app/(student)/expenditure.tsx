import React, { useState } from 'react';
import {
  Alert,
  ScrollView,
  Text,
  TextInput,
  View,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';
import { useRouter } from 'expo-router';

export default function ExpenditureScreen() {
  const router = useRouter();
  const qc = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [newLimitStr, setNewLimitStr] = useState('');
  const [updating, setUpdating] = useState(false);

  // Queries
  const { data: budget, isLoading, refetch } = useQuery({
    queryKey: ['student-budget'],
    queryFn: async () => (await api.get('/expenses/budget')).data,
  });

  async function handleUpdateBudget() {
    const limitVal = parseFloat(newLimitStr);
    if (isNaN(limitVal) || limitVal < 0) {
      return Alert.alert('Error', 'Please enter a valid monthly budget limit.');
    }

    setUpdating(true);
    try {
      await api.post('/expenses/budget', { monthlyLimit: limitVal });
      Alert.alert('Success', 'Monthly budget limit updated!');
      setEditMode(false);
      qc.invalidateQueries({ queryKey: ['student-budget'] });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not update budget.');
    } finally {
      setUpdating(false);
    }
  }

  if (isLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  const limit = budget?.monthlyLimit ?? 5000;
  const spent = budget?.totalSpent ?? 0;
  const percent = budget?.percentSpent ?? 0;
  const remaining = Math.max(0, limit - spent);

  // Get color for progress bar
  let progressColor = '#10b981'; // Green
  if (percent >= 90) {
    progressColor = '#ef4444'; // Red
  } else if (percent >= 75) {
    progressColor = '#f59e0b'; // Amber
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {/* Custom Header with Back Button */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 12,
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable onPress={() => router.back()} style={{ paddingRight: 16 }}>
          <Text style={{ fontSize: 22, color: colors.primary }}>←</Text>
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text }}>
          Budget & Spending
        </Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        {/* Monthly Budget Summary */}
        <Card style={{ gap: 12 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Muted>MONTHLY LIMIT</Muted>
              {editMode ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <TextInput
                    keyboardType="numeric"
                    value={newLimitStr}
                    onChangeText={setNewLimitStr}
                    placeholder={String(limit)}
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 8,
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      fontSize: 18,
                      fontWeight: '800',
                      backgroundColor: '#fff',
                      width: 120,
                      color: colors.text,
                    }}
                  />
                  <Button
                    title={updating ? '...' : 'Save'}
                    onPress={handleUpdateBudget}
                    disabled={updating}
                  />
                  <Pressable onPress={() => setEditMode(false)} style={{ padding: 4 }}>
                    <Text style={{ color: colors.muted }}>Cancel</Text>
                  </Pressable>
                </View>
              ) : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text }}>
                    ₹{limit.toFixed(2)}
                  </Text>
                  <Pressable
                    onPress={() => {
                      setNewLimitStr(String(limit));
                      setEditMode(true);
                    }}
                    style={{
                      backgroundColor: colors.primary + '11',
                      padding: 6,
                      borderRadius: 6,
                    }}
                  >
                    <Text style={{ fontSize: 12, color: colors.primary, fontWeight: '700' }}>
                      Edit ✏️
                    </Text>
                  </Pressable>
                </View>
              )}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Muted>SPENT SO FAR</Muted>
              <Text style={{ fontSize: 26, fontWeight: '800', color: progressColor }}>
                ₹{spent.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* Progress Bar */}
          <View style={{ gap: 6, marginTop: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colors.text }}>
                {percent}% Used
              </Text>
              <Text style={{ fontWeight: '700', fontSize: 13, color: colors.muted }}>
                ₹{remaining.toFixed(2)} Left
              </Text>
            </View>
            <View
              style={{
                height: 12,
                backgroundColor: colors.border,
                borderRadius: 6,
                overflow: 'hidden',
              }}
            >
              <View
                style={{
                  width: `${Math.min(100, percent)}%`,
                  height: '100%',
                  backgroundColor: progressColor,
                  borderRadius: 6,
                }}
              />
            </View>
          </View>
        </Card>

        {/* Breakdown Breakdown */}
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text, marginTop: 8 }}>
          Spend Breakdown (This Month)
        </Text>

        <Card style={{ gap: 14 }}>
          {/* Paid Expenses */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>
                💸 Out-of-Pocket Expenses
              </Text>
              <Muted style={{ fontSize: 12 }}>
                Total bills paid directly by you
              </Muted>
            </View>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
              + ₹{(budget?.breakdown?.paidExpenses ?? 0).toFixed(2)}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border }} />

          {/* Share what others owe you */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>
                ⚖️ Shared Shares (To Reimburse)
              </Text>
              <Muted style={{ fontSize: 12 }}>
                Owed back to you by split participants
              </Muted>
            </View>
            <Text style={{ fontWeight: '800', fontSize: 16, color: '#10b981' }}>
              - ₹{(budget?.breakdown?.othersOwedToYou ?? 0).toFixed(2)}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border }} />

          {/* Settled splits you paid to others */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View style={{ gap: 2 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>
                🤝 Settled Split Debts
              </Text>
              <Muted style={{ fontSize: 12 }}>
                Paid to other roommates (Settled)
              </Muted>
            </View>
            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
              + ₹{(budget?.breakdown?.settledSplitsYouPaid ?? 0).toFixed(2)}
            </Text>
          </View>

          <View style={{ height: 1, backgroundColor: colors.border }} />

          {/* Net sum verification */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: colors.bg,
              padding: 10,
              borderRadius: 8,
            }}
          >
            <Text style={{ fontWeight: '800', fontSize: 13, color: colors.text }}>
              Net Spent Formula:
            </Text>
            <Text style={{ fontFamily: 'monospace', fontSize: 12, color: colors.text }}>
              ₹{spent.toFixed(2)}
            </Text>
          </View>
        </Card>

        {/* Guidelines / Tips Card */}
        <Card style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', gap: 6 }}>
          <Text style={{ fontWeight: '700', color: '#1e40af', fontSize: 14 }}>
            💡 Smart Budgeting Tips
          </Text>
          <Text style={{ fontSize: 12, color: '#1e40af', lineHeight: 16 }}>
            • Net Spent only includes splits that are fully **SETTLED** by your peers. Unpaid splits keep your net spent lower until they are cleared.
          </Text>
          <Text style={{ fontSize: 12, color: '#1e40af', lineHeight: 16 }}>
            • Splitting expenses reduces your overall net spent. Log dinner splits regularly to keep roommate accounts transparent!
          </Text>
        </Card>
      </ScrollView>
    </View>
  );
}