/**
 * Ludo rules engine — pure functions over a JSON state blob. Supports 2-4
 * players. Each token position is relative to its own color's start cell:
 *   -1        = in the yard (not yet entered)
 *   0-50      = on the shared 51-cell path (relative offset from own start)
 *   51-56     = home stretch (color-private, 6 cells)
 *   57        = finished (reached home)
 * Colors enter the shared path at fixed absolute offsets 13 apart, which is
 * what makes captures between different colors possible on the shared path.
 */

export type LudoColor = 'red' | 'green' | 'yellow' | 'blue';
const COLOR_ORDER: LudoColor[] = ['red', 'green', 'yellow', 'blue'];
const START_OFFSET: Record<LudoColor, number> = { red: 0, green: 13, yellow: 26, blue: 39 };
// Safe cells: each color's entry cell (0,13,26,39) plus the classic "star"
// cell 8 steps into each arm (8,21,34,47) — tokens here can't be captured.
const SAFE_ABSOLUTE_CELLS = new Set([0, 8, 13, 21, 26, 34, 39, 47]);
const PATH_LENGTH = 51; // relative 0..50 are on the shared path
const HOME_STRETCH_END = 57;

export interface LudoPlayer {
  userId: string;
  name: string;
  color: LudoColor;
  tokens: number[]; // length 4, each -1..57
}

export interface LudoState {
  players: LudoPlayer[];
  currentPlayerIndex: number;
  diceValue: number | null;
  turnPhase: 'roll' | 'move';
  legalMoves: number[]; // token indices (of current player) that can legally move
  consecutiveSixes: number;
  winnerUserId?: string;
  log: string[];
}

export function createInitialState(players: { userId: string; name: string }[]): LudoState {
  return {
    players: players.map((p, i) => ({
      userId: p.userId,
      name: p.name,
      color: COLOR_ORDER[i],
      tokens: [-1, -1, -1, -1],
    })),
    currentPlayerIndex: 0,
    diceValue: null,
    turnPhase: 'roll',
    legalMoves: [],
    consecutiveSixes: 0,
    log: [`Game started. ${players[0].name} (${COLOR_ORDER[0]}) rolls first.`],
  };
}

function relativeToAbsolute(color: LudoColor, relative: number): number | null {
  if (relative < 0 || relative > PATH_LENGTH - 1) return null; // yard or home stretch
  return (START_OFFSET[color] + relative) % 52;
}

function computeLegalMoves(state: LudoState, playerIndex: number, dice: number): number[] {
  const player = state.players[playerIndex];
  const moves: number[] = [];
  player.tokens.forEach((pos, i) => {
    if (pos === -1) {
      if (dice === 6) moves.push(i); // can leave the yard
      return;
    }
    if (pos === HOME_STRETCH_END) return; // already finished
    const next = pos + dice;
    if (next <= HOME_STRETCH_END) moves.push(i);
  });
  return moves;
}

/** Roll the dice for the current player. Auto-passes the turn if no legal move exists. */
export function rollDice(state: LudoState, userId: string): LudoState {
  const s: LudoState = JSON.parse(JSON.stringify(state));
  const playerIndex = s.players.findIndex((p) => p.userId === userId);
  if (playerIndex !== s.currentPlayerIndex) throw new Error("It's not your turn.");
  if (s.turnPhase !== 'roll') throw new Error('You already rolled — move a token.');

  const dice = 1 + Math.floor(Math.random() * 6);
  s.diceValue = dice;

  if (dice === 6) {
    s.consecutiveSixes += 1;
    if (s.consecutiveSixes === 3) {
      s.log.unshift(`${s.players[playerIndex].name} rolled three 6s in a row — turn forfeited.`);
      s.consecutiveSixes = 0;
      s.diceValue = null;
      advanceTurn(s);
      return s;
    }
  } else {
    s.consecutiveSixes = 0;
  }

  const moves = computeLegalMoves(s, playerIndex, dice);
  s.log.unshift(`${s.players[playerIndex].name} rolled a ${dice}.`);

  if (moves.length === 0) {
    s.log.unshift('No legal move — turn passes.');
    s.diceValue = null;
    advanceTurn(s);
    return s;
  }

  s.legalMoves = moves;
  s.turnPhase = 'move';
  return s;
}

export function moveToken(state: LudoState, userId: string, tokenIndex: number): LudoState {
  const s: LudoState = JSON.parse(JSON.stringify(state));
  const playerIndex = s.players.findIndex((p) => p.userId === userId);
  if (playerIndex !== s.currentPlayerIndex) throw new Error("It's not your turn.");
  if (s.turnPhase !== 'move' || s.diceValue === null) throw new Error('Roll the dice first.');
  if (!s.legalMoves.includes(tokenIndex)) throw new Error("That token can't move.");

  const player = s.players[playerIndex];
  const dice = s.diceValue;
  const from = player.tokens[tokenIndex];
  const to = from === -1 ? 0 : from + dice;
  player.tokens[tokenIndex] = to;

  let captured = false;
  const abs = relativeToAbsolute(player.color, to);
  if (abs !== null && !SAFE_ABSOLUTE_CELLS.has(abs)) {
    // A cell held by 2+ of the same opponent color is a "block" — protected
    // from capture, same as real Ludo. Only a lone opponent token gets sent home.
    for (const opp of s.players) {
      if (opp.userId === player.userId) continue;
      const occupying = opp.tokens
        .map((oppPos, i) => ({ i, oppPos }))
        .filter(({ oppPos }) => oppPos !== -1 && oppPos !== HOME_STRETCH_END && relativeToAbsolute(opp.color, oppPos) === abs);
      if (occupying.length === 1) {
        opp.tokens[occupying[0].i] = -1;
        captured = true;
      }
    }
  }

  s.log.unshift(
    `${player.name} moved a token${from === -1 ? ' out of the yard' : ''} to ${to === HOME_STRETCH_END ? 'home' : `spot ${to}`}.` +
      (captured ? ' Captured an opponent token!' : ''),
  );

  if (player.tokens.every((t) => t === HOME_STRETCH_END)) {
    s.winnerUserId = player.userId;
    s.log.unshift(`🎉 ${player.name} wins!`);
    s.turnPhase = 'roll';
    s.legalMoves = [];
    s.diceValue = null;
    return s;
  }

  const bonusTurn = captured || to === HOME_STRETCH_END || dice === 6;
  s.diceValue = null;
  s.legalMoves = [];
  if (bonusTurn) {
    s.turnPhase = 'roll';
  } else {
    advanceTurn(s);
  }
  return s;
}

function advanceTurn(state: LudoState) {
  const n = state.players.length;
  state.currentPlayerIndex = (state.currentPlayerIndex + 1) % n;
  state.turnPhase = 'roll';
  state.diceValue = null;
  state.legalMoves = [];
  state.consecutiveSixes = 0;
}
