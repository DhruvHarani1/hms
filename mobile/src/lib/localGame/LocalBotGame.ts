import { createInitialState, applyMove, redactForViewer, currentTurnUserId, GameType } from '../gameEngines/dispatch';
import { decideUnoBotMove, decideLudoBotMove } from './BotAI';

const BOT_THINK_MS = 800;

/** Single-player vs computer. Fully on-device, zero networking, zero backend calls. */
export class LocalBotGame {
  gameType: GameType;
  humanUserId: string;
  humanName: string;
  botIds: string[];
  status: 'playing' | 'finished' = 'playing';
  engineState: any;

  private onUpdate: (room: any) => void;
  private destroyed = false;

  constructor(
    gameType: GameType,
    human: { userId: string; name: string },
    botCount: number,
    onUpdate: (room: any) => void,
  ) {
    this.gameType = gameType;
    this.humanUserId = human.userId;
    this.humanName = human.name;
    this.botIds = Array.from({ length: botCount }, (_, i) => `bot-${i + 1}`);
    this.onUpdate = onUpdate;

    const players = [
      { userId: this.humanUserId, name: this.humanName },
      ...this.botIds.map((id, i) => ({ userId: id, name: `🤖 Bot ${i + 1}` })),
    ];
    this.engineState = createInitialState(gameType, players);
    this.broadcastState();
    this.maybeRunBotTurn();
  }

  makeMove(action: string, payload?: any) {
    if (this.status !== 'playing') throw new Error('Game is not in progress.');
    this.engineState = applyMove(this.gameType, this.engineState, this.humanUserId, action, payload);
    if (this.engineState.winnerUserId) this.status = 'finished';
    this.broadcastState();
    this.maybeRunBotTurn();
  }

  private maybeRunBotTurn() {
    if (this.status !== 'playing') return;
    const current = this.engineState.players[this.engineState.currentPlayerIndex];
    if (!this.botIds.includes(current.userId)) return; // human's turn — stop the chain

    setTimeout(() => {
      if (this.destroyed || this.status !== 'playing') return;
      try {
        const decide = this.gameType === 'uno' ? decideUnoBotMove : decideLudoBotMove;
        const { action, payload } = decide(this.engineState, current.userId);
        this.engineState = applyMove(this.gameType, this.engineState, current.userId, action, payload);
        if (this.engineState.winnerUserId) this.status = 'finished';
      } catch {
        // A bot's chosen move turned out illegal (shouldn't normally happen) — skip its turn safely.
      }
      this.broadcastState();
      this.maybeRunBotTurn();
    }, BOT_THINK_MS);
  }

  private buildRoom() {
    const players = [
      { id: this.humanUserId, userId: this.humanUserId, seat: 0, user: { id: this.humanUserId, fullName: this.humanName, avatarUrl: undefined } },
      ...this.botIds.map((id, i) => ({
        id,
        userId: id,
        seat: i + 1,
        user: { id, fullName: `🤖 Bot ${i + 1}`, avatarUrl: undefined },
      })),
    ];
    return {
      id: 'bot',
      gameType: this.gameType,
      status: this.status,
      code: '',
      hostId: this.humanUserId,
      maxPlayers: this.botIds.length + 1,
      players,
      state: redactForViewer(this.gameType, this.engineState, this.humanUserId),
      currentTurnUserId: currentTurnUserId(this.gameType, this.engineState),
    };
  }

  private broadcastState() {
    if (!this.destroyed) this.onUpdate(this.buildRoom());
  }

  leave() {
    this.destroyed = true;
  }
}
