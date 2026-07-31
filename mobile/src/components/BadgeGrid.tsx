import { View, Text, Pressable } from 'react-native';
import { colors } from '@/src/lib/theme';

interface Badge {
  id: string;
  name: string;
  icon: string;
  desc: string;
  hint: string;
  category: string;
  earned: boolean;
}

interface Props {
  earned: Badge[];
  locked: Badge[];
  total: number;
  earnedCount: number;
}

export default function BadgeGrid({ earned, locked, total, earnedCount }: Props) {
  const allBadges = [...earned, ...locked];

  // Group by category
  const categories: Record<string, Badge[]> = {};
  for (const b of allBadges) {
    if (!categories[b.category]) categories[b.category] = [];
    categories[b.category].push(b);
  }

  const categoryLabels: Record<string, string> = {
    meals: '🍽️ Meals',
    attendance: '🏠 Attendance',
    community: '📝 Community',
    finance: '💰 Finance',
    special: '🎉 Special',
  };

  const categoryOrder = ['meals', 'attendance', 'community', 'finance', 'special'];

  return (
    <View style={{ gap: 24 }}>
      {/* Header */}
      <View style={{ alignItems: 'center', gap: 8 }}>
        <Text style={{ fontSize: 48 }}>🏅</Text>
        <Text style={{ fontSize: 24, fontWeight: '900', color: colors.text }}>
          Achievements
        </Text>
        <View style={{
          backgroundColor: colors.primarySoft,
          paddingHorizontal: 14,
          paddingVertical: 6,
          borderRadius: 999,
        }}>
          <Text style={{ fontSize: 14, fontWeight: '700', color: colors.primary }}>
            {earnedCount} / {total} Unlocked
          </Text>
        </View>
      </View>

      {/* Badge categories */}
      {categoryOrder.map((cat) => {
        const badges = categories[cat];
        if (!badges || badges.length === 0) return null;

        return (
          <View key={cat} style={{ gap: 12 }}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>
              {categoryLabels[cat] ?? cat}
            </Text>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {badges.map((badge) => (
                <View
                  key={badge.id}
                  style={{
                    width: '30%',
                    backgroundColor: badge.earned ? colors.card : '#f1f5f9',
                    borderRadius: 14,
                    padding: 12,
                    alignItems: 'center',
                    gap: 6,
                    borderWidth: 1,
                    borderColor: badge.earned ? colors.success + '40' : colors.border,
                    opacity: badge.earned ? 1 : 0.5,
                  }}
                >
                  <Text style={{ fontSize: 28 }}>
                    {badge.earned ? badge.icon : '🔒'}
                  </Text>
                  <Text style={{
                    fontSize: 11,
                    fontWeight: '700',
                    color: badge.earned ? colors.text : colors.muted,
                    textAlign: 'center',
                  }}>
                    {badge.earned ? badge.name : '???'}
                  </Text>
                  <Text style={{
                    fontSize: 9,
                    color: colors.muted,
                    textAlign: 'center',
                    lineHeight: 13,
                  }}>
                    {badge.earned ? badge.desc : badge.hint}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        );
      })}
    </View>
  );
}
