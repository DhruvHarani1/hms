import TcpSockets from 'react-native-tcp-socket';
import dgram from 'react-native-udp';
import * as Network from 'expo-network';
import { createInitialState, applyMove, redactForViewer, currentTurnUserId, GameType } from '../gameEngines/dispatch';
import { GAME_TCP_PORT, DISCOVERY_UDP_PORT, DISCOVERY_PROTO, DISCOVERY_BROADCAST_INTERVAL_MS, isLikelyLanIp } from './constants';

const PORT = GAME_TCP_PORT;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function randCode(): string {
  return Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
}

interface ClientConn {
  socket: any;
  userId: string;
  name: string;
  avatarUrl?: string;
  seat: number;
  buffer: string;
}

/**
 * Runs the authoritative game on the host's own device over a local TCP
 * server — zero backend/API calls. Same engine + same redaction rules as
 * the online mode (see backend/src/modules/games).
 */
export class LocalGameHost {
  gameType: GameType;
  hostUserId: string;
  hostName: string;
  hostAvatarUrl?: string;
  code = randCode();
  maxPlayers = 4;
  status: 'waiting' | 'playing' | 'finished' = 'waiting';
  engineState: any = null;
  ip = '';

  private server: any;
  private clients = new Map<string, ClientConn>();
  private onUpdate: (room: any) => void;
  private discoverySocket: any;
  private discoveryTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    gameType: GameType,
    host: { userId: string; name: string; avatarUrl?: string },
    onUpdate: (room: any) => void,
  ) {
    this.gameType = gameType;
    this.hostUserId = host.userId;
    this.hostName = host.name;
    this.hostAvatarUrl = host.avatarUrl;
    this.onUpdate = onUpdate;
  }

  async start(): Promise<{ ip: string; port: number; code: string }> {
    this.ip = await Network.getIpAddressAsync();
    if (!isLikelyLanIp(this.ip)) {
      throw new Error('Turn on WiFi or your phone hotspot first — no local network detected.');
    }
    await new Promise<void>((resolve, reject) => {
      this.server = TcpSockets.createServer((socket: any) => this.handleConnection(socket));
      this.server.on('error', (e: Error) => reject(e));
      this.server.listen({ port: PORT, host: '0.0.0.0' }, () => {
        this.broadcastState();
        resolve();
      });
    });
    this.startDiscoveryBroadcast();
    return { ip: this.ip, port: PORT, code: this.code };
  }

  /** Advertise this room on the local network so nearby phones auto-discover it (no QR needed). */
  private startDiscoveryBroadcast() {
    try {
      this.discoverySocket = dgram.createSocket({ type: 'udp4' });
      this.discoverySocket.bind(0, () => {
        this.discoverySocket.setBroadcast(true);
        this.discoveryTimer = setInterval(() => this.sendDiscoveryPacket(), DISCOVERY_BROADCAST_INTERVAL_MS);
        this.sendDiscoveryPacket();
      });
    } catch {
      // Discovery is a nice-to-have — QR/manual IP still works if this fails.
    }
  }

  private sendDiscoveryPacket() {
    if (this.status !== 'waiting' || !this.discoverySocket) return;
    const payload = JSON.stringify({
      proto: DISCOVERY_PROTO,
      g: this.gameType,
      ip: this.ip,
      port: PORT,
      code: this.code,
      hostName: this.hostName,
      players: this.clients.size + 1,
      maxPlayers: this.maxPlayers,
    });
    try {
      this.discoverySocket.send(payload, 0, payload.length, DISCOVERY_UDP_PORT, '255.255.255.255');
    } catch {}
  }

  private stopDiscoveryBroadcast() {
    if (this.discoveryTimer) clearInterval(this.discoveryTimer);
    this.discoveryTimer = null;
    try {
      this.discoverySocket?.close();
    } catch {}
  }

  private handleConnection(socket: any) {
    const conn: Partial<ClientConn> = { socket, buffer: '' };
    socket.on('data', (data: any) => {
      conn.buffer = (conn.buffer ?? '') + data.toString();
      let idx: number;
      while ((idx = conn.buffer!.indexOf('\n')) !== -1) {
        const line = conn.buffer!.slice(0, idx);
        conn.buffer = conn.buffer!.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          this.handleMessage(socket, JSON.parse(line));
        } catch {
          // ignore malformed line
        }
      }
    });
    socket.on('close', () => this.handleDisconnect(socket));
    socket.on('error', () => {});
  }

  private handleMessage(socket: any, msg: any) {
    if (msg.type === 'hello') {
      if (this.status !== 'waiting') {
        this.send(socket, { type: 'error', message: 'This game has already started.' });
        socket.destroy();
        return;
      }
      if (this.clients.size + 1 >= this.maxPlayers) {
        this.send(socket, { type: 'error', message: 'Room is full.' });
        socket.destroy();
        return;
      }
      const seat = this.clients.size + 1;
      this.clients.set(msg.userId, { socket, userId: msg.userId, name: msg.name, avatarUrl: msg.avatarUrl, seat, buffer: '' });
      this.broadcastState();
    } else if (msg.type === 'move') {
      this.applyMoveFrom(msg.userId, msg.action, msg.payload, msg.moveId);
    } else if (msg.type === 'leave') {
      this.clients.delete(msg.userId);
      if (this.status === 'playing') this.status = 'finished';
      socket.destroy();
      this.broadcastState();
    }
  }

  private applyMoveFrom(userId: string, action: string, payload: any, moveId?: string) {
    if (this.status !== 'playing') return;
    try {
      this.engineState = applyMove(this.gameType, this.engineState, userId, action, payload);
      if (this.engineState.winnerUserId) this.status = 'finished';
      this.broadcastState();
    } catch (e: any) {
      const client = this.clients.get(userId);
      if (client) this.send(client.socket, { type: 'moveError', moveId, message: e.message });
    }
  }

  /** The host's own move (no network hop — throws synchronously on an illegal move). */
  makeMove(action: string, payload?: any) {
    if (this.status !== 'playing') throw new Error('Game is not in progress.');
    this.engineState = applyMove(this.gameType, this.engineState, this.hostUserId, action, payload);
    if (this.engineState.winnerUserId) this.status = 'finished';
    this.broadcastState();
  }

  startGame() {
    if (this.status !== 'waiting') throw new Error('Game already started.');
    const players = [
      { userId: this.hostUserId, name: this.hostName },
      ...[...this.clients.values()].map((c) => ({ userId: c.userId, name: c.name })),
    ];
    if (players.length < 2) throw new Error('Need at least 2 players.');
    this.engineState = createInitialState(this.gameType, players);
    this.status = 'playing';
    this.stopDiscoveryBroadcast();
    this.broadcastState();
  }

  private buildRoomFor(viewerId: string) {
    const players = [
      { id: this.hostUserId, userId: this.hostUserId, seat: 0, user: { id: this.hostUserId, fullName: this.hostName, avatarUrl: this.hostAvatarUrl } },
      ...[...this.clients.values()].map((c) => ({
        id: c.userId,
        userId: c.userId,
        seat: c.seat,
        user: { id: c.userId, fullName: c.name, avatarUrl: c.avatarUrl },
      })),
    ];
    return {
      id: 'local',
      gameType: this.gameType,
      status: this.status,
      code: this.code,
      hostId: this.hostUserId,
      maxPlayers: this.maxPlayers,
      players,
      state: this.engineState ? redactForViewer(this.gameType, this.engineState, viewerId) : {},
      currentTurnUserId: this.engineState ? currentTurnUserId(this.gameType, this.engineState) : null,
    };
  }

  private broadcastState() {
    this.onUpdate(this.buildRoomFor(this.hostUserId));
    for (const c of this.clients.values()) {
      this.send(c.socket, { type: 'state', room: this.buildRoomFor(c.userId) });
    }
  }

  private send(socket: any, obj: any) {
    try {
      socket.write(JSON.stringify(obj) + '\n');
    } catch {
      // socket likely closed
    }
  }

  private handleDisconnect(socket: any) {
    for (const [uid, c] of this.clients) {
      if (c.socket === socket) {
        this.clients.delete(uid);
        break;
      }
    }
    if (this.status === 'playing') this.status = 'finished';
    this.broadcastState();
  }

  leave() {
    this.stopDiscoveryBroadcast();
    for (const c of this.clients.values()) {
      this.send(c.socket, { type: 'error', message: 'Host ended the game.' });
      c.socket.destroy();
    }
    try {
      this.server?.close();
    } catch {}
  }
}
