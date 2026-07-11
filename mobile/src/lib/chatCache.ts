import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local chat cache using AsyncStorage (hybrid approach).
 * Server is the source of truth (30-day retention).
 * This cache provides instant loading + offline reading.
 *
 * Keys:
 *   chat_convos         → cached conversation list
 *   chat_msgs_{convId}  → cached messages for a conversation
 *
 * Image caching: React Native's built-in Image component caches downloaded
 * images automatically. We store the signed URL in the message cache so
 * images load from the OS-level image cache when offline.
 */

export interface CachedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  type: 'text' | 'image';
  content: string;
  imageUrl: string | null;
  createdAt: string;
}

export interface CachedConversation {
  id: string;
  type: 'direct' | 'group';
  name: string;
  avatarUrl: string | null;
  members: { id: string; fullName: string; avatarUrl: string | null; role: string }[];
  lastMessage: {
    id: string;
    senderId: string;
    senderName: string;
    type: string;
    content: string;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
}

const CONVOS_KEY = 'chat_convos';
const msgsKey = (convId: string) => `chat_msgs_${convId}`;

// ─── Conversations ─────────────────────────────

export async function getCachedConversations(): Promise<CachedConversation[]> {
  try {
    const raw = await AsyncStorage.getItem(CONVOS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setCachedConversations(convos: CachedConversation[]) {
  try {
    await AsyncStorage.setItem(CONVOS_KEY, JSON.stringify(convos));
  } catch {}
}

// ─── Messages ──────────────────────────────────

export async function getCachedMessages(conversationId: string): Promise<CachedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(msgsKey(conversationId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function setCachedMessages(conversationId: string, messages: CachedMessage[]) {
  try {
    // Keep only latest 200 messages per conversation in cache (prevent bloat).
    const trimmed = messages.slice(-200);
    await AsyncStorage.setItem(msgsKey(conversationId), JSON.stringify(trimmed));
  } catch {}
}

export async function appendCachedMessages(conversationId: string, newMessages: CachedMessage[]) {
  if (newMessages.length === 0) return;
  const existing = await getCachedMessages(conversationId);
  const existingIds = new Set(existing.map((m) => m.id));
  const deduped = newMessages.filter((m) => !existingIds.has(m.id));
  if (deduped.length === 0) return;
  await setCachedMessages(conversationId, [...existing, ...deduped]);
}

export function getLastCachedMessageId(messages: CachedMessage[]): string | undefined {
  return messages.length > 0 ? messages[messages.length - 1].id : undefined;
}

// ─── Clear ─────────────────────────────────────

/** Clear all chat cache (e.g. on logout). */
export async function clearChatCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const chatKeys = keys.filter((k) => k.startsWith('chat_'));
    if (chatKeys.length > 0) await AsyncStorage.multiRemove(chatKeys);
  } catch {}
}
