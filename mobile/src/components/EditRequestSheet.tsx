/**
 * EditRequestSheet — Reusable bottom sheet for submitting past-day edit requests.
 * Shows current values for attendance/lunch/dinner and lets the student
 * specify desired new values + a reason before submitting.
 */
import { useEffect, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { Button, Card } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

export interface DayValues {
  /** true = present, false = absent. undefined = don't include in request. */
  attendance?: boolean;
  /** true = eating, false = opted-out. */
  lunch?: boolean;
  dinner?: boolean;
}

interface Props {
  /** The past date being requested (YYYY-MM-DD). Null = sheet is closed. */
  day: string | null;
  /** Current recorded values for that day (so student sees what they're changing). */
  currentValues: DayValues;
  onClose: () => void;
  /** Called with the query keys to invalidate after a successful submission. */
  invalidateKeys?: string[][];
}

export function EditRequestSheet({ day, currentValues, onClose, invalidateKeys }: Props) {
  const qc = useQueryClient();

  // Desired new values — reset to currentValues whenever a new day is opened
  const [wantAttendance, setWantAttendance] = useState<boolean | undefined>(currentValues.attendance);
  const [wantLunch, setWantLunch] = useState<boolean | undefined>(currentValues.lunch);
  const [wantDinner, setWantDinner] = useState<boolean | undefined>(currentValues.dinner);
  const [reason, setReason] = useState('');

  // Sync toggles to the actual current values whenever a different past day is tapped
  useEffect(() => {
    if (day) {
      setWantAttendance(currentValues.attendance);
      setWantLunch(currentValues.lunch);
      setWantDinner(currentValues.dinner);
      setReason('');
    }
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = useMutation({
    mutationFn: async () => {
      // Build the changes object — only include fields that differ from current
      const changes: DayValues = {};
      if (typeof wantAttendance === 'boolean' && wantAttendance !== currentValues.attendance) {
        changes.attendance = wantAttendance;
      }
      if (typeof wantLunch === 'boolean' && wantLunch !== currentValues.lunch) {
        changes.lunch = wantLunch;
      }
      if (typeof wantDinner === 'boolean' && wantDinner !== currentValues.dinner) {
        changes.dinner = wantDinner;
      }

      if (Object.keys(changes).length === 0) {
        throw new Error('No changes detected. Toggle at least one value to differ from current.');
      }
      if (!reason.trim() || reason.trim().length < 5) {
        throw new Error('Please provide a reason (at least 5 characters).');
      }

      await api.post('/edit-requests', { date: day, changes, reason: reason.trim() });
    },
    onSuccess: () => {
      // Invalidate all relevant queries
      invalidateKeys?.forEach((key) => qc.invalidateQueries({ queryKey: key }));
      qc.invalidateQueries({ queryKey: ['my-edit-requests'] });
      onClose();
      Alert.alert(
        '✅ Request Sent',
        'Your edit request has been submitted. The warden will review it shortly.',
      );
    },
    onError: (e: any) => {
      const msg = e?.message ?? e?.response?.data?.message ?? 'Something went wrong.';
      Alert.alert('Failed', msg);
    },
  });

  if (!day) return null;

  const hasAttendance = typeof currentValues.attendance === 'boolean';
  const hasMeals = typeof currentValues.lunch === 'boolean' || typeof currentValues.dinner === 'boolean';

  return (
    <Modal visible={!!day} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable
        style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}
        onPress={onClose}
      >
        {/* Stop propagation so tapping inside doesn't close */}
        <Pressable onPress={(e) => e.stopPropagation()}>
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{ padding: 16 }}
          >
            <Card style={{ gap: 16 }}>
              {/* Header */}
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
                  🔒 Past Day: {day}
                </Text>
                <Pressable onPress={onClose} hitSlop={12}>
                  <Text style={{ fontSize: 22, color: colors.muted }}>✕</Text>
                </Pressable>
              </View>

              <Text style={{ fontSize: 13, color: colors.muted, lineHeight: 18 }}>
                This day is locked. You can request a correction — the warden will review it.
              </Text>

              {/* Attendance toggle (only shown if this is an attendance screen) */}
              {hasAttendance && (
                <ToggleRow
                  label="Attendance"
                  currentLabel={currentValues.attendance ? 'Present ✅' : 'Absent ❌'}
                  value={wantAttendance ?? currentValues.attendance ?? true}
                  trueLabel="Present"
                  falseLabel="Absent"
                  onChange={setWantAttendance}
                />
              )}

              {/* Meal toggles (only shown if this is a meal screen) */}
              {typeof currentValues.lunch === 'boolean' && (
                <ToggleRow
                  label="Lunch"
                  currentLabel={currentValues.lunch ? 'Eaten 🍛' : 'Skipped ✗'}
                  value={wantLunch ?? currentValues.lunch}
                  trueLabel="Eating"
                  falseLabel="Skipping"
                  onChange={setWantLunch}
                />
              )}
              {typeof currentValues.dinner === 'boolean' && (
                <ToggleRow
                  label="Dinner"
                  currentLabel={currentValues.dinner ? 'Eaten 🌙' : 'Skipped ✗'}
                  value={wantDinner ?? currentValues.dinner}
                  trueLabel="Eating"
                  falseLabel="Skipping"
                  onChange={setWantDinner}
                />
              )}

              {/* Reason */}
              <View style={{ gap: 6 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>Reason *</Text>
                <TextInput
                  value={reason}
                  onChangeText={setReason}
                  placeholder="e.g. I forgot to mark myself present"
                  placeholderTextColor={colors.muted}
                  multiline
                  numberOfLines={3}
                  style={{
                    backgroundColor: colors.bg,
                    borderRadius: radius.md,
                    borderWidth: 1,
                    borderColor: colors.border,
                    padding: 10,
                    color: colors.text,
                    fontSize: 14,
                    minHeight: 72,
                    textAlignVertical: 'top',
                  }}
                />
              </View>

              <Button
                title="Submit Edit Request"
                onPress={() => submit.mutate()}
                loading={submit.isPending}
              />
              <Button title="Cancel" variant="outline" onPress={onClose} />
            </Card>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function ToggleRow({
  label,
  currentLabel,
  value,
  trueLabel,
  falseLabel,
  onChange,
}: {
  label: string;
  currentLabel: string;
  value: boolean;
  trueLabel: string;
  falseLabel: string;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>{label}</Text>
        <Text style={{ fontSize: 12, color: colors.muted }}>Currently: {currentLabel}</Text>
      </View>
      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.bg,
        borderRadius: radius.md,
        padding: 10,
        borderWidth: 1,
        borderColor: colors.border,
      }}>
        <Text style={{ color: value ? colors.muted : colors.danger, fontWeight: '600', flex: 1 }}>
          {falseLabel}
        </Text>
        <Switch
          value={value}
          onValueChange={onChange}
          trackColor={{ false: colors.danger + '60', true: colors.success + '60' }}
          thumbColor={value ? colors.success : colors.danger}
        />
        <Text style={{ color: value ? colors.success : colors.muted, fontWeight: '600', flex: 1, textAlign: 'right' }}>
          {trueLabel}
        </Text>
      </View>
    </View>
  );
}
