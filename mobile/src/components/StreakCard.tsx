import { View, Text } from 'react-native';
import { colors } from '@/src/lib/theme';

interface StreakData {
  current: number;
  nextMilestone: number;
}

interface Props {
  attendance: StreakData;
  meals: StreakData;
  perfect: StreakData;
}

const STREAK_CONFIG = [
  { key: 'meals' as const,      icon: '🔥', label: 'Meal Streak',      color: '#f97316' },
  { key: 'attendance' as const,  icon: '🏠', label: 'Attendance Streak', color: '#6366f1' },
  { key: 'perfect' as const,     icon: '⭐', label: 'Perfect Streak',   color: '#eab308' },
];

function milestoneLabel(current: number): string {
  if (current === 0) return 'Start today!';
  if (current < 7) return `${current}/7 → 1 week!`;
  if (current < 14) return `${current}/14 → 2 weeks!`;
  if (current < 30) return `${current}/30 → 1 month!`;
  if (current < 60) return `${current}/60 → 2 months!`;
  if (current < 100) return `${current}/100 → Century!`;
  return `🏆 ${current} days — Legend!`;
}

function fireEmoji(current: number): string {
  if (current === 0) return '💤';
  if (current < 7) return '🔥';
  if (current < 14) return '🔥🔥';
  if (current < 30) return '🔥🔥🔥';
  return '💎';
}

export default function StreakCard({ attendance, meals, perfect }: Props) {
  // Don't show if all streaks are 0
  const hasAnyStreak = attendance.current > 0 || meals.current > 0 || perfect.current > 0;

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      gap: 14,
      borderWidth: 1,
      borderColor: hasAnyStreak ? 'rgba(249, 115, 22, 0.2)' : colors.border,
    }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
          {hasAnyStreak ? '🔥' : '💤'} Streaks
        </Text>
        {hasAnyStreak && (
          <View style={{
            backgroundColor: 'rgba(249, 115, 22, 0.1)',
            paddingHorizontal: 8,
            paddingVertical: 2,
            borderRadius: 999,
          }}>
            <Text style={{ fontSize: 11, fontWeight: '700', color: '#f97316' }}>
              Keep going!
            </Text>
          </View>
        )}
      </View>

      {STREAK_CONFIG.map(({ key, icon, label, color }) => {
        const streak = key === 'meals' ? meals : key === 'attendance' ? attendance : perfect;
        const progress = streak.nextMilestone > 0
          ? Math.min(streak.current / streak.nextMilestone, 1)
          : 0;

        return (
          <View key={key} style={{ gap: 4 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>
                {streak.current > 0 ? fireEmoji(streak.current) : icon} {label}
              </Text>
              <Text style={{ fontSize: 11, fontWeight: '600', color: colors.muted }}>
                {milestoneLabel(streak.current)}
              </Text>
            </View>
            <View style={{
              height: 8,
              backgroundColor: colors.border,
              borderRadius: 999,
              overflow: 'hidden',
            }}>
              <View style={{
                width: `${Math.max(progress * 100, streak.current > 0 ? 5 : 0)}%`,
                height: '100%',
                backgroundColor: color,
                borderRadius: 999,
              }} />
            </View>
          </View>
        );
      })}
    </View>
  );
}
