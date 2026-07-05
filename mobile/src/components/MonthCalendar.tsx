import { Pressable, Text, View } from 'react-native';
import { colors, radius } from '@/src/lib/theme';

/* Pure-RN month calendar. No native deps.
 * - `monthDate`: any Date within the month to render.
 * - `marked`: Set of 'YYYY-MM-DD' strings that are ticked.
 * - `onToggle(dateStr)`: if provided, cells are tappable (editable). Omit = read-only.
 * - `onPrev` / `onNext`: month navigation.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

function todayKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${pad(n.getMonth() + 1)}-${pad(n.getDate())}`;
}

export function MonthCalendar({
  monthDate,
  marked,
  dangerDates,
  onDayPress,
  onPrev,
  onNext,
}: {
  monthDate: Date;
  marked: Set<string>;
  dangerDates?: Set<string>;
  onDayPress?: (dateStr: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
}) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth(); // 0-based
  const firstWeekday = new Date(year, month, 1).getDay(); // 0=Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayKey();

  const monthLabel = monthDate.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

  // Build cells: leading blanks + day numbers.
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View style={{ gap: 10 }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <NavBtn label="‹" onPress={onPrev} />
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
          {monthLabel}
        </Text>
        <NavBtn label="›" onPress={onNext} />
      </View>

      {/* Weekday row */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w, i) => (
          <Text
            key={i}
            style={{
              flex: 1,
              textAlign: 'center',
              color: colors.muted,
              fontWeight: '700',
              fontSize: 12,
            }}
          >
            {w}
          </Text>
        ))}
      </View>

      {/* Day grid */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
        {cells.map((d, i) => {
          if (d === null) {
            return <View key={i} style={{ width: `${100 / 7}%`, height: 44 }} />;
          }
          const key = `${year}-${pad(month + 1)}-${pad(d)}`;
          const on = marked.has(key);
          const danger = dangerDates?.has(key) ?? false;
          const isToday = key === today;
          return (
            <View
              key={i}
              style={{
                width: `${100 / 7}%`,
                height: 44,
                padding: 3,
              }}
            >
              <Pressable
                disabled={!onDayPress}
                onPress={() => onDayPress?.(key)}
                style={{
                  flex: 1,
                  borderRadius: radius.md,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: danger
                    ? colors.danger
                    : on
                      ? colors.primary
                      : colors.card,
                  borderWidth: isToday ? 2 : 1,
                  borderColor: isToday
                    ? colors.primary
                    : danger
                      ? colors.danger
                      : on
                        ? colors.primary
                        : colors.border,
                }}
              >
                <Text
                  style={{
                    color: danger || on ? '#fff' : colors.text,
                    fontWeight: isToday ? '800' : '600',
                  }}
                >
                  {d}
                </Text>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function NavBtn({ label, onPress }: { label: string; onPress?: () => void }) {
  if (!onPress) return <View style={{ width: 40 }} />;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      style={{
        width: 40,
        height: 40,
        borderRadius: radius.md,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.primarySoft,
      }}
    >
      <Text style={{ fontSize: 22, color: colors.primary, fontWeight: '800' }}>
        {label}
      </Text>
    </Pressable>
  );
}
