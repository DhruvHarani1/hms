import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Animated, Image, Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useGameRoom } from '@/src/hooks/useGameRoom';
import { useLocalGameHost, useLocalGameClient, useBotGameRoom } from '@/src/hooks/useLocalGameRoom';
import { useAuth } from '@/src/stores/auth';
import { LudoBoard } from '@/src/components/LudoBoard';
import { LocalHostQr } from '@/src/components/LocalHostQr';
import { Confetti } from '@/src/components/Confetti';
import { Button } from '@/src/components/ui';
import { ErrorState } from '@/src/components/primitives';
import { colors, radius } from '@/src/lib/theme';
import { playSound } from '@/src/lib/gameSounds';

const COLOR_HEX: Record<string, string> = {
  red: '#e6392b',
  green: '#2ea043',
  yellow: '#f2c40f',
  blue: '#1b6ec2',
};

const DICE_IMAGES: Record<number, any> = {
  1: require('../../../../assets/games/dice/dice-1.png'),
  2: require('../../../../assets/games/dice/dice-2.png'),
  3: require('../../../../assets/games/dice/dice-3.png'),
  4: require('../../../../assets/games/dice/dice-4.png'),
  5: require('../../../../assets/games/dice/dice-5.png'),
  6: require('../../../../assets/games/dice/dice-6.png'),
};

