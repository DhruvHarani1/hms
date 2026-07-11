import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import {
  CachedMessage,
  CachedConversation,
  getCachedConversations,
  setCachedConversations,
  getCachedMessages,
  appendCachedMessages,
  getLastCachedMessageId,
} from '../lib/chatCache';

const POLL_INTERVAL = 3000;

// ─── Conversations list hook ──────────────────

export function useChatConversations() {
  const [conversations, setConversations] = useState<CachedConversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadTotal, setUnreadTotal] = useState(0);
  const mounted = useRef(true);

  const fetchConversations = useCallback(async () => {
    try {
      const [convRes, unreadRes] = await Promise.all([
        api.get('/chat/conversations'),
        api.get('/chat/unread'),
      ]);
      if (!mounted.current) return;
      const convos = convRes.data as CachedConversation[];
      const unread = unreadRes.data as { total: number; perConversation: Record<string, number> };

      // Merge unread counts.
      const merged = convos.map((c) => ({
        ...c,
        unreadCount: unread.perConversation[c.id] ?? 0,
      }));

      setConversations(merged);
      setUnreadTotal(unread.total);
      setCachedConversations(merged);
    } catch {
      // On error, use cache.
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;

    // Load cache first for instant display.
    getCachedConversations().then((cached) => {
      if (mounted.current && cached.length > 0) {
        setConversations(cached);
        setLoading(false);
      }
    });

    // Then fetch fresh data + start polling.
    fetchConversations();
    const timer = setInterval(fetchConversations, POLL_INTERVAL * 3); // poll conversations slower (9s)

    return () => {
      mounted.current = false;
      clearInterval(timer);
    };
  }, [fetchConversations]);

  return { conversations, loading, unreadTotal, refresh: fetchConversations };
}

// ─── Messages hook (for a single conversation) ──────────────────

export function useChatMessages(conversationId: string) {
  const [messages, setMessages] = useState<CachedMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);
  const lastIdRef = useRef<string | undefined>();

  // Load cached messages on mount.
  useEffect(() => {
    mounted.current = true;

    getCachedMessages(conversationId).then((cached) => {
      if (mounted.current) {
        setMessages(cached);
        lastIdRef.current = getLastCachedMessageId(cached);
        setLoading(false);
      }
    });

    return () => { mounted.current = false; };
  }, [conversationId]);

  // Poll for new messages.
  useEffect(() => {
    let timer: ReturnType<typeof setInterval>;

    const poll = async () => {
      try {
        const params: any = { limit: 50 };
        if (lastIdRef.current) params.after = lastIdRef.current;

        const res = await api.get(`/chat/conversations/${conversationId}/messages`, { params });
        const newMsgs = res.data as CachedMessage[];

        if (newMsgs.length > 0 && mounted.current) {
          setMessages((prev) => {
            const existingIds = new Set(prev.map((m) => m.id));
            const deduped = newMsgs.filter((m) => !existingIds.has(m.id));
            if (deduped.length === 0) return prev;
            const updated = [...prev, ...deduped];
            lastIdRef.current = updated[updated.length - 1].id;
            return updated;
          });

          // Cache in background.
          appendCachedMessages(conversationId, newMsgs);
        }
      } catch {}
    };

    // Initial fetch.
    poll().then(() => {
      if (mounted.current) setLoading(false);
    });

    timer = setInterval(poll, POLL_INTERVAL);

    return () => clearInterval(timer);
  }, [conversationId]);

  // Mark as read whenever messages change.
  useEffect(() => {
    if (messages.length > 0) {
      api.patch(`/chat/conversations/${conversationId}/read`).catch(() => {});
    }
  }, [conversationId, messages.length]);

  // Send message function.
  const sendMessage = useCallback(
    async (content: string, type: 'text' | 'image' = 'text') => {
      const res = await api.post(`/chat/conversations/${conversationId}/messages`, {
        content,
        type,
      });
      const msg = res.data as CachedMessage;

      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        const updated = [...prev, msg];
        lastIdRef.current = msg.id;
        return updated;
      });

      appendCachedMessages(conversationId, [msg]);
      return msg;
    },
    [conversationId],
  );

  return { messages, loading, sendMessage };
}

// ─── Unread badge hook (lightweight, for header icon) ──────────────────

export function useChatUnread() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let mounted = true;

    const poll = async () => {
      try {
        const res = await api.get('/chat/unread');
        if (mounted) setCount(res.data.total ?? 0);
      } catch {}
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL * 3);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  return count;
}
