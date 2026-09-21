import { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter, Stack } from 'expo-router';
import { Button } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function ScanGameQr() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  function handleScan({ data }: { data: string }) {
    if (scanned) return;
    setScanned(true);
    try {
      const payload = JSON.parse(data);
      if (!payload.g || !payload.ip || !payload.port) throw new Error('bad payload');
      router.replace(
        `/(student)/games/${payload.g}/local?role=client&ip=${payload.ip}&port=${payload.port}&code=${payload.code ?? ''}` as any,
      );
    } catch {
      Alert.alert('Invalid QR code', "That doesn't look like an AIFDMS game invite.", [
        { text: 'OK', onPress: () => setScanned(false) },
      ]);
    }
  }

  if (!permission) {
    return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  }

  if (!permission.granted) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <Stack.Screen options={{ title: 'Scan to Join' }} />
        <Text style={{ fontSize: 40 }}>📷</Text>
        <Text style={{ textAlign: 'center', color: colors.text }}>
          Camera access is needed to scan a game invite QR code.
        </Text>
        <Button title="Grant Camera Access" onPress={requestPermission} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      <Stack.Screen options={{ title: 'Scan to Join' }} />
      <CameraView
        style={{ flex: 1 }}
        barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
        onBarcodeScanned={handleScan}
      />
      <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, alignItems: 'center' }}>
        <Text style={{ color: '#fff', backgroundColor: '#00000088', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 999 }}>
          Point at the host's QR code
        </Text>
      </View>
    </View>
  );
}
