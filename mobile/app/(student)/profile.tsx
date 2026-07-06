import { useEffect, useState } from 'react';
import { Alert, Linking, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { pickAndUpload, getFileUrl, DocKind } from '@/src/lib/upload';
import { Button, Card, Field, H1, Muted } from '@/src/components/ui';
import { SkeletonList, ErrorState } from '@/src/components/primitives';
import { colors } from '@/src/lib/theme';

const FIELDS: { key: string; label: string; profile?: boolean }[] = [
  { key: 'fullName', label: 'Name' },
  { key: 'surname', label: 'Surname', profile: true },
  { key: 'fatherName', label: "Father's name", profile: true },
  { key: 'phone', label: 'Mobile number' },
  { key: 'dob', label: 'Date of birth (YYYY-MM-DD)', profile: true },
  { key: 'gender', label: 'Gender', profile: true },
  { key: 'bloodGroup', label: 'Blood group', profile: true },
  { key: 'address', label: 'Address', profile: true },
  { key: 'guardianPhone', label: 'Guardian phone', profile: true },
  { key: 'emergencyContact', label: 'Emergency contact', profile: true },
  { key: 'course', label: 'Course', profile: true },
  { key: 'year', label: 'Year', profile: true },
  { key: 'department', label: 'Department', profile: true },
  { key: 'instituteName', label: 'Institute name', profile: true },
  { key: 'instituteAddress', label: 'Institute address', profile: true },
  { key: 'rollNo', label: 'Roll no', profile: true },
  { key: 'roomNumber', label: 'Room', profile: true },
  { key: 'admissionDate', label: 'Date of joining (YYYY-MM-DD)', profile: true },
];

const DOCS: { kind: DocKind; label: string; keyField: string }[] = [
  { kind: 'photo', label: 'Profile photo', keyField: 'photoKey' },
  { kind: 'aadhaar', label: 'Aadhaar card', keyField: 'aadhaarKey' },
  { kind: 'course_proof', label: 'Course proof (fee receipt)', keyField: 'courseProofKey' },
];

export default function StudentProfile() {
  const qc = useQueryClient();
  const { logout } = useAuth();
  const [form, setForm] = useState<Record<string, string>>({});
  const [keys, setKeys] = useState<Record<string, string | null>>({});
  const [saving, setSaving] = useState(false);
  const [busyDoc, setBusyDoc] = useState<string | null>(null);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['me'],
    queryFn: async () => (await api.get('/users/me')).data,
  });

  useEffect(() => {
    if (!data) return;
    const p = data.studentProfile ?? {};
    const next: Record<string, string> = {};
    for (const f of FIELDS) {
      let v = f.profile ? p[f.key] : data[f.key];
      if ((f.key === 'dob' || f.key === 'admissionDate') && v) v = String(v).slice(0, 10);
      next[f.key] = v != null ? String(v) : '';
    }
    setForm(next);
    setKeys({
      photoKey: p.photoKey ?? null,
      aadhaarKey: p.aadhaarKey ?? null,
      courseProofKey: p.courseProofKey ?? null,
    });
  }, [data]);

  function set(k: string, v: string) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function save() {
    setSaving(true);
    try {
      const payload: any = {};
      for (const f of FIELDS) {
        const v = form[f.key]?.trim() ?? '';
        payload[f.key] = f.key === 'year' ? (v ? Number(v) : undefined) : v || undefined;
      }
      await api.patch('/users/me', payload);
      qc.invalidateQueries({ queryKey: ['me'] });
      Alert.alert('✅ Saved', 'Profile updated.');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setSaving(false);
    }
  }

  async function upload(kind: DocKind, keyField: string) {
    setBusyDoc(kind);
    try {
      const key = await pickAndUpload(kind);
      if (!key) return;
      await api.patch('/users/me', { [keyField]: key });
      setKeys((s) => ({ ...s, [keyField]: key }));
      qc.invalidateQueries({ queryKey: ['me'] });
      Alert.alert('✅ Uploaded', 'Document saved.');
    } catch (e: any) {
      Alert.alert('Upload failed', e?.message ?? 'Try again.');
    } finally {
      setBusyDoc(null);
    }
  }

  async function view(key: string) {
    try {
      const url = await getFileUrl(key);
      await Linking.openURL(url);
    } catch {
      Alert.alert('Could not open', 'Try again.');
    }
  }

  if (isLoading) return <SkeletonList count={6} />;
  if (isError) return <ErrorState onRetry={refetch} />;

  return (
    <ScrollView
      style={{ backgroundColor: colors.bg }}
      contentContainerStyle={{ padding: 16, gap: 14 }}
    >
      <H1>My Profile</H1>
      <Muted>Complete your details. Warden can view these.</Muted>

      <Card style={{ gap: 12 }}>
        {FIELDS.map((f) => (
          <Field
            key={f.key}
            label={f.label}
            value={form[f.key] ?? ''}
            onChangeText={(v) => set(f.key, v)}
            autoCapitalize="none"
            keyboardType={f.key === 'year' ? 'numeric' : 'default'}
          />
        ))}
        <Button title="Save profile" onPress={save} loading={saving} />
      </Card>

      <H1>Documents</H1>
      {DOCS.map((d) => {
        const uploaded = !!keys[d.keyField];
        return (
          <Card key={d.kind} style={{ gap: 8 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>{d.label}</Text>
              <Text style={{ color: uploaded ? colors.success : colors.muted, fontWeight: '700' }}>
                {uploaded ? 'Uploaded ✓' : 'Not uploaded'}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <Button
                  title={uploaded ? 'Replace' : 'Upload'}
                  variant="outline"
                  onPress={() => upload(d.kind, d.keyField)}
                  loading={busyDoc === d.kind}
                />
              </View>
              {uploaded ? (
                <View style={{ flex: 1 }}>
                  <Button title="View" onPress={() => view(keys[d.keyField]!)} />
                </View>
              ) : null}
            </View>
          </Card>
        );
      })}

      <Button title="Log out" variant="danger" onPress={logout} />
    </ScrollView>
  );
}
