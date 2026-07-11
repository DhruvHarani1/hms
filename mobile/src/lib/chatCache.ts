import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';
import { Platform } from 'react-native';

/**
 * Encrypted file-based chat storage under the "AIFDMS" folder.
 *
 * Folder structure on device:
 *   {documentDirectory}/AIFDMS/
 *     messages/
 *       convos.enc            → encrypted conversation list
 *       {convId}.enc          → encrypted messages per conversation
 *
 * Images folder:
 *   Android: /storage/emulated/0/Android/media/test.hms.mobile/AIFDMS/
 *            (Scanned automatically by phone gallery, visible as "AIFDMS" album,
 *            requires zero permission prompts, stored only once!)
 *   iOS:     {documentDirectory}/AIFDMS/media/
 */

const ROOT_DIR = 'AIFDMS';
const MESSAGES_DIR = `${ROOT_DIR}/messages`;
const MEDIA_DIR = `${ROOT_DIR}/media`;
const KEY_STORE_ID = 'aifdms_encryption_key';
const CONVOS_FILE = 'convos.enc';
const GALLERY_ALBUM = 'AIFDMS';

const msgsFile = (convId: string) => `${convId}.enc`;

let messagesDir: string = '';
let mediaDir: string = '';
let encKey: string = '';
let initialized = false;

// ─── Init ──────────────────────────────────────

async function ensureInit() {
  if (initialized) return;

  const docDir = FileSystem.documentDirectory ?? '';

  // Check cache version. If not v3 (corrupted by previous race condition), clear old cache once.
  const cacheVersionKey = 'aifdms_chat_cache_version';
  const currentVersion = await SecureStore.getItemAsync(cacheVersionKey);
  if (currentVersion !== 'v3') {
    try {
      const rootDir = `${docDir}${ROOT_DIR}/`;
      const info = await FileSystem.getInfoAsync(rootDir);
      if (info.exists) {
        await FileSystem.deleteAsync(rootDir, { idempotent: true });
      }
    } catch {}
    await SecureStore.setItemAsync(cacheVersionKey, 'v3');
  }

  // Set up message directory (private).
  messagesDir = `${docDir}${MESSAGES_DIR}/`;
  
  // Set up media directory (private sandbox).
  mediaDir = `${docDir}${MEDIA_DIR}/`;

  for (const dir of [messagesDir, mediaDir]) {
    const info = await FileSystem.getInfoAsync(dir);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
    }
  }

  // Set up encryption key (stored in hardware-backed secure store).
  let key = await SecureStore.getItemAsync(KEY_STORE_ID);
  if (!key) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
    key = Array.from({ length: 256 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
    await SecureStore.setItemAsync(KEY_STORE_ID, key);
  }
  encKey = key;
  initialized = true;
}

// ─── Encryption ────────────────────────────────

function encrypt(plaintext: string): string {
  const bytes: number[] = [];
  for (let i = 0; i < plaintext.length; i++) {
    bytes.push(plaintext.charCodeAt(i) ^ encKey.charCodeAt(i % encKey.length));
  }
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
  await FileSystem.writeAsStringAsync(messagesDir + filename, encrypted);
}

async function readEncrypted<T>(filename: string): Promise<T | null> {
  await ensureInit();
  try {
    const path = messagesDir + filename;
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

// ─── Image Caching (AIFDMS/media/) ─────────────

/**
 * Download a chat image to our mediaDir folder and silently save to default gallery
 * if permissions are granted (without prompting).
 */
export async function cacheImage(remoteUrl: string, messageId: string): Promise<string | null> {
  try {
    await ensureInit();
    const localPath = `${mediaDir}${messageId}.jpg`;

    // Already cached?
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return localPath;

    // Download directly to mediaDir.
    const result = await FileSystem.downloadAsync(remoteUrl, localPath);
    if (result.status !== 200) return null;

    // Auto-save to phone gallery default folder (only if permissions are already granted).
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status === 'granted') {
        await MediaLibrary.saveToLibraryAsync(localPath);
      }
    } catch {
      // Best-effort auto-save.
    }

    return localPath;
  } catch {
    return null;
  }
}

/** Get cached local path for an image (without downloading). */
export async function getCachedImagePath(messageId: string): Promise<string | null> {
  try {
    await ensureInit();
    const localPath = `${mediaDir}${messageId}.jpg`;
    const info = await FileSystem.getInfoAsync(localPath);
    return info.exists ? localPath : null;
  } catch {
    return null;
  }
}

// ─── Clear ─────────────────────────────────────

/** Clear all AIFDMS chat storage (e.g. on logout). */
export async function clearChatCache() {
  await ensureInit();
  try {
    const rootDir = `${FileSystem.documentDirectory ?? ''}${ROOT_DIR}/`;
    const info = await FileSystem.getInfoAsync(rootDir);
    if (info.exists) {
      await FileSystem.deleteAsync(rootDir, { idempotent: true });
    }
    initialized = false;
  } catch {}
}

/** Get the storage root path (for debugging). */
export function getChatStoragePath(): string {
  return `${FileSystem.documentDirectory ?? ''}${ROOT_DIR}/`;
}
