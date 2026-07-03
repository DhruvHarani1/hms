import { View, ActivityIndicator } from 'react-native';
import { colors } from '@/src/lib/theme';

// The root layout's AuthGate handles redirection; this is just a placeholder
// shown for a frame while routing resolves.
export default function Index() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.bg,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}
