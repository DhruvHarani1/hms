import { useCallback, useEffect, useRef, useState } from 'react';
import { LocalGameHost } from '../lib/localGame/LocalGameHost';
import { LocalGameClient } from '../lib/localGame/LocalGameClient';
import { GameType } from '../lib/gameEngines/dispatch';
import { useAuth } from '../stores/auth';

/** Host a local-WiFi game on this device. No backend calls at all. */
export function useLocalGameHost(enabled: boolean, gameType: GameType | null) {
  const user = useAuth((s) => s.user);
  const [room, setRoom] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [connInfo, setConnInfo] = useState<{ ip: string; port: number; code: string } | null>(null);
  const hostRef = useRef<LocalGameHost | null>(null);

  useEffect(() => {
    if (!enabled || !gameType || !user) return;
    let cancelled = false;

    const host = new LocalGameHost(
      gameType,
      { userId: user.id, name: user.fullName, avatarUrl: undefined },
      (r) => {
        if (!cancelled) setRoom(r);
      },
    );
    hostRef.current = host;

    (async () => {
      try {
        const { ip, port, code } = await host.start();
        if (!cancelled) {
          setConnInfo({ ip, port, code });
          setLoading(false);
        }
      } catch (e: any) {
        if (!cancelled) {
          setError(e?.message ?? 'Could not start local game.');
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      host.leave();
      hostRef.current = null;
    };
  }, [enabled, gameType, user?.id]);

  const startGame = useCallback(async () => {
    setActing(true);
    try {
      hostRef.current?.startGame();
    } finally {
      setActing(false);
    }
  }, []);

  const makeMove = useCallback(async (action: string, payload?: Record<string, any>) => {
    setActing(true);
    try {
      hostRef.current?.makeMove(action, payload);
    } finally {
      setActing(false);
    }
  }, []);

  const leaveRoom = useCallback(async () => {
    hostRef.current?.leave();
  }, []);

  return { room, loading, error, acting, startGame, makeMove, leaveRoom, connInfo };
}

/** Join a local-WiFi game hosted by another phone on the same network. */
export function useLocalGameClient(enabled: boolean, conn: { ip: string; port: number } | null) {
  const user = useAuth((s) => s.user);
  const [room, setRoom] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const clientRef = useRef<LocalGameClient | null>(null);

  useEffect(() => {
    if (!enabled || !conn || !user) return;
    let cancelled = false;

    const client = new LocalGameClient();
    clientRef.current = client;

    client
      .connect(
        conn.ip,
        conn.port,
        { userId: user.id, name: user.fullName, avatarUrl: undefined },
        (r) => {
          if (!cancelled) {
            setRoom(r);
            setLoading(false);
          }
        },
        (message) => {
          if (!cancelled) {
            setError(message);
            setLoading(false);
          }
        },
      )
      .catch((e) => {
        if (!cancelled) {
          setError(e?.message ?? 'Could not connect to host.');
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
      client.leave();
      clientRef.current = null;
    };
  }, [enabled, conn?.ip, conn?.port, user?.id]);

  const startGame = useCallback(async () => {
    throw new Error('Only the host can start the game.');
  }, []);

  const makeMove = useCallback(async (action: string, payload?: Record<string, any>) => {
    setActing(true);
    try {
      await clientRef.current?.makeMove(action, payload);
    } finally {
      setActing(false);
    }
  }, []);

  const leaveRoom = useCallback(async () => {
    clientRef.current?.leave();
  }, []);

  return { room, loading, error, acting, startGame, makeMove, leaveRoom };
}
