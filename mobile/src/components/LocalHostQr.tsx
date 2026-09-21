import { Text, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { colors, radius } from '@/src/lib/theme';

export function LocalHostQr({
  gameType,
  ip,
  port,
  code,
}: {
  gameType: 'uno' | 'ludo';
  ip: string;
  port: number;
  code: string;
}) {
  const payload = JSON.stringify({ g: gameType, ip, port, code });
  return (
    <View
      style={{
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.card,
        borderRadius: radius.lg,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 16,
      }}
    >
      <Text style={{ fontWeight: '700', color: colors.text }}>📶 Same-WiFi players scan this</Text>
      <View style={{ padding: 10, backgroundColor: '#fff', borderRadius: radius.md }}>
        <QRCode value={payload} size={160} />
      </View>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        No internet used — everyone must be on the same WiFi network.
      </Text>
      <Text style={{ color: colors.muted, fontSize: 12 }}>
        IP: {ip}:{port}
      </Text>
    </View>
  );
}
