import { useEffect, useRef, useState } from 'react';
import dgram from 'react-native-udp';
import { DISCOVERY_UDP_PORT, DISCOVERY_PROTO, DISCOVERY_STALE_MS } from '../lib/localGame/constants';

export interface DiscoveredGame {
  g: 'uno' | 'ludo';
  ip: string;
  port: number;
  code: string;
  hostName: string;
  players: number;
  maxPlayers: number;
  lastSeen: number;
}

/** Listens for LocalGameHost broadcasts on the local network — zero backend calls. */
export function useLocalGameDiscovery(enabled: boolean) {
  const [games, setGames] = useState<Record<string, DiscoveredGame>>({});
  const socketRef = useRef<any>(null);

  useEffect(() => {
    if (!enabled) {
      setGames({});
      return;
    }
    let socket: any;
    try {
      socket = dgram.createSocket({ type: 'udp4', reusePort: true });
      socketRef.current = socket;
      socket.bind(DISCOVERY_UDP_PORT);
      socket.on('message', (msg: any) => {
        try {
          const data = JSON.parse(msg.toString());
          if (data.proto !== DISCOVERY_PROTO) return;
          setGames((prev) => ({ ...prev, [data.code]: { ...data, lastSeen: Date.now() } }));
        } catch {}
      });
    } catch {
      // Discovery unavailable (e.g. port in use) — QR/manual IP still works.
    }

    const pruneTimer = setInterval(() => {
      setGames((prev) => {
        const now = Date.now();
        const next: Record<string, DiscoveredGame> = {};
        for (const [k, v] of Object.entries(prev)) {
          if (now - v.lastSeen <= DISCOVERY_STALE_MS) next[k] = v;
        }
        return next;
      });
    }, 1000);

    return () => {
      clearInterval(pruneTimer);
      try {
        socket?.close();
      } catch {}
      socketRef.current = null;
    };
  }, [enabled]);

  return Object.values(games);
}
