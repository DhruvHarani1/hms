import { Pressable, Text, View } from 'react-native';
import { colors } from '@/src/lib/theme';

export function ChatButton({
  count,
  onPress,
}: {
  count: number;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} hitSlop={10} style={{ paddingHorizontal: 8 }}>
      <Text style={{ fontSize: 22 }}>💬</Text>
      {count > 0 ? (
        <View
          style={{
            position: 'absolute',
            top: -4,
            right: 0,
            minWidth: 18,
            height: 18,
            paddingHorizontal: 4,
            borderRadius: 9,
            backgroundColor: colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>
            {count > 99 ? '99+' : count}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}
