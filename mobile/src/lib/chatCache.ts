import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import * as MediaLibrary from 'expo-media-library';

/**
 * Encrypted file-based chat storage under the "AIFDMS" folder.
 *
 * Folder structure on device:
 *   {documentDirectory}/AIFDMS/
 *     messages/
 *       convos.enc            → encrypted conversation list
 *       {convId}.enc          → encrypted messages per conversation
 *     media/
 *       {messageId}.jpg       → cached chat images
 *
 * Images are also auto-saved to a gallery album called "AIFDMS"
 * so users can browse them in their phone's Photos/Gallery app.
 *
 * Encryption: XOR cipher with a 256-char random key stored in
 * expo-secure-store (hardware-backed keychain).
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

  // Create folder structure.
  messagesDir = `${docDir}${MESSAGES_DIR}/`;
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
 * Download a chat image to AIFDMS/media/ and also save to the
 * "AIFDMS" album in the phone's gallery for easy browsing.
 */
export async function cacheImage(remoteUrl: string, messageId: string): Promise<string | null> {
  try {
    await ensureInit();
    const localPath = `${mediaDir}${messageId}.jpg`;

    // Already cached?
    const info = await FileSystem.getInfoAsync(localPath);
    if (info.exists) return localPath;

    // Download to AIFDMS/media/.
    const result = await FileSystem.downloadAsync(remoteUrl, localPath);
    if (result.status !== 200) return null;

    // Also save to phone gallery under "AIFDMS" album (best-effort).
    try {
      const { status } = await MediaLibrary.getPermissionsAsync();
      if (status === 'granted') {
        const asset = await MediaLibrary.createAssetAsync(localPath);
        // Get or create the "AIFDMS" album.
        let album = await MediaLibrary.getAlbumAsync(GALLERY_ALBUM);
        if (album) {
          await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
        } else {
          await MediaLibrary.createAlbumAsync(GALLERY_ALBUM, asset, false);
        }
      }
    } catch {
      // Gallery save is best-effort — don't fail the cache.
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
