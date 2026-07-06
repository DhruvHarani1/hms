import { useState } from 'react';
import { Modal, Pressable, Text, View } from 'react-native';
import { MonthCalendar } from '@/src/components/MonthCalendar';
import { Card } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

/* ── Date picker field (calendar modal, no native dep) ── */
export function DateField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string; // "YYYY-MM-DD" or ''
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(() =>
    value ? new Date(value + 'T00:00:00') : new Date(),
  );

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontWeight: '600' }}>{label}</Text>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 12,
          padding: 14,
          backgroundColor: '#fff',
        }}
      >
        <Text style={{ fontSize: 16, color: value ? colors.text : colors.muted }}>
          {value || 'Select date'}
        </Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade">
        <Pressable
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 16 }}
        >
          <Pressable onPress={() => {}}>
            <Card style={{ gap: 10 }}>
              <MonthCalendar
                monthDate={cursor}
                marked={new Set(value ? [value] : [])}
                onDayPress={(d) => {
                  onChange(d);
                  setOpen(false);
                }}
                onPrev={() => shift(-1)}
                onNext={() => shift(1)}
              />
              <Pressable
                onPress={() => setOpen(false)}
                style={{ paddingVertical: 10, alignItems: 'center' }}
              >
                <Text style={{ color: colors.muted, fontWeight: '700' }}>Cancel</Text>
              </Pressable>
            </Card>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ── Chip select field ── */
export function SelectField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontWeight: '600' }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((opt) => {
          const on = value === opt;
          return (
            <Pressable
              key={opt}
              onPress={() => onChange(opt)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 9,
                borderRadius: radius.pill,
                borderWidth: 1,
                borderColor: on ? colors.primary : colors.border,
                backgroundColor: on ? colors.primary : '#fff',
              }}
            >
              <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>
                {opt}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
