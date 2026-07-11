import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * Encrypted file-based chat storage.
 *
 * Messages and conversations are stored as encrypted JSON files in the
 * app's document directory (persistent across app updates, not cleared by OS).
 *
 * Encryption: XOR cipher with a 256-char random key stored in expo-secure-store.
 * This prevents casual reading of chat files on rooted devices.
 *
 * Structure:
 *   {documentDirectory}/chat/
 *     convos.enc          → encrypted conversation list
 *     msgs_{convId}.enc   → encrypted messages per conversation
 *     img_{hash}.jpg      → cached chat images
 */

const CHAT_DIR_NAME = 'chat';
const KEY_STORE_ID = 'chat_encryption_key';
const CONVOS_FILE = 'convos.enc';
const msgsFile = (convId: string) => `msgs_${convId}.enc`;

let chatDir: string = '';
let encKey: string = '';

// ─── Init ──────────────────────────────────────

async function ensureInit() {
  if (chatDir && encKey) return;

  // Set up directory.
  chatDir = `${FileSystem.documentDirectory}${CHAT_DIR_NAME}/`;
  const dirInfo = await FileSystem.getInfoAsync(chatDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(chatDir, { intermediates: true });
  }

  // Set up encryption key.
  let key = await SecureStore.getItemAsync(KEY_STORE_ID);
  if (!key) {
    // Generate a random 256-char key on first use.
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    key = Array.from({ length: 256 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    await SecureStore.setItemAsync(KEY_STORE_ID, key);
  }
  encKey = key;
}

// ─── Encryption ────────────────────────────────

function encrypt(plaintext: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < plaintext.length; i++) {
    bytes.push(plaintext.charCodeAt(i) ^ encKey.charCodeAt(i % encKey.length));
  }
  // Encode as base64-safe string.
  return btoa(String.fromCharCode(...bytes));
}

function decrypt(ciphertext: string): string {
  const raw = atob(ciphertext);
  const chars: string[] = [];
  for (let i = 0; i < raw.length; i++) {
    chars.push(String.fromCharCode(raw.charCodeAt(i) ^ encKey.charCodeAt(i % encKey.length)));
  }
  return chars.join('');
}

// ─── File Helpers ──────────────────────────────

async function writeEncrypted(filename: string, data: any) {
  await ensureInit();
  const json = JSON.stringify(data);
  const encrypted = encrypt(json);
  await FileSystem.writeAsStringAsync(chatDir + filename, encrypted);
}

async function readEncrypted<T>(filename: string): Promise<T | null> {
  await ensureInit();
  try {
    const path = chatDir + filename;
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    const encrypted = await FileSystem.readAsStringAsync(path);
    const json = decrypt(encrypted);
    return JSON.parse(json) as T;
  } catch {
    return null;
  }
}

// ─── Types ─────────────────────────────────────

export interface CachedMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatar: string | null;
  type: 'text' | 'image';
  content: string;
  imageUrl: string | null;
  localImagePath?: string;
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

// ─── Conversations ─────────────────────────────

export async function getCachedConversations(): Promise<CachedConversation[]> {
  return (await readEncrypted<CachedConversation[]>(CONVOS_FILE)) ?? [];
}

export async function setCachedConversations(convos: CachedConversation[]) {
  await writeEncrypted(CONVOS_FILE, convos);
}

// ─── Messages ──────────────────────────────────

export async function getCachedMessages(conversationId: string): Promise<CachedMessage[]> {
  return (await readEncrypted<CachedMessage[]>(msgsFile(conversationId))) ?? [];
}

export async function setCachedMessages(conversationId: string, messages: CachedMessage[]) {
  // Keep only latest 200 messages per conversation (prevent bloat).
  const trimmed = messages.slice(-200);
  await writeEncrypted(msgsFile(conversationId), trimmed);
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

// ─── Image Caching ─────────────────────────────

const IMG_DIR_NAME = 'chat/images/';

async function ensureImgDir() {
  await ensureInit();
  const imgDir = `${FileSystem.documentDirectory}${IMG_DIR_NAME}`;
  const info = await FileSystem.getInfoAsync(imgDir);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(imgDir, { intermediates: true });
  }
  return imgDir;
}

/** Download a chat image to local storage. Returns the local file URI. */
export async function cacheImage(remoteUrl: string, messageId: string): Promise<string | null> {
  try {
    const imgDir = await ensureImgDir();
    const localPath = `${imgDir}${messageId}.jpg`;

    // Check if already cached.
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return localPath;

    // Download.
    const result = await FileSystem.downloadAsync(remoteUrl, localPath);
    return result.status === 200 ? localPath : null;
  } catch {
    return null;
  }
}

/** Get cached local path for an image (without downloading). */
export async function getCachedImagePath(messageId: string): Promise<string | null> {
  try {
    const imgDir = `${FileSystem.documentDirectory}${IMG_DIR_NAME}`;
    const localPath = `${imgDir}${messageId}.jpg`;
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists ? localPath : null;
  } catch {
    return null;
  }
}

// ─── Clear ─────────────────────────────────────

/** Clear all chat storage (e.g. on logout). */
export async function clearChatCache() {
  await ensureInit();
  try {
    const info = await FileSystem.getInfoAsync(chatDir);
    if (info.exists) {
      await FileSystem.deleteAsync(chatDir, { idempotent: true });
    }
  } catch {}
}

/** Get the chat storage directory path (for debugging). */
export function getChatStoragePath(): string {
  return `${FileSystem.documentDirectory}${CHAT_DIR_NAME}/`;
}
