import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as uno from './engines/uno.engine';
import * as ludo from './engines/ludo.engine';

const MAX_PLAYERS: Record<string, number> = { uno: 4, ludo: 4 };
const MIN_PLAYERS = 2;
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  private async generateCode(): Promise<string> {
    for (let attempt = 0; attempt < 10; attempt++) {
      const code = Array.from({ length: 5 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join('');
      const existing = await this.prisma.gameRoom.findUnique({ where: { code } });
      if (!existing) return code;
    }
    throw new BadRequestException('Could not generate a room code, try again.');
  }

  async createRoom(userId: string, hostelId: string, gameType: 'uno' | 'ludo') {
    const code = await this.generateCode();
    const room = await this.prisma.gameRoom.create({
      data: {
        hostelId,
        gameType,
        status: 'waiting',
        code,
        hostId: userId,
        maxPlayers: MAX_PLAYERS[gameType],
        state: {},
        players: { create: [{ userId, seat: 0 }] },
      },
      include: { players: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } },
    });
    return room;
  }

  async listOpenRooms(hostelId: string, gameType?: string) {
    return this.prisma.gameRoom.findMany({
      where: { hostelId, status: 'waiting', ...(gameType && { gameType: gameType as any }) },
      include: { players: { include: { user: { select: { id: true, fullName: true, avatarUrl: true } } } } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
  }

  async joinRoom(userId: string, hostelId: string, code: string) {
    const room = await this.prisma.gameRoom.findUnique({
      where: { code: code.toUpperCase() },
      include: { players: true },
    });
    if (!room || room.hostelId !== hostelId) throw new NotFoundException('Room not found.');
    if (room.status !== 'waiting') throw new BadRequestException('This game has already started.');
    if (room.players.some((p) => p.userId === userId)) return this.getRoom(room.id, userId);
    if (room.players.length >= room.maxPlayers) throw new BadRequestException('Room is full.');

    const nextSeat = Math.max(-1, ...room.players.map((p) => p.seat)) + 1;
    await this.prisma.gameRoomPlayer.create({ data: { roomId: room.id, userId, seat: nextSeat } });
    return this.getRoom(room.id, userId);
  }

  /** Fetch a room's state, redacted for the viewer (hide other players' UNO hands). */
  async getRoom(roomId: string, viewerId: string) {
    const room = await this.prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: {
        players: {
          include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
          orderBy: { seat: 'asc' },
        },
      },
    });
    if (!room) throw new NotFoundException('Room not found.');
    if (!room.players.some((p) => p.userId === viewerId)) {
      throw new ForbiddenException('You are not in this game.');
    }

    return { ...room, state: this.redact(room.gameType, room.state, viewerId) };
  }

  private redact(gameType: string, state: any, viewerId: string) {
    if (gameType !== 'uno' || !state?.players) return state;
    return {
      ...state,
      players: state.players.map((p: any) =>
        p.userId === viewerId ? p : { ...p, hand: undefined, handCount: p.hand?.length ?? 0 },
      ),
    };
  }

  async startGame(roomId: string, userId: string) {
    const room = await this.prisma.gameRoom.findUnique({
      where: { id: roomId },
      include: { players: { include: { user: { select: { id: true, fullName: true } } }, orderBy: { seat: 'asc' } } },
    });
    if (!room) throw new NotFoundException('Room not found.');
    if (room.hostId !== userId) throw new ForbiddenException('Only the host can start the game.');
    if (room.status !== 'waiting') throw new BadRequestException('Game already started.');
    if (room.players.length < MIN_PLAYERS) throw new BadRequestException(`Need at least ${MIN_PLAYERS} players.`);

    const playerSeeds = room.players.map((p) => ({ userId: p.userId, name: p.user.fullName }));
    const state = room.gameType === 'uno' ? uno.createInitialState(playerSeeds) : ludo.createInitialState(playerSeeds);

    await this.prisma.gameRoom.update({
      where: { id: roomId },
      data: { status: 'playing', state: state as any, currentTurnUserId: playerSeeds[0].userId },
    });
    return this.getRoom(roomId, userId);
  }

  async makeMove(roomId: string, userId: string, action: string, payload: any) {
    const room = await this.prisma.gameRoom.findUnique({ where: { id: roomId }, include: { players: true } });
    if (!room) throw new NotFoundException('Room not found.');
    if (room.status !== 'playing') throw new BadRequestException('Game is not in progress.');
    if (!room.players.some((p) => p.userId === userId)) throw new ForbiddenException('You are not in this game.');

    let newState: any;
    try {
      if (room.gameType === 'uno') {
        newState = this.applyUnoAction(room.state as any, userId, action, payload);
      } else {
        newState = this.applyLudoAction(room.state as any, userId, action, payload);
      }
    } catch (e: any) {
      throw new BadRequestException(e.message ?? 'Invalid move.');
    }

    const finished = !!newState.winnerUserId;
    const currentUserId = finished ? null : newState.players[newState.currentPlayerIndex].userId;

    await this.prisma.gameRoom.update({
      where: { id: roomId },
      data: {
        state: newState,
        currentTurnUserId: currentUserId,
        status: finished ? 'finished' : 'playing',
        winnerUserId: finished ? newState.winnerUserId : null,
      },
    });
    return this.getRoom(roomId, userId);
  }

  private applyUnoAction(state: uno.UnoState, userId: string, action: string, payload: any) {
    if (action === 'play') return uno.playCard(state, userId, payload?.cardId, payload?.chosenColor);
    if (action === 'draw') return uno.drawCard(state, userId);
    if (action === 'pass') return uno.passTurn(state, userId);
    throw new Error('Unknown action.');
  }

  private applyLudoAction(state: ludo.LudoState, userId: string, action: string, payload: any) {
    if (action === 'roll') return ludo.rollDice(state, userId);
    if (action === 'move') return ludo.moveToken(state, userId, payload?.tokenIndex);
    throw new Error('Unknown action.');
  }

  async leaveRoom(roomId: string, userId: string) {
    const room = await this.prisma.gameRoom.findUnique({ where: { id: roomId }, include: { players: true } });
    if (!room) return { ok: true };

    if (room.status === 'waiting') {
      await this.prisma.gameRoomPlayer.deleteMany({ where: { roomId, userId } });
      const remaining = room.players.filter((p) => p.userId !== userId);
      if (remaining.length === 0) {
        await this.prisma.gameRoom.delete({ where: { id: roomId } });
      } else if (room.hostId === userId) {
        const newHost = remaining.sort((a, b) => a.seat - b.seat)[0];
        await this.prisma.gameRoom.update({ where: { id: roomId }, data: { hostId: newHost.userId } });
      }
      return { ok: true };
    }

    // Playing: leaving forfeits — end the game.
    const state: any = room.state;
    if (state?.players) {
      const leaver = state.players.find((p: any) => p.userId === userId);
      state.log = [`${leaver?.name ?? 'A player'} left the game.`, ...(state.log ?? [])];
    }
    await this.prisma.gameRoom.update({
      where: { id: roomId },
      data: { status: 'finished', state, currentTurnUserId: null },
    });
    return { ok: true };
  }
}
