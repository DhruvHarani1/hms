import { useState } from 'react';
import { Alert, FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter, Stack } from 'expo-router';
import * as Network from 'expo-network';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';
import { useLocalGameDiscovery } from '@/src/hooks/useLocalGameDiscovery';
import { isLikelyLanIp } from '@/src/lib/localGame/constants';
import { Button, Card, Muted } from '@/src/components/ui';
import { EmptyState, ErrorState, SkeletonList } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

const GAMES = [
  { type: 'uno' as const, name: 'UNO', emoji: '🃏', color: '#e11d48' },
  { type: 'ludo' as const, name: 'Ludo', emoji: '🎲', color: '#16a34a' },
];

function routeFor(gameType: string, id: string) {
  return gameType === 'uno' ? `/(student)/games/uno/${id}` : `/(student)/games/ludo/${id}`;
}

export default function GamesLobby() {
  const router = useRouter();
  const { user } = useAuth();
  const qc = useQueryClient();
  const [joinCode, setJoinCode] = useState('');
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [botPicker, setBotPicker] = useState<'uno' | 'ludo' | null>(null);
  const nearbyGames = useLocalGameDiscovery(true);

  function startBotGame(gameType: 'uno' | 'ludo', botCount: number) {
    setBotPicker(null);
    router.push(`/(student)/games/${gameType}/bot?bots=${botCount}` as any);
  }

  async function hostLocalGame(gameType: 'uno' | 'ludo') {
    const ip = await Network.getIpAddressAsync().catch(() => null);
    if (!isLikelyLanIp(ip)) {
      Alert.alert(
        'No local network',
        'Turn on WiFi or your phone hotspot first — hosting needs a local network for other phones to connect to.',
      );
      return;
    }
    router.push(`/(student)/games/${gameType}/local?role=host` as any);
  }

  const { data: rooms, isLoading, isError, refetch } = useQuery({
    queryKey: ['game-rooms'],
    queryFn: async () => (await api.get('/games/rooms')).data,
    refetchInterval: 4000,
  });

  async function createRoom(gameType: 'uno' | 'ludo') {
    setCreating(true);
    try {
      const res = await api.post('/games/rooms', { gameType });
      qc.invalidateQueries({ queryKey: ['game-rooms'] });
      router.push(routeFor(gameType, res.data.id) as any);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setCreating(false);
    }
  }

  async function joinByCode() {
    if (!joinCode.trim()) return;
    setJoining(true);
    try {
      const res = await api.post('/games/rooms/join', { code: joinCode.trim().toUpperCase() });
      router.push(routeFor(res.data.gameType, res.data.id) as any);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Room not found.');
    } finally {
      setJoining(false);
    }
  }

  async function joinRoom(room: any) {
    try {
      const res = await api.post('/games/rooms/join', { code: room.code });
      router.push(routeFor(res.data.gameType, res.data.id) as any);
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen options={{ title: 'Games' }} />
      <FlatList
        contentContainerStyle={{ padding: 16, gap: 12, flexGrow: 1 }}
        data={rooms ?? []}
        keyExtractor={(item: any) => item.id}
        ListHeaderComponent={
          <View style={{ gap: 14, marginBottom: 8 }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              {GAMES.map((g) => (
                <Pressable
                  key={g.type}
                  onPress={() => createRoom(g.type)}
                  disabled={creating}
                  style={{
                    flex: 1,
                    backgroundColor: g.color,
                    borderRadius: radius.lg,
                    padding: 18,
                    alignItems: 'center',
                    gap: 6,
                    opacity: creating ? 0.6 : 1,
                  }}
                >
                  <Text style={{ fontSize: 32 }}>{g.emoji}</Text>
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>New {g.name}</Text>
                </Pressable>
              ))}
            </View>

            <Card style={{ gap: 10 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>Join with a code</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  value={joinCode}
                  onChangeText={(t) => setJoinCode(t.toUpperCase())}
                  placeholder="ABCDE"
                  placeholderTextColor={colors.muted}
                  autoCapitalize="characters"
                  maxLength={5}
                  style={{
                    flex: 1,
                    borderWidth: 1,
                    borderColor: colors.border,
                    borderRadius: radius.md,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    color: colors.text,
                    letterSpacing: 2,
                    fontWeight: '700',
                  }}
                />
                <Button title="Join" onPress={joinByCode} loading={joining} />
              </View>
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>🤖 Play vs Computer</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Solo play — no other players or network needed at all.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="🃏 UNO" variant="outline" onPress={() => setBotPicker('uno')} />
                <Button title="🎲 Ludo" variant="outline" onPress={() => setBotPicker('ludo')} />
              </View>
            </Card>

            <Card style={{ gap: 10 }}>
              <Text style={{ fontWeight: '700', color: colors.text }}>📶 Local WiFi (no internet used)</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>
                Play with people on the same WiFi network — nothing goes through the server.
              </Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <Button title="🃏 Host UNO" variant="outline" onPress={() => hostLocalGame('uno')} />
                <Button title="🎲 Host Ludo" variant="outline" onPress={() => hostLocalGame('ludo')} />
              </View>
              <Button title="📷 Scan to Join" onPress={() => router.push('/(student)/games/scan' as any)} />

              {nearbyGames.length > 0 && (
                <View style={{ gap: 8, marginTop: 4 }}>
                  <Text style={{ fontWeight: '700', color: colors.text, fontSize: 13 }}>
                    Nearby on your network
                  </Text>
                  {nearbyGames.map((g) => {
                    const meta = GAMES.find((x) => x.type === g.g);
                    return (
                      <Pressable
                        key={g.code}
                        onPress={() =>
                          router.push(
                            `/(student)/games/${g.g}/local?role=client&ip=${g.ip}&port=${g.port}&code=${g.code}` as any,
                          )
                        }
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          gap: 10,
                          borderWidth: 1,
                          borderColor: colors.border,
                          borderRadius: radius.md,
                          padding: 10,
                        }}
                      >
                        <Text style={{ fontSize: 20 }}>{meta?.emoji}</Text>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontWeight: '600', color: colors.text, fontSize: 13 }}>
                            {g.hostName}'s {meta?.name}
                          </Text>
                          <Muted>{g.players}/{g.maxPlayers} players · no internet</Muted>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </Card>

            <Text style={{ fontWeight: '800', fontSize: 16, color: colors.text, marginTop: 4 }}>
              Open games in your hostel
            </Text>
          </View>
        }
        ListEmptyComponent={
          isLoading ? (
            <SkeletonList count={3} />
          ) : isError ? (
            <ErrorState onRetry={refetch} />
          ) : (
            <EmptyState emoji="🎮" title="No open games" subtitle="Start one above!" />
          )
        }
        renderItem={({ item }: { item: any }) => {
          const game = GAMES.find((g) => g.type === item.gameType);
          const alreadyIn = item.players.some((p: any) => p.userId === user?.id);
          return (
            <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Text style={{ fontSize: 28 }}>{game?.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '700', color: colors.text }}>
                  {game?.name} · {item.code}
                </Text>
                <Muted>
                  {item.players.map((p: any) => p.user.fullName).join(', ')} ({item.players.length}/{item.maxPlayers})
                </Muted>
              </View>
              <Button
                title={alreadyIn ? 'Rejoin' : 'Join'}
                onPress={() => joinRoom(item)}
                variant={alreadyIn ? 'outline' : 'primary'}
              />
            </Card>
          );
        }}
      />

      <Modal visible={!!botPicker} transparent animationType="fade" onRequestClose={() => setBotPicker(null)}>
        <View style={{ flex: 1, backgroundColor: '#00000055', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, gap: 12 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, textAlign: 'center', color: colors.text }}>
              How many bots?
            </Text>
            <View style={{ flexDirection: 'row', gap: 10, justifyContent: 'center' }}>
              {[1, 2, 3].map((n) => (
                <Pressable
                  key={n}
                  onPress={() => botPicker && startBotGame(botPicker, n)}
                  style={{
                    width: 56,
                    height: 56,
                    borderRadius: 12,
                    backgroundColor: colors.primary + '18',
                    borderWidth: 1,
                    borderColor: colors.primary,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontWeight: '800', fontSize: 18, color: colors.primary }}>{n}</Text>
                </Pressable>
              ))}
            </View>
            <Button title="Cancel" variant="outline" onPress={() => setBotPicker(null)} />
          </View>
        </View>
      </Modal>
    </View>
  );
}
