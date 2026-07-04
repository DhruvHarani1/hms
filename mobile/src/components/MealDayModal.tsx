import { Modal, Pressable, Text, View } from 'react-native';
import { Card, Muted } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

type DayState = { lunch: boolean; dinner: boolean };

/** Per-day meal sheet. Breakfast is derived (lunch || dinner) and read-only.
 *  editable=true → lunch/dinner are toggleable; false → view only (warden). */
export function MealDayModal({
  visible,
  dateStr,
  state,
  editable,
  onToggle,
  onClose,
}: {
  visible: boolean;
  dateStr: string | null;
  state: DayState;
  editable: boolean;
  onToggle?: (meal: 'lunch' | 'dinner', next: boolean) => void;
  onClose: () => void;
}) {
  const breakfast = state.lunch || state.dinner;
  const prettyDate = dateStr
    ? new Date(dateStr + 'T00:00:00').toLocaleDateString(undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
      })
    : '';

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable
        onPress={onClose}
        style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'flex-end' }}
      >
        <Pressable onPress={() => {}} style={{ padding: 16 }}>
          <Card style={{ gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              {prettyDate}
            </Text>

            <MealRow
              emoji="🍳"
              label="Breakfast"
              on={breakfast}
              locked
              hint="Auto — on if lunch or dinner"
            />
            <MealRow
              emoji="🍛"
              label="Lunch"
              on={state.lunch}
              locked={!editable}
              onPress={() => onToggle?.('lunch', !state.lunch)}
            />
            <MealRow
              emoji="🌙"
              label="Dinner"
              on={state.dinner}
              locked={!editable}
              onPress={() => onToggle?.('dinner', !state.dinner)}
            />

            <Pressable
              onPress={onClose}
              style={{
                marginTop: 4,
                paddingVertical: 12,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontWeight: '700', color: colors.text }}>Done</Text>
            </Pressable>
          </Card>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MealRow({
  emoji,
  label,
  on,
  locked,
  hint,
  onPress,
}: {
  emoji: string;
  label: string;
  on: boolean;
  locked?: boolean;
  hint?: string;
  onPress?: () => void;
}) {
  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 14,
        borderRadius: radius.md,
        borderWidth: on ? 2 : 1,
        borderColor: on ? colors.primary : colors.border,
        backgroundColor: on ? colors.primarySoft : colors.card,
        opacity: locked ? 0.85 : 1,
      }}
    >
      <Text style={{ fontSize: 24 }}>{emoji}</Text>
      <View style={{ flex: 1 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>
          {label}
          {locked && label === 'Breakfast' ? ' 🔒' : ''}
        </Text>
        {hint ? <Muted>{hint}</Muted> : null}
      </View>
      <Text style={{ fontSize: 22 }}>{on ? '✅' : '⬜'}</Text>
    </Pressable>
  );
}
