import { useState } from 'react';
import { ActivityIndicator, Alert, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useGameRoom } from '@/src/hooks/useGameRoom';
import { useLocalGameHost, useLocalGameClient } from '@/src/hooks/useLocalGameRoom';
import { useAuth } from '@/src/stores/auth';
import { UnoCard, parseUnoCard } from '@/src/components/UnoCard';
import { LocalHostQr } from '@/src/components/LocalHostQr';
import { Button } from '@/src/components/ui';
import { ErrorState } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';

const COLOR_HEX: Record<string, string> = {
  red: '#e6392b',
  yellow: '#f2c40f',
  green: '#2ea043',
  blue: '#1b6ec2',
};

export default function UnoGame() {
  const { id, role, ip, port } = useLocalSearchParams<{ id: string; role?: string; ip?: string; port?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [wildPicker, setWildPicker] = useState<string | null>(null);

  const isLocal = id === 'local';
  const isLocalHost = isLocal && role === 'host';
  const isLocalClient = isLocal && role === 'client';

  const online = useGameRoom(!isLocal ? id : undefined);
  const localHost = useLocalGameHost(isLocalHost, 'uno');
  const localClient = useLocalGameClient(isLocalClient, isLocalClient && ip && port ? { ip, port: Number(port) } : null);

  const active = isLocalHost ? localHost : isLocalClient ? localClient : online;
  const { room, loading, error, acting, startGame, makeMove, leaveRoom } = active;
  const connInfo = isLocalHost ? localHost.connInfo : null;

  async function handleLeave() {
    await leaveRoom();
    qc.invalidateQueries({ queryKey: ['game-rooms'] });
    router.replace('/(student)/games');
  }

  if (loading && !room) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (error && !room) {
    return <ErrorState onRetry={() => {}} />;
  }
  if (!room) return null;

  const state = room.state;
  const me = state?.players?.find((p: any) => p.userId === user?.id);
  const myTurn = room.currentTurnUserId === user?.id;

  // ── Waiting room ──
  if (room.status === 'waiting') {
    const isHost = room.hostId === user?.id;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 }}>
        <Stack.Screen options={{ title: 'UNO Lobby' }} />
        <Text style={{ fontSize: 40, textAlign: 'center' }}>🃏</Text>
        <Text style={{ textAlign: 'center', color: colors.muted }}>Room code</Text>
        <Text style={{ textAlign: 'center', fontSize: 36, fontWeight: '900', letterSpacing: 6, color: colors.primary }}>
          {room.code}
        </Text>
        {isLocalHost && connInfo && (
          <LocalHostQr gameType="uno" ip={connInfo.ip} port={connInfo.port} code={connInfo.code} />
        )}
        {isLocalClient && (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}>
            Connected over local WiFi — no internet used.
          </Text>
        )}
        <View style={{ gap: 8 }}>
          {room.players.map((p: any) => (
            <View
              key={p.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                backgroundColor: colors.card,
                padding: 12,
                borderRadius: radius.md,
                borderWidth: 1,
                borderColor: colors.border,
              }}
            >
              <Text style={{ fontSize: 18 }}>{p.userId === room.hostId ? '👑' : '🎮'}</Text>
              <Text style={{ color: colors.text, fontWeight: '600' }}>{p.user.fullName}</Text>
            </View>
          ))}
        </View>
        <Text style={{ textAlign: 'center', color: colors.muted }}>
          {room.players.length}/{room.maxPlayers} players · need 2+ to start
        </Text>
        {isHost ? (
          <Button
            title="Start Game"
            onPress={startGame}
            loading={acting}
            disabled={room.players.length < 2}
          />
        ) : (
          <Text style={{ textAlign: 'center', color: colors.muted }}>Waiting for host to start…</Text>
        )}
        <Button title="Leave" variant="outline" onPress={handleLeave} />
      </View>
    );
  }

  // ── Finished ──
  if (room.status === 'finished') {
    const winner = state?.players?.find((p: any) => p.userId === state?.winnerUserId);
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg, padding: 24, gap: 16 }}>
        <Text style={{ fontSize: 60 }}>{winner?.userId === user?.id ? '🏆' : '🃏'}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
          {winner ? `${winner.name} wins!` : 'Game over'}
        </Text>
        <Button title="Back to Lobby" onPress={handleLeave} />
      </View>
    );
  }

  // ── Playing ──
  const topCard = state.discard[state.discard.length - 1];
  const hand: string[] = me?.hand ?? [];

  async function handlePlay(cardId: string) {
    const { color } = parseUnoCard(cardId);
    if (color === 'wild') {
      setWildPicker(cardId);
      return;
    }
    try {
      await makeMove('play', { cardId });
    } catch (e: any) {
      Alert.alert('Invalid move', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function confirmWild(chosenColor: string) {
    if (!wildPicker) return;
    try {
      await makeMove('play', { cardId: wildPicker, chosenColor });
    } catch (e: any) {
      Alert.alert('Invalid move', e?.response?.data?.message ?? 'Try again.');
    } finally {
      setWildPicker(null);
    }
  }

  async function handleDraw() {
    try {
      await makeMove('draw');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  async function handlePass() {
    try {
      await makeMove('pass');
    } catch (e: any) {
      Alert.alert('Failed', e?.response?.data?.message ?? 'Try again.');
    }
  }

  const others = state.players.filter((p: any) => p.userId !== user?.id);

  return (
    <View style={{ flex: 1, backgroundColor: '#0f4d2e' }}>
      <Stack.Screen options={{ title: 'UNO', headerRight: () => (
        <Pressable onPress={handleLeave} style={{ paddingHorizontal: 8 }}>
          <Text style={{ color: colors.danger, fontWeight: '700' }}>Leave</Text>
        </Pressable>
      ) }} />

      {/* Opponents */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16, paddingTop: 16, paddingHorizontal: 12 }}>
        {others.map((p: any) => (
          <View key={p.userId} style={{ alignItems: 'center', gap: 4 }}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: room.currentTurnUserId === p.userId ? '#fff' : 'rgba(255,255,255,0.15)',
              }}
            >
              <Text style={{ fontWeight: '700', fontSize: 12, color: room.currentTurnUserId === p.userId ? '#0f4d2e' : '#fff' }}>
                {p.name}
              </Text>
            </View>
            <View style={{ flexDirection: 'row' }}>
              {Array.from({ length: Math.min(p.handCount ?? 0, 6) }).map((_, i) => (
                <View key={i} style={{ marginLeft: i === 0 ? 0 : -22 }}>
                  <UnoCard cardId="" faceDown size="sm" />
                </View>
              ))}
            </View>
            <Text style={{ color: '#fff', fontSize: 11 }}>{p.handCount} cards</Text>
          </View>
        ))}
      </View>

      {/* Center: draw + discard */}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 24, flexDirection: 'row' }}>
        <Pressable onPress={handleDraw} disabled={!myTurn || state.turnPhase === 'drew'}>
          <UnoCard cardId="" faceDown size="lg" disabled={!myTurn || state.turnPhase === 'drew'} />
        </Pressable>
        <View style={{ alignItems: 'center', gap: 8 }}>
          <UnoCard cardId={topCard} size="lg" />
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: COLOR_HEX[state.currentColor],
              borderWidth: 2,
              borderColor: '#fff',
            }}
          />
        </View>
      </View>

      {/* Turn banner */}
      <View style={{ alignItems: 'center', paddingBottom: 6 }}>
        <Text style={{ color: '#fff', fontWeight: '700' }}>
          {myTurn
            ? state.turnPhase === 'drew'
              ? 'Play the drawn card or pass'
              : 'Your turn — play a card or draw'
            : `Waiting for ${state.players[state.currentPlayerIndex]?.name}…`}
        </Text>
        {myTurn && state.turnPhase === 'drew' && (
          <Pressable onPress={handlePass} style={{ marginTop: 6, paddingHorizontal: 16, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.2)', borderRadius: 999 }}>
            <Text style={{ color: '#fff', fontWeight: '700' }}>Pass turn</Text>
          </Pressable>
        )}
      </View>

      {/* My hand */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 20, alignItems: 'flex-end' }}
        style={{ backgroundColor: 'rgba(0,0,0,0.15)', paddingTop: 12 }}
      >
        {hand.map((cardId, i) => (
          <View key={cardId} style={{ marginLeft: i === 0 ? 0 : -18 }}>
            <UnoCard cardId={cardId} size="md" onPress={() => handlePlay(cardId)} disabled={!myTurn} />
          </View>
        ))}
      </ScrollView>

      {/* Wild color picker */}
      <Modal visible={!!wildPicker} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: '#000000aa', alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ backgroundColor: colors.card, borderRadius: radius.lg, padding: 20, gap: 12, width: 260 }}>
            <Text style={{ fontWeight: '800', fontSize: 16, textAlign: 'center', color: colors.text }}>
              Choose a color
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' }}>
              {Object.entries(COLOR_HEX).map(([c, hex]) => (
                <Pressable
                  key={c}
                  onPress={() => confirmWild(c)}
                  style={{ width: 60, height: 60, borderRadius: 12, backgroundColor: hex, alignItems: 'center', justifyContent: 'center' }}
                >
                  <Text style={{ color: '#fff', fontWeight: '800', fontSize: 11, textTransform: 'uppercase' }}>{c}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
