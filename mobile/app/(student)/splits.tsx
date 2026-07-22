import React, { useState, useMemo, useCallback } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  Image,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';
import { pickAndUpload } from '@/src/lib/upload';
import { formatStudentName } from '@/src/lib/formatName';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function SplitsScreen() {
  const router = useRouter();
  const { user: currentUser } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState<'balances' | 'history'>('balances');
  const [modalOpen, setModalOpen] = useState(false);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (modalOpen) {
          setModalOpen(false);
          return true;
        }
        router.replace('/(student)');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [modalOpen, router])
  );

  // Form State
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [splitType, setSplitType] = useState<'EQUAL' | 'PERCENTAGE' | 'CUSTOM'>('EQUAL');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [customAmounts, setCustomAmounts] = useState<Record<string, string>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Queries
  const { data: balances, isLoading: loadingBalances, refetch: refetchBalances } = useQuery({
    queryKey: ['expense-balances'],
    queryFn: async () => (await api.get('/expenses/balances')).data,
  });

  const { data: expenses, isLoading: loadingExpenses, refetch: refetchExpenses } = useQuery({
    queryKey: ['expenses-list'],
    queryFn: async () => (await api.get('/expenses')).data,
  });

  const { data: members } = useQuery({
    queryKey: ['hostel-members'],
    queryFn: async () => (await api.get('/expenses/members')).data,
  });

  const totalOwedToYou = useMemo(() => {
    if (!balances) return 0;
    return balances
      .filter((b: any) => b.netAmount > 0)
      .reduce((sum: number, b: any) => sum + b.netAmount, 0);
  }, [balances]);

  const totalYouOwe = useMemo(() => {
    if (!balances) return 0;
    return Math.abs(
      balances
        .filter((b: any) => b.netAmount < 0)
        .reduce((sum: number, b: any) => sum + b.netAmount, 0)
    );
  }, [balances]);

  // Filtering members for split creation
  const filteredMembers = useMemo(() => {
    if (!members) return [];
    return members.filter((m: any) =>
      m.fullName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [members, searchQuery]);

  // Handle Receipt Upload
  async function handleAddReceipt() {
    setUploadingReceipt(true);
    try {
      const key = await pickAndUpload('photo');
      if (key) {
        setReceiptUrl(key);
      }
    } catch (e: any) {
      Alert.alert('Upload Failed', e?.message ?? 'Could not upload receipt.');
    } finally {
      setUploadingReceipt(false);
    }
  }

  // Handle Settlement Verification
  async function handleVerifySettlement(splitId: string, action: 'approve' | 'decline') {
    try {
      await api.post(`/expenses/splits/${splitId}/verify-settle`, { action });
      Alert.alert('Success', `Settlement ${action === 'approve' ? 'approved' : 'declined'}.`);
      qc.invalidateQueries({ queryKey: ['expense-balances'] });
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Action failed.');
    }
  }

  // Handle Request Settlement
  async function handleRequestSettle(splitId: string) {
    try {
      await api.post(`/expenses/splits/${splitId}/request-settle`);
      Alert.alert('Settlement Requested', 'Waiting for creditor confirmation.');
      qc.invalidateQueries({ queryKey: ['expense-balances'] });
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Failed to request settlement.');
    }
  }

  // Form calculations & validation
  const calculatedShares = useMemo(() => {
    const totalAmount = parseFloat(amountStr) || 0;
    const participantsCount = selectedMembers.length + 1; // Include current user
    const shares: Record<string, number> = {};

    if (totalAmount <= 0) return shares;

    if (splitType === 'EQUAL') {
      const equalShare = Number((totalAmount / participantsCount).toFixed(2));
      shares[currentUser?.id || ''] = equalShare;
      selectedMembers.forEach((id) => {
        shares[id] = equalShare;
      });
    } else if (splitType === 'PERCENTAGE') {
      // Current user percentage
      const myPct = parseFloat(customAmounts[currentUser?.id || '']) || 0;
      shares[currentUser?.id || ''] = Number((totalAmount * (myPct / 100)).toFixed(2));

      selectedMembers.forEach((id) => {
        const pct = parseFloat(customAmounts[id]) || 0;
        shares[id] = Number((totalAmount * (pct / 100)).toFixed(2));
      });
    } else {
      // CUSTOM
      shares[currentUser?.id || ''] = parseFloat(customAmounts[currentUser?.id || '']) || 0;
      selectedMembers.forEach((id) => {
        shares[id] = parseFloat(customAmounts[id]) || 0;
      });
    }

    return shares;
  }, [amountStr, splitType, selectedMembers, customAmounts, currentUser]);

  async function handleCreateSplit() {
    const totalAmount = parseFloat(amountStr);
    if (!title) return Alert.alert('Error', 'Please enter a title.');
    if (isNaN(totalAmount) || totalAmount <= 0) return Alert.alert('Error', 'Please enter a valid amount.');

    // Calculate sum of shares
    const sumOfShares = Object.values(calculatedShares).reduce((a, b) => a + b, 0);
    const diff = Math.abs(totalAmount - sumOfShares);
    if (diff > 1.5) {
      return Alert.alert(
        'Check Split Sum',
        `Split shares sum up to ₹${sumOfShares.toFixed(2)}, which does not match total amount ₹${totalAmount.toFixed(2)}.`
      );
    }

    setSubmitting(false);

    // Build participants DTO (send empty array if personal expense)
    const participantsDto = selectedMembers.length === 0
      ? []
      : [
          {
            userId: currentUser?.id || '',
            amount: splitType === 'EQUAL' ? undefined : parseFloat(customAmounts[currentUser?.id || '']) || 0,
          },
          ...selectedMembers.map((id) => ({
            userId: id,
            amount: splitType === 'EQUAL' ? undefined : parseFloat(customAmounts[id]) || 0,
          })),
        ];

    setSubmitting(true);
    try {
      await api.post('/expenses', {
        title,
        amount: totalAmount,
        splitType,
        receiptUrl,
        participants: participantsDto,
      });

      Alert.alert('Success', 'Expense split created!');
      setTitle('');
      setAmountStr('');
      setSplitType('EQUAL');
      setSelectedMembers([]);
      setCustomAmounts({});
      setReceiptUrl(null);
      setModalOpen(false);
      
      qc.invalidateQueries({ queryKey: ['expense-balances'] });
      qc.invalidateQueries({ queryKey: ['expenses-list'] });
      qc.invalidateQueries({ queryKey: ['student-dashboard'] });
    } catch (e: any) {
      Alert.alert('Error', e?.response?.data?.message ?? 'Could not create expense split.');
    } finally {
      setSubmitting(false);
    }
  }

  function toggleMemberSelection(id: string) {
    setSelectedMembers((prev) =>
      prev.includes(id) ? prev.filter((mid) => mid !== id) : [...prev, id]
    );
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
          Bills & Splits
        </Text>
      </View>

      {/* Tabs */}
      <View
        style={{
          flexDirection: 'row',
          backgroundColor: '#fff',
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Pressable
          onPress={() => setActiveTab('balances')}
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: 'center',
            borderBottomWidth: 2,
            borderBottomColor: activeTab === 'balances' ? colors.primary : 'transparent',
          }}
        >
          <Text
            style={{
              fontWeight: '700',
              color: activeTab === 'balances' ? colors.primary : colors.muted,
            }}
          >
            Balances
          </Text>
        </Pressable>
        <Pressable
          onPress={() => setActiveTab('history')}
          style={{
            flex: 1,
            paddingVertical: 14,
            alignItems: 'center',
            borderBottomWidth: 2,
            borderBottomColor: activeTab === 'history' ? colors.primary : 'transparent',
          }}
        >
          <Text
            style={{
              fontWeight: '700',
              color: activeTab === 'history' ? colors.primary : colors.muted,
            }}
          >
            Expenses Log
          </Text>
        </Pressable>
      </View>

      {activeTab === 'balances' ? (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
          {/* Balance Cards Summary */}
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Card style={{ flex: 1, backgroundColor: '#eefcf5', borderColor: '#c4f0d5' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#137333' }}>
                ₹{totalOwedToYou.toFixed(2)}
              </Text>
              <Muted style={{ color: '#137333', opacity: 0.8 }}>Owed to you</Muted>
            </Card>
            <Card style={{ flex: 1, backgroundColor: '#fdf2f2', borderColor: '#f8d7da' }}>
              <Text style={{ fontSize: 24, fontWeight: '800', color: '#c53030' }}>
                ₹{totalYouOwe.toFixed(2)}
              </Text>
              <Muted style={{ color: '#c53030', opacity: 0.8 }}>You owe</Muted>
            </Card>
          </View>

          {/* Pending Incoming Approvals */}
          {balances &&
            balances.some((b: any) => b.pendingApprovals?.length > 0) && (
              <View style={{ gap: 8 }}>
                <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
                  🔔 Settlement Approvals
                </Text>
                {balances.flatMap((b: any) =>
                  (b.pendingApprovals || []).map((p: any) => (
                    <Card
                      key={p.splitId}
                      style={{
                        backgroundColor: '#fffbeb',
                        borderColor: '#fde68a',
                        gap: 10,
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                        <View style={{ flex: 1, marginRight: 8 }}>
                          <Text style={{ fontWeight: '700', color: colors.text }}>
                            {formatStudentName(b.user)} claims to have paid
                          </Text>
                          <Muted>For "{p.title}"</Muted>
                        </View>
                        <Text style={{ fontSize: 16, fontWeight: '800', color: '#b45309' }}>
                          ₹{p.amount.toFixed(2)}
                        </Text>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <Pressable
                          onPress={() => handleVerifySettlement(p.splitId, 'approve')}
                          style={{
                            flex: 1,
                            backgroundColor: '#10b981',
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                            Confirm Payment
                          </Text>
                        </Pressable>
                        <Pressable
                          onPress={() => handleVerifySettlement(p.splitId, 'decline')}
                          style={{
                            flex: 1,
                            backgroundColor: '#ef4444',
                            paddingVertical: 8,
                            borderRadius: 8,
                            alignItems: 'center',
                          }}
                        >
                          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 13 }}>
                            Decline
                          </Text>
                        </Pressable>
                      </View>
                    </Card>
                  ))
                )}
              </View>
            )}

          {/* Peer Net Balances Sheet */}
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              Net Balance Sheet
            </Text>
            {loadingBalances ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : !balances || balances.length === 0 ? (
              <Card style={{ alignItems: 'center', padding: 24 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>💸</Text>
                <Text style={{ fontWeight: '700', color: colors.text }}>All settled up!</Text>
                <Muted>No outstanding balances in your group.</Muted>
              </Card>
            ) : (
              balances.map((b: any) => (
                <Card
                  key={b.user.id}
                  style={{
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingVertical: 12,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '700', color: colors.text }}>
                      {formatStudentName(b.user)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        textTransform: 'capitalize',
                        color: colors.muted,
                      }}
                    >
                      {b.user.role}
                    </Text>
                  </View>

                  <View style={{ alignItems: 'flex-end', gap: 4 }}>
                    <Text
                      style={{
                        fontWeight: '800',
                        fontSize: 16,
                        color: b.netAmount > 0 ? '#10b981' : '#ef4444',
                      }}
                    >
                      {b.netAmount > 0 ? `owes you ₹${b.netAmount.toFixed(2)}` : `you owe ₹${Math.abs(b.netAmount).toFixed(2)}`}
                    </Text>
                    {b.netAmount < 0 && (
                      <Muted style={{ fontSize: 11 }}>
                        Settle splits via the Log tab below
                      </Muted>
                    )}
                  </View>
                </Card>
              ))
            )}
          </View>
        </ScrollView>
      ) : (
        /* Expenses History Log */
        <FlatList
          data={expenses ?? []}
          keyExtractor={(item: any) => item.id}
          contentContainerStyle={{ padding: 16, gap: 12 }}
          refreshing={loadingExpenses}
          onRefresh={refetchExpenses}
          ListEmptyComponent={
            loadingExpenses ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} />
            ) : (
              <Card style={{ alignItems: 'center', padding: 24 }}>
                <Text style={{ fontSize: 40, marginBottom: 8 }}>📜</Text>
                <Text style={{ fontWeight: '700', color: colors.text }}>No logs found</Text>
                <Muted>Tap + Add Split to log your first hostel expense.</Muted>
              </Card>
            )
          }
          renderItem={({ item }: { item: any }) => {
            const isPayer = item.payerId === currentUser?.id;
            const mySplit = item.splits.find((s: any) => s.userId === currentUser?.id);

            return (
              <Card style={{ gap: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
                      {item.title}
                    </Text>
                    <Muted style={{ fontSize: 12 }}>
                      Paid by {isPayer ? 'You' : formatStudentName(item.payer)} •{' '}
                      {new Date(item.createdAt).toLocaleDateString()}
                    </Muted>
                  </View>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
                    ₹{item.amount.toFixed(2)}
                  </Text>
                </View>

                {/* Split breakdown */}
                <View
                  style={{
                    backgroundColor: colors.bg,
                    borderRadius: 8,
                    padding: 8,
                    gap: 4,
                  }}
                >
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.muted }}>
                    SPLIT BREAKDOWN:
                  </Text>
                  {item.splits.map((s: any) => (
                    <View
                      key={s.id}
                      style={{
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Text style={{ fontSize: 12, color: colors.text }}>
                        • {formatStudentName(s.user)}
                      </Text>
                      <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>
                          ₹{s.amount.toFixed(2)}
                        </Text>
                        <Text
                          style={{
                            fontSize: 10,
                            fontWeight: '700',
                            color:
                              s.status === 'SETTLED'
                                ? '#10b981'
                                : s.status === 'PENDING'
                                  ? '#fbbf24'
                                  : '#ef4444',
                          }}
                        >
                          ({s.status})
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>

                {/* Settle Up Action for Debtor */}
                {!isPayer && mySplit && mySplit.status === 'UNPAID' && (
                  <Button
                    title={`Settle Up ₹${mySplit.amount.toFixed(2)}`}
                    onPress={() => handleRequestSettle(mySplit.id)}
                    variant="outline"
                  />
                )}

                {!isPayer && mySplit && mySplit.status === 'PENDING' && (
                  <View
                    style={{
                      borderWidth: 1,
                      borderColor: '#fbbf24',
                      backgroundColor: '#fffbeb',
                      padding: 8,
                      borderRadius: 8,
                      alignItems: 'center',
                    }}
                  >
                    <Text style={{ color: '#b45309', fontWeight: '700', fontSize: 12 }}>
                      ⏳ Settle Request Sent. Waiting for approval.
                    </Text>
                  </View>
                )}

                {/* Attached Receipt URL */}
                {item.receiptUrl && (
                  <View style={{ marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: colors.muted, marginBottom: 4 }}>
                      Receipt:
                    </Text>
                    <Image
                      source={{ uri: item.receiptUrl }}
                      style={{
                        width: '100%',
                        height: 150,
                        borderRadius: 8,
                        backgroundColor: '#eee',
                      }}
                      resizeMode="contain"
                    />
                  </View>
                )}
              </Card>
            );
          }}
        />
      )}

      {/* Add Split Floating Button */}
      <Pressable
        onPress={() => setModalOpen(true)}
        style={{
          position: 'absolute',
          right: 20,
          bottom: 20,
          backgroundColor: colors.primary,
          width: 56,
          height: 56,
          borderRadius: 28,
          alignItems: 'center',
          justifyContent: 'center',
          elevation: 5,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.25,
          shadowRadius: 3.84,
        }}
      >
        <Text style={{ color: '#fff', fontSize: 24, fontWeight: 'bold' }}>+</Text>
      </Pressable>

      {/* Add Split Modal */}
      <Modal
        visible={modalOpen}
        animationType="slide"
        onRequestClose={() => setModalOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
          {/* Modal Header */}
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: 16,
              backgroundColor: '#fff',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              {selectedMembers.length === 0 ? 'Add Personal Expense' : 'Add Shared Expense'}
            </Text>
            <Pressable onPress={() => setModalOpen(false)}>
              <Text style={{ fontSize: 16, color: colors.primary, fontWeight: '700' }}>Cancel</Text>
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 14 }}>
            <Field label="Description / Title" value={title} onChangeText={setTitle} placeholder="e.g. Dinner, Room Groceries" />
            <Field label="Total Amount (₹)" value={amountStr} onChangeText={setAmountStr} keyboardType="numeric" placeholder="0.00" />

            {/* Split Type Selector */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: '700', color: colors.muted }}>Split Formula</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                {(['EQUAL', 'PERCENTAGE', 'CUSTOM'] as const).map((type) => (
                  <Pressable
                    key={type}
                    onPress={() => {
                      setSplitType(type);
                      setCustomAmounts({});
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      alignItems: 'center',
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: splitType === type ? colors.primary : colors.border,
                      backgroundColor: splitType === type ? colors.primary + '11' : '#fff',
                    }}
                  >
                    <Text
                      style={{
                        fontWeight: '700',
                        fontSize: 12,
                        color: splitType === type ? colors.primary : colors.muted,
                      }}
                    >
                      {type}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            {/* Receipt upload */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: '700', color: colors.muted }}>Attach Receipt (Optional)</Text>
              {receiptUrl ? (
                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 12, color: '#10b981', fontWeight: '700' }}>
                    ✓ Receipt Attached successfully
                  </Text>
                  <Button
                    title="Remove Receipt"
                    onPress={() => setReceiptUrl(null)}
                    variant="danger"
                  />
                </View>
              ) : (
                <Button
                  title={uploadingReceipt ? 'Uploading...' : '📸 Camera / Gallery'}
                  onPress={handleAddReceipt}
                  variant="outline"
                  disabled={uploadingReceipt}
                />
              )}
            </View>

            {/* Participant selector */}
            <View style={{ gap: 6 }}>
              <Text style={{ fontWeight: '700', color: colors.muted }}>Select Members to Split With</Text>
              <TextInput
                placeholder="Search roommate or warden..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                style={{
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  padding: 10,
                  backgroundColor: '#fff',
                  fontSize: 14,
                }}
              />

              <View
                style={{
                  maxHeight: 220,
                  borderWidth: 1,
                  borderColor: colors.border,
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  overflow: 'hidden',
                }}
              >
                <ScrollView nestedScrollEnabled style={{ padding: 6 }}>
                  {filteredMembers.map((m: any) => {
                    const isSelected = selectedMembers.includes(m.id);
                    return (
                      <View key={m.id} style={{ gap: 4 }}>
                        <Pressable
                          onPress={() => toggleMemberSelection(m.id)}
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            paddingVertical: 10,
                            paddingHorizontal: 8,
                            backgroundColor: isSelected ? colors.primary + '11' : 'transparent',
                            borderRadius: 6,
                          }}
                        >
                          <View>
                            <Text style={{ fontWeight: '600', color: colors.text }}>
                              {formatStudentName(m)}
                            </Text>
                            <Text
                              style={{
                                fontSize: 11,
                                color: colors.muted,
                                textTransform: 'capitalize',
                              }}
                            >
                              {m.role}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 18 }}>{isSelected ? '✅' : '⬜'}</Text>
                        </Pressable>

                        {/* Input custom or percentage amount if selected */}
                        {isSelected && splitType !== 'EQUAL' && (
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              paddingHorizontal: 12,
                              paddingBottom: 8,
                              gap: 8,
                            }}
                          >
                            <Text style={{ fontSize: 13, color: colors.text }}>
                              {splitType === 'PERCENTAGE' ? 'Share percentage (%):' : 'Custom share (₹):'}
                            </Text>
                            <TextInput
                              keyboardType="numeric"
                              value={customAmounts[m.id] || ''}
                              onChangeText={(val) =>
                                setCustomAmounts((prev) => ({ ...prev, [m.id]: val }))
                              }
                              placeholder="0"
                              style={{
                                borderWidth: 1,
                                borderColor: colors.border,
                                borderRadius: 6,
                                paddingVertical: 4,
                                paddingHorizontal: 8,
                                flex: 1,
                                backgroundColor: '#fff',
                              }}
                            />
                          </View>
                        )}
                      </View>
                    );
                  })}
                </ScrollView>
              </View>
            </View>

            {/* Current user custom split input */}
            {splitType !== 'EQUAL' && (
              <Card style={{ backgroundColor: '#f8fafc', padding: 12 }}>
                <Text style={{ fontWeight: '700', color: colors.text, marginBottom: 8 }}>
                  Your Share ({currentUser?.fullName?.split(' ')[0]})
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13, color: colors.text }}>
                    {splitType === 'PERCENTAGE' ? 'Your percentage (%):' : 'Your custom share (₹):'}
                  </Text>
                  <TextInput
                    keyboardType="numeric"
                    value={customAmounts[currentUser?.id || ''] || ''}
                    onChangeText={(val) =>
                      setCustomAmounts((prev) => ({ ...prev, [currentUser?.id || '']: val }))
                    }
                    placeholder="0"
                    style={{
                      borderWidth: 1,
                      borderColor: colors.border,
                      borderRadius: 6,
                      paddingVertical: 4,
                      paddingHorizontal: 8,
                      flex: 1,
                      backgroundColor: '#fff',
                    }}
                  />
                </View>
              </Card>
            )}

            {/* Calculations Preview */}
            {parseFloat(amountStr) > 0 && (
              selectedMembers.length > 0 ? (
                <Card style={{ backgroundColor: '#f0fdf4', borderColor: '#bbf7d0', gap: 6 }}>
                  <Text style={{ fontWeight: '700', color: '#166534', fontSize: 13 }}>
                    SPLIT PREVIEW SUMMARY:
                  </Text>
                  <Text style={{ fontSize: 12, color: '#166534' }}>
                    • You pay: ₹{(calculatedShares[currentUser?.id || ''] || 0).toFixed(2)}{' '}
                    {splitType === 'PERCENTAGE' && `(${customAmounts[currentUser?.id || ''] || 0}%)`}
                  </Text>
                  {selectedMembers.map((id) => {
                    const m = members?.find((mb: any) => mb.id === id);
                    return (
                      <Text key={id} style={{ fontSize: 12, color: '#166534' }}>
                        • {formatStudentName(m)} owes: ₹{(calculatedShares[id] || 0).toFixed(2)}{' '}
                        {splitType === 'PERCENTAGE' && `(${customAmounts[id] || 0}%)`}
                      </Text>
                    );
                  })}
                </Card>
              ) : (
                <Card style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', gap: 4 }}>
                  <Text style={{ fontWeight: '700', color: '#1e40af', fontSize: 13 }}>
                    ℹ️ Personal Expense
                  </Text>
                  <Text style={{ fontSize: 12, color: '#1e40af' }}>
                    No other participants selected. This will be tracked as your personal expense and count fully toward your monthly budget.
                  </Text>
                </Card>
              )
            )}

            <Button
              title={
                submitting
                  ? 'Saving expense...'
                  : selectedMembers.length === 0
                    ? 'Log Personal Expense'
                    : 'Log & Share Split'
              }
              onPress={handleCreateSplit}
              disabled={submitting}
            />
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}