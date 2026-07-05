import { Image, Text, View } from 'react-native';
import { colors } from '@/src/lib/theme';

/** Small logo + app name for the Home tab header. */
export function HeaderLogo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <Image
        source={require('../../assets/logo.jpg')}
        style={{ width: 30, height: 30, borderRadius: 7 }}
        resizeMode="contain"
      />
      <Text style={{ fontSize: 17, fontWeight: '800', color: colors.text }}>
        AIFDMS
      </Text>
    </View>
  );
}