export default function LudoGame() {
  const { id, role, ip, port, bots } = useLocalSearchParams<{ id: string; role?: string; ip?: string; port?: string; bots?: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const { user } = useAuth();

  const isLocal = id === 'local';
  const isBot = id === 'bot';
  const isLocalHost = isLocal && role === 'host';
  const isLocalClient = isLocal && role === 'client';

  const online = useGameRoom(!isLocal && !isBot ? id : undefined);
  const localHost = useLocalGameHost(isLocalHost, 'ludo');
  const localClient = useLocalGameClient(isLocalClient, isLocalClient && ip && port ? { ip, port: Number(port) } : null);
  const botGame = useBotGameRoom(isBot, 'ludo', bots ? Number(bots) : 1);

  const active = isBot ? botGame : isLocalHost ? localHost : isLocalClient ? localClient : online;
  const { room, loading, error, acting, startGame, makeMove, leaveRoom } = active;
  const connInfo = isLocalHost ? localHost.connInfo : null;
  const state = room?.state;

  // ── Dice roll animation state (must be unconditional — before any early return) ──
  const [isRolling, setIsRolling] = useState(false);
  const [displayFace, setDisplayFace] = useState(1);
  const spin = useRef(new Animated.Value(0)).current;
  const prevLogRef = useRef<string | undefined>(undefined);
  const prevStatusRef = useRef<string | undefined>(undefined);

  // Reactively play move/capture/win sounds whenever the shared game log advances.
  useEffect(() => {
    const latest = state?.log?.[0];
    if (latest && latest !== prevLogRef.current) {
      if (prevLogRef.current !== undefined) {
        if (latest.includes('Captured')) playSound('capture');
        else if (latest.includes('moved a token')) playSound('tokenMove');
      }
      prevLogRef.current = latest;
    }
  }, [state?.log?.[0]]);

  useEffect(() => {
    if (room?.status === 'finished' && prevStatusRef.current !== 'finished') {
      playSound('win');
    }
    prevStatusRef.current = room?.status;
  }, [room?.status]);

  async function handleLeave() {
    await leaveRoom();
    qc.invalidateQueries({ queryKey: ['game-rooms'] });
    router.replace('/(student)/games');
  }

  async function handleRoll() {
    setIsRolling(true);
    playSound('diceRoll');
    Animated.loop(Animated.timing(spin, { toValue: 1, duration: 250, useNativeDriver: true })).start();
    const rollInterval = setInterval(() => setDisplayFace(1 + Math.floor(Math.random() * 6)), 90);
    try {
      await Promise.all([makeMove('roll'), new Promise((res) => setTimeout(res, 550))]);
    } catch {
    } finally {
      clearInterval(rollInterval);
      spin.stopAnimation();
      spin.setValue(0);
      setIsRolling(false);
    }
  }

  async function handleTokenPress(tokenIndex: number) {
    try {
      await makeMove('move', { tokenIndex });
    } catch {}
  }

  if (loading && !room) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }
  if (error && !room) return <ErrorState onRetry={() => {}} />;
  if (!room) return null;

  // ── Waiting room ──
  if (room.status === 'waiting') {
    const isHost = room.hostId === user?.id;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 20, gap: 16 }}>
        <Stack.Screen options={{ title: 'Ludo Lobby' }} />
        <Text style={{ fontSize: 40, textAlign: 'center' }}>🎲</Text>
        <Text style={{ textAlign: 'center', color: colors.muted }}>Room code</Text>
        <Text style={{ textAlign: 'center', fontSize: 36, fontWeight: '900', letterSpacing: 6, color: colors.primary }}>
          {room.code}
        </Text>
        {isLocalHost && connInfo && (
          <LocalHostQr gameType="ludo" ip={connInfo.ip} port={connInfo.port} code={connInfo.code} />
        )}
        {isLocalClient && (
          <Text style={{ textAlign: 'center', color: colors.muted, fontSize: 12 }}>
            Connected over local WiFi — no internet used.
          </Text>
        )}
        <View style={{ gap: 8 }}>
          {room.players.map((p: any, i: number) => (
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
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: COLOR_HEX[['red', 'green', 'yellow', 'blue'][i]] }} />
              <Text style={{ color: colors.text, fontWeight: '600' }}>{p.user.fullName}</Text>
              {p.userId === room.hostId && <Text>👑</Text>}
            </View>
          ))}
        </View>
        <Text style={{ textAlign: 'center', color: colors.muted }}>
          {room.players.length}/{room.maxPlayers} players · need 2+ to start
        </Text>
        {isHost ? (
          <Button title="Start Game" onPress={startGame} loading={acting} disabled={room.players.length < 2} />
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
        {winner?.userId === user?.id && <Confetti />}
        <Text style={{ fontSize: 60 }}>{winner?.userId === user?.id ? '🏆' : '🎲'}</Text>
        <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' }}>
          {winner ? `${winner.name} (${winner.color}) wins!` : 'Game over'}
        </Text>
        <Button title="Back to Lobby" onPress={handleLeave} />
      </View>
    );
  }

  // ── Playing ──
  const myTurn = room.currentTurnUserId === user?.id;
  const me = state.players.find((p: any) => p.userId === user?.id);
  const currentPlayer = state.players[state.currentPlayerIndex];
  const shownFace = isRolling ? displayFace : state.diceValue;
  const spinDeg = spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Stack.Screen
        options={{
          title: 'Ludo',
          headerRight: () => (
            <Pressable onPress={handleLeave} style={{ paddingHorizontal: 8 }}>
              <Text style={{ color: colors.danger, fontWeight: '700' }}>Leave</Text>
            </Pressable>
          ),
        }}
      />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10, padding: 12 }}>
        {state.players.map((p: any) => (
          <View
            key={p.userId}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingHorizontal: 10,
              paddingVertical: 6,
              borderRadius: 999,
              backgroundColor: currentPlayer.userId === p.userId ? COLOR_HEX[p.color] + '33' : colors.card,
              borderWidth: currentPlayer.userId === p.userId ? 2 : 1,
              borderColor: currentPlayer.userId === p.userId ? COLOR_HEX[p.color] : colors.border,
            }}
          >
            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: COLOR_HEX[p.color] }} />
            <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{p.name}</Text>
          </View>
        ))}
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LudoBoard
          players={state.players}
          legalMoveTokens={myTurn && state.turnPhase === 'move' ? state.legalMoves : []}
          currentPlayerColor={myTurn ? me?.color ?? null : null}
          onTokenPress={handleTokenPress}
        />
      </View>

      <View style={{ alignItems: 'center', paddingBottom: 24, gap: 10 }}>
        <Text style={{ fontWeight: '700', color: colors.text }}>
          {myTurn
            ? state.turnPhase === 'roll'
              ? 'Your turn — roll the dice'
              : 'Tap a highlighted token to move it'
            : `Waiting for ${currentPlayer.name}…`}
        </Text>

        {myTurn && state.turnPhase === 'roll' && (
          <Pressable onPress={handleRoll} disabled={acting || isRolling}>
            <Animated.View
              style={{
                width: 68,
                height: 68,
                borderRadius: 14,
                backgroundColor: colors.card,
                borderWidth: 2,
                borderColor: COLOR_HEX[me?.color ?? 'red'],
                alignItems: 'center',
                justifyContent: 'center',
                transform: [{ rotate: spinDeg }],
              }}
            >
              <Image
                source={DICE_IMAGES[shownFace ?? 1]}
                style={{ width: 48, height: 48 }}
                resizeMode="contain"
              />
            </Animated.View>
          </Pressable>
        )}
        {state.diceValue && state.turnPhase === 'move' && (
          <Image source={DICE_IMAGES[state.diceValue]} style={{ width: 52, height: 52 }} resizeMode="contain" />
        )}
      </View>
    </View>
  );
}
