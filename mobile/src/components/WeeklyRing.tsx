import { View, Text } from 'react-native';
import { colors } from '@/src/lib/theme';

interface Props {
  percentage: number;
  daysPresent: number;
  daysTotal: number;
  mealsEaten: number;
  mealsTotal: number;
}

function tierColor(pct: number): string {
  if (pct >= 80) return colors.success;
  if (pct >= 50) return colors.warning;
  return colors.danger;
}

function tierLabel(pct: number): string {
  if (pct >= 90) return 'Amazing! 🌟';
  if (pct >= 80) return 'Great! ⭐';
  if (pct >= 60) return 'Good 👍';
  if (pct >= 40) return 'Keep going 💪';
  return 'Room to grow 🌱';
}

export default function WeeklyRing({ percentage, daysPresent, daysTotal, mealsEaten, mealsTotal }: Props) {
  const ringColor = tierColor(percentage);

  return (
    <View style={{
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 16,
      borderWidth: 1,
      borderColor: colors.border,
    }}>
      {/* Percentage circle */}
      <View style={{
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 7,
        borderColor: colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Colored arc overlay using a half-circle trick */}
        <View style={{
          position: 'absolute',
          width: 80,
          height: 80,
          borderRadius: 40,
          borderWidth: 7,
          borderColor: 'transparent',
          borderTopColor: ringColor,
          borderRightColor: percentage >= 25 ? ringColor : 'transparent',
          borderBottomColor: percentage >= 50 ? ringColor : 'transparent',
          borderLeftColor: percentage >= 75 ? ringColor : 'transparent',
          transform: [{ rotate: '-45deg' }],
        }} />
        <Text style={{ fontSize: 20, fontWeight: '900', color: ringColor }}>
          {percentage}%
        </Text>
      </View>

      {/* Details */}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>
          📊 This Week
        </Text>
        <Text style={{ fontSize: 13, fontWeight: '600', color: ringColor }}>
          {tierLabel(percentage)}
        </Text>
        <Text style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
          {daysPresent}/{daysTotal} present · {mealsEaten}/{mealsTotal} meals
        </Text>
      </View>
    </View>
  );
}
