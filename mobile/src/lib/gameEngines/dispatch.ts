import * as uno from './uno.engine';
import * as ludo from './ludo.engine';

export type GameType = 'uno' | 'ludo';

export function createInitialState(gameType: GameType, players: { userId: string; name: string }[]) {
  return gameType === 'uno' ? uno.createInitialState(players) : ludo.createInitialState(players);
}

/** Throws on an illegal move — caller should catch and surface the message. */
export function applyMove(gameType: GameType, state: any, userId: string, action: string, payload: any) {
  if (gameType === 'uno') {
    if (action === 'play') return uno.playCard(state, userId, payload?.cardId, payload?.chosenColor);
    if (action === 'draw') return uno.drawCard(state, userId);
    if (action === 'pass') return uno.passTurn(state, userId);
  } else {
    if (action === 'roll') return ludo.rollDice(state, userId);
    if (action === 'move') return ludo.moveToken(state, userId, payload?.tokenIndex);
  }
  throw new Error('Unknown action.');
}

/** Hide other players' UNO hands from a given viewer — same rule as the backend. */
export function redactForViewer(gameType: GameType, state: any, viewerId: string) {
  if (gameType !== 'uno' || !state?.players) return state;
  return {
    ...state,
    players: state.players.map((p: any) =>
      p.userId === viewerId ? p : { ...p, hand: undefined, handCount: p.hand?.length ?? 0 },
    ),
  };
}

export function currentTurnUserId(gameType: GameType, state: any): string | null {
  if (state.winnerUserId) return null;
  return state.players[state.currentPlayerIndex]?.userId ?? null;
}
