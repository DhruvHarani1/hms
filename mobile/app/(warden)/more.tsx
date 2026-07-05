import { useState } from 'react';
import { Alert, ScrollView, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

export default function WardenMore() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function postNotice() {
    if (!title || !body) {
      Alert.alert('Missing', 'Add a title and body.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/notices', { title, body });
      setTitle('');
      setBody('');
      Alert.alert('✅ Posted', 'Students have been notified.');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 16 }}
    >
      <Card>
        <Text style={{ fontWeight: '700', fontSize: 16, color: colors.text }}>
          {user?.fullName}
        </Text>
        <Muted>{user?.email} · Warden</Muted>
      </Card>

      <Button
        title="🍽️  Meal attendance"
        variant="outline"
        onPress={() => router.push('/(warden)/meal-students')}
      />
      <Button
        title="📋  Attendance"
        variant="outline"
        onPress={() => router.push('/(warden)/attendance-students')}
      />
      <Button
        title="🏖️  Leave requests"
        variant="outline"
        onPress={() => router.push('/(warden)/leaves')}
      />

      <H1>Post a Notice</H1>
      <Card style={{ gap: 12 }}>
        <Field label="Title" value={title} onChangeText={setTitle} />
        <Field
          label="Message"
          value={body}
          onChangeText={setBody}
          multiline
          numberOfLines={4}
        />
        <Button title="Publish & Notify" onPress={postNotice} loading={busy} />
      </Card>

      <Button title="Log out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}
