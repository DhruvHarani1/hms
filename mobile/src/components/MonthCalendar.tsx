import { Pressable, Text, View } from 'react-native';
import { colors, radius } from '@/src/lib/theme';

/* Pure-RN month calendar. No native deps.
 * - `monthDate`: any Date within the month to render.
 * - `marked`: Set of 'YYYY-MM-DD' — shown in GREEN (present / eating).
 * - `dangerDates`: Set of 'YYYY-MM-DD' — shown in RED (absent / skipping).
 * - `pendingDates`: Set of 'YYYY-MM-DD' — past days with a pending edit request (⏳).
 * - `onDayPress(dateStr)`: if provided, cells are tappable. Omit = read-only.
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
  pendingDates,
  onDayPress,
  onPrev,
  onNext,
  onTitlePress,
}: {
  monthDate: Date;
  marked: Set<string>;
  dangerDates?: Set<string>;
  pendingDates?: Set<string>;
  onDayPress?: (dateStr: string) => void;
  onPrev?: () => void;
  onNext?: () => void;
  onTitlePress?: () => void;
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

  // Chunk into rows of 7.
  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    rows.push(cells.slice(i, i + 7));
  }

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
        <Pressable onPress={onTitlePress} hitSlop={8} disabled={!onTitlePress}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: onTitlePress ? colors.primary : colors.text }}>
            {monthLabel}
            {onTitlePress ? '  ▾' : ''}
          </Text>
        </Pressable>
        <NavBtn label="›" onPress={onNext} />
      </View>

      {/* Weekday row */}
      <View style={{ flexDirection: 'row' }}>
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ color: colors.muted, fontWeight: '700', fontSize: 12 }}>
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Day grid */}
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((d, ci) => {
            if (d === null) {
              return <View key={ci} style={{ flex: 1, height: 44 }} />;
            }
            const key = `${year}-${pad(month + 1)}-${pad(d)}`;
            const isGreen = marked.has(key);           // present / eating
            const isRed   = dangerDates?.has(key) ?? false; // absent / skipping
            const isPast    = key < today;
            const isPending = pendingDates?.has(key) ?? false;
            const isToday   = key === today;

            // Colour priority: red > green > today-outline > default
            const bgColor = isRed
              ? colors.danger
              : isGreen
                ? colors.success
                : colors.card;

            const borderColor = isToday
              ? colors.primary
              : isRed
                ? colors.danger
                : isGreen
                  ? colors.success
                  : colors.border;

            const textColor = isRed || isGreen ? '#fff' : colors.text;

            return (
              <View key={ci} style={{ flex: 1, height: 44, padding: 3 }}>
                <Pressable
                  disabled={!onDayPress}
                  onPress={() => onDayPress?.(key)}
                  style={{
                    flex: 1,
                    borderRadius: radius.md,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: bgColor,
                    borderWidth: isToday ? 2 : 1,
                    borderColor,
                    // Dim past days slightly to indicate locked
                    opacity: isPast && !isPending ? 0.75 : 1,
                  }}
                >
                  <Text style={{ color: textColor, fontWeight: isToday ? '800' : '600', fontSize: 13 }}>
                    {d}
                  </Text>
                  {isPending && (
                    <Text style={{ fontSize: 8, lineHeight: 10, color: '#f59e0b' }}>⏳</Text>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
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
