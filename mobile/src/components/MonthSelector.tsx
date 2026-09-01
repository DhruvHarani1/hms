import { useRef, useEffect } from 'react';
import { ScrollView, Pressable, Text, View, StyleSheet } from 'react-native';
import { colors, radius } from '@/src/lib/theme';

const MONTHS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Generate the last `count` months as YYYY-MM strings (newest first). */
function recentMonths(count = 6): { key: string; label: string }[] {
  const now = new Date();
  const result: { key: string; label: string }[] = [];
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth(); // 0-indexed
    const key = `${y}-${String(m + 1).padStart(2, '0')}`;
    const label = `${MONTHS[m]} ${y}`;
    result.push({ key, label });
  }
  return result;
}

interface MonthSelectorProps {
  selected: string; // YYYY-MM
  onChange: (month: string) => void;
  count?: number;
}

export default function MonthSelector({ selected, onChange, count = 6 }: MonthSelectorProps) {
  const months = recentMonths(count);
  const scrollRef = useRef<ScrollView>(null);

  // Auto-scroll to selected pill on mount
  useEffect(() => {
    const idx = months.findIndex((m) => m.key === selected);
    if (idx > 0 && scrollRef.current) {
      // rough estimate: each pill is ~110px wide + 8px gap
      scrollRef.current.scrollTo({ x: Math.max(0, idx * 118 - 16), animated: false });
    }
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
    >
      {months.map((m) => {
        const active = m.key === selected;
        return (
          <Pressable
            key={m.key}
            onPress={() => onChange(m.key)}
            style={[styles.pill, active && styles.pillActive]}
          >
            <Text style={[styles.pillText, active && styles.pillTextActive]}>
              {m.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Current month as YYYY-MM. */
export function currentMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 2,
    paddingVertical: 4,
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radius.full,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  pillText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.muted,
  },
  pillTextActive: {
    color: '#fff',
  },
});
