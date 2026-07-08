import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { api } from '@/src/lib/api';
import { useAuth } from '@/src/stores/auth';

/**
 * Tracks how long the app is in the FOREGROUND for the logged-in user and
 * flushes accumulated active seconds to the backend every ~60s (and when the
 * app backgrounds). Cross-platform: RN AppState covers native; on web it maps
 * to tab visibility. Cheap: one small request per active minute.
 */
const FLUSH_MS = 60_000;

export function useUsageTracker() {
  const user = useAuth((s) => s.user);
  const activeSince = useRef<number | null>(null);
  const pending = useRef(0); // seconds accumulated but not yet sent

  useEffect(() => {
    if (!user) return;

    const now = () => Date.now();
    activeSince.current =
      AppState.currentState === 'active' ? now() : null;

    function accumulate() {
      if (activeSince.current != null) {
        pending.current += Math.floor((now() - activeSince.current) / 1000);
        activeSince.current = now();
      }
    }

    async function flush() {
      accumulate();
      const secs = pending.current;
      if (secs <= 0) return;
      pending.current = 0;
      try {
        await api.post('/usage/heartbeat', { seconds: Math.min(secs, 600) });
      } catch {
        // put it back on failure (best-effort, capped)
        pending.current = Math.min(pending.current + secs, 3600);
      }
    }

    const onState = (next: AppStateStatus) => {
      if (next === 'active') {
        activeSince.current = now();
      } else {
        accumulate();
        activeSince.current = null;
        flush();
      }
    };

    const sub = AppState.addEventListener('change', onState);
    const interval = setInterval(flush, FLUSH_MS);

    return () => {
      accumulate();
      flush();
      clearInterval(interval);
      sub.remove();
    };
  }, [user]);
}
