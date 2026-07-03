import { ScrollView, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { Button, Card, H1, Muted } from '@/src/components/ui';
import { colors } from '@/src/lib/theme';

function Row({ label, value }: { label: string; value?: string | null }) {
  return (
    <Card style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      <Muted>{label}</Muted>
      <Text style={{ color: colors.text, fontWeight: '600' }}>
        {value ?? '—'}
      </Text>
    </Card>
  );
}

export default function StudentProfile() {
  const { user, logout } = useAuth();
  const { data } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/users/me')).data,
  });

  const p = data?.studentProfile;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 12 }}
    >
      <H1>{user?.fullName}</H1>
      <Row label="Email" value={user?.email} />
      <Row label="Roll No" value={p?.rollNo} />
      <Row label="Room" value={p?.roomNumber} />
      <Row label="Course" value={p?.course} />
      <Row label="Year" value={p?.year ? String(p.year) : null} />
      <Button title="Log out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}
