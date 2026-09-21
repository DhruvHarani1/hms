import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';

const POLL_INTERVAL = 1500;

export function useGameRoom(roomId: string | undefined) {
  const [room, setRoom] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const mounted = useRef(true);

  const fetchRoom = useCallback(async () => {
    if (!roomId) return;
    try {
      const res = await api.get(`/games/rooms/${roomId}`);
      if (mounted.current) {
        setRoom(res.data);
        setError(null);
      }
    } catch (e: any) {
      if (mounted.current) setError(e?.response?.data?.message ?? 'Failed to load game.');
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, [roomId]);

  useEffect(() => {
    mounted.current = true;
    setLoading(true);
    fetchRoom();
    const timer = setInterval(fetchRoom, POLL_INTERVAL);
    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [fetchRoom]);

  const startGame = useCallback(async () => {
    if (!roomId) return;
    setActing(true);
    try {
      const res = await api.post(`/games/rooms/${roomId}/start`);
      setRoom(res.data);
    } finally {
      setActing(false);
    }
  }, [roomId]);

  const makeMove = useCallback(
    async (action: string, payload?: Record<string, any>) => {
      if (!roomId) return;
      setActing(true);
      try {
        const res = await api.post(`/games/rooms/${roomId}/move`, { action, payload });
        setRoom(res.data);
      } finally {
        setActing(false);
      }
    },
    [roomId],
  );

  const leaveRoom = useCallback(async () => {
    if (!roomId) return;
    await api.post(`/games/rooms/${roomId}/leave`).catch(() => {});
  }, [roomId]);

  return { room, loading, error, acting, startGame, makeMove, leaveRoom, refresh: fetchRoom };
}
