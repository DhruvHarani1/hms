import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { MonthCalendar } from '@/src/components/MonthCalendar';
import { Card } from '@/src/components/ui';
import { colors, radius } from '@/src/lib/theme';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/* ── Date picker field: day view ↔ month grid ↔ year grid (no native dep) ── */
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
  const [mode, setMode] = useState<'day' | 'months' | 'years'>('day');
  const [cursor, setCursor] = useState(() =>
    value ? new Date(value + 'T00:00:00') : new Date(),
  );

  const nowYear = new Date().getFullYear();
  const years: number[] = [];
  for (let y = nowYear + 2; y >= 1950; y--) years.push(y);

  function shift(delta: number) {
    setCursor((c) => new Date(c.getFullYear(), c.getMonth() + delta, 1));
  }
  function openPicker() {
    setMode('day');
    setCursor(value ? new Date(value + 'T00:00:00') : new Date());
    setOpen(true);
  }

  return (
    <View style={{ gap: 6 }}>
      <Text style={{ color: colors.muted, fontWeight: '600' }}>{label}</Text>
      <Pressable
        onPress={openPicker}
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
              {mode === 'day' ? (
                <MonthCalendar
                  monthDate={cursor}
                  marked={new Set(value ? [value] : [])}
                  onDayPress={(d) => {
                    onChange(d);
                    setOpen(false);
                  }}
                  onPrev={() => shift(-1)}
                  onNext={() => shift(1)}
                  onTitlePress={() => setMode('years')}
                />
              ) : mode === 'years' ? (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
                    Select year
                  </Text>
                  <ScrollView style={{ maxHeight: 300 }}>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                      {years.map((y) => {
                        const on = y === cursor.getFullYear();
                        return (
                          <Pressable
                            key={y}
                            onPress={() => {
                              setCursor((c) => new Date(y, c.getMonth(), 1));
                              setMode('months');
                            }}
                            style={{
                              width: '22%',
                              paddingVertical: 10,
                              borderRadius: radius.md,
                              alignItems: 'center',
                              backgroundColor: on ? colors.primary : '#fff',
                              borderWidth: 1,
                              borderColor: on ? colors.primary : colors.border,
                            }}
                          >
                            <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>
                              {y}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                </View>
              ) : (
                <View style={{ gap: 8 }}>
                  <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text }}>
                    {cursor.getFullYear()} — select month
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {MONTHS.map((m, i) => {
                      const on = i === cursor.getMonth();
                      return (
                        <Pressable
                          key={m}
                          onPress={() => {
                            setCursor((c) => new Date(c.getFullYear(), i, 1));
                            setMode('day');
                          }}
                          style={{
                            width: '30%',
                            paddingVertical: 12,
                            borderRadius: radius.md,
                            alignItems: 'center',
                            backgroundColor: on ? colors.primary : '#fff',
                            borderWidth: 1,
                            borderColor: on ? colors.primary : colors.border,
                          }}
                        >
                          <Text style={{ color: on ? '#fff' : colors.text, fontWeight: '700' }}>
                            {m}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <Pressable onPress={() => setMode('years')} style={{ paddingVertical: 8, alignItems: 'center' }}>
                    <Text style={{ color: colors.primary, fontWeight: '700' }}>‹ Change year</Text>
                  </Pressable>
                </View>
              )}
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
