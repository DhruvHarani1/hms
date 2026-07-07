import { useState } from 'react';
import { Alert, Linking, Modal, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '@/src/lib/api';
import { API_URL } from '@/src/lib/config';
import { getFileUrl } from '@/src/lib/upload';
import { Button, Card, Muted } from '@/src/components/ui';
import { SkeletonList, ErrorState } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

function Row({ label, value }: { label: string; value?: any }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 3 }}>
      <Muted>{label}</Muted>
      <Text style={{ color: colors.text, fontWeight: '600', flexShrink: 1, textAlign: 'right' }}>
        {value != null && value !== '' ? String(value).slice(0, 40) : '—'}
      </Text>
    </View>
  );
}

export default function WardenStudentProfile() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const [pdfBusy, setPdfBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [removing, setRemoving] = useState(false);

  async function removeStudent() {
    setRemoving(true);
    try {
      await api.delete(`/students/${id}`);
      qc.invalidateQueries({ queryKey: ['students'] });
      qc.invalidateQueries({ queryKey: ['meal-students'] });
      qc.invalidateQueries({ queryKey: ['att-students'] });
      setConfirm(false);
      router.back();
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setRemoving(false);
    }
  }

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['warden-student', id],
    queryFn: async () => (await api.get(`/students/${id}`)).data,
  });

  const p = data?.studentProfile ?? {};

  async function viewDoc(key?: string | null) {
    if (!key) return;
    try {
      const url = await getFileUrl(key);
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open document');
    }
  }

  async function downloadPdf() {
    setPdfBusy(true);
    try {
      const res = await api.post(`/students/${id}/pdf-link`);
      const url = `${API_URL}/students/${id}/pdf?token=${res.data.token}`;
      await Linking.openURL(url);
    } catch (e: any) {
      Alert.alert('PDF failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setPdfBusy(false);
    }
  }

  if (isLoading) return <SkeletonList count={6} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  const docs = [
    { label: 'Profile photo', key: p.photoKey },
    { label: 'Aadhaar card', key: p.aadhaarKey },
    { label: 'Course proof', key: p.courseProofKey },
  ];

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <Stack.Screen options={{ title: name ?? 'Profile' }} />

      <Button
        title={pdfBusy ? 'Preparing…' : '⬇️  Download profile PDF'}
        onPress={downloadPdf}
        loading={pdfBusy}
      />

      <Card style={{ gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 4 }}>
          PERSONAL
        </Text>
        <Row label="Name" value={data?.fullName} />
        <Row label="Father's name" value={p.fatherName} />
        <Row label="Surname" value={p.surname} />
        <Row label="Date of birth" value={p.dob?.slice(0, 10)} />
        <Row label="Gender" value={p.gender} />
        <Row label="Blood group" value={p.bloodGroup} />
      </Card>

      <Card style={{ gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 4 }}>
          CONTACT
        </Text>
        <Row label="Mobile" value={data?.phone} />
        <Row label="Email" value={data?.email} />
        <Row label="Address" value={p.address} />
        <Row label="Guardian phone" value={p.guardianPhone} />
        <Row label="Emergency" value={p.emergencyContact} />
      </Card>

      <Card style={{ gap: 2 }}>
        <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary, marginBottom: 4 }}>
          ACADEMIC
        </Text>
        <Row label="Course" value={p.course} />
        <Row label="Year" value={p.year} />
        <Row label="Institute" value={p.instituteName} />
        <Row label="Institute address" value={p.instituteAddress} />
        <Row label="Joined" value={p.admissionDate?.slice(0, 10)} />
      </Card>

      <Text style={{ fontSize: 12, fontWeight: '800', color: colors.primary }}>
        DOCUMENTS
      </Text>
      {docs.map((d) => (
        <Card key={d.label} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View>
            <Text style={{ fontWeight: '700', color: colors.text }}>{d.label}</Text>
            <Text style={{ color: d.key ? colors.success : colors.muted }}>
              {d.key ? 'Uploaded ✓' : 'Not uploaded ✗'}
            </Text>
          </View>
          {d.key ? (
            <Button title="Download" onPress={() => viewDoc(d.key)} />
          ) : null}
        </Card>
      ))}

      <View style={{ height: 8 }} />
      <Button title="🗑  Remove student" variant="danger" onPress={() => setConfirm(true)} />

      <Modal visible={confirm} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#0008', justifyContent: 'center', padding: 24 }}>
          <Card style={{ gap: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: colors.text }}>
              Remove {data?.fullName ?? name}?
            </Text>
            <Muted>
              This permanently deletes the student and all their data — profile,
              documents (Aadhaar/photo/proof), meals, attendance, leaves and
              complaints. This cannot be undone.
            </Muted>
            <Button
              title="Yes, remove permanently"
              variant="danger"
              onPress={removeStudent}
              loading={removing}
            />
            <Button title="Cancel" variant="outline" onPress={() => setConfirm(false)} />
          </Card>
        </View>
      </Modal>
    </ScrollView>
  );
}
