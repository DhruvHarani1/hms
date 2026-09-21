/**
 * UNO rules engine — pure functions over a JSON state blob. No I/O, no DB.
 * Card id format: "<color>_<value>_<instance>" e.g. "red_5_0", "wild_draw4_2".
 * Colors: red|yellow|green|blue|wild. Values: 0-9|skip|reverse|draw2|wild|draw4.
 */

export type UnoColor = 'red' | 'yellow' | 'green' | 'blue';
const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

export interface UnoPlayer {
  userId: string;
  name: string;
  hand: string[];
}

export interface UnoState {
  players: UnoPlayer[];
  deck: string[];
  discard: string[]; // last item = top of pile
  currentPlayerIndex: number;
  direction: 1 | -1;
  currentColor: UnoColor;
  turnPhase: 'play' | 'drew'; // 'drew' = just drew, may play the drawn card or pass
  winnerUserId?: string;
  log: string[];
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildDeck(): string[] {
  const deck: string[] = [];
  let n = 0;
  for (const c of COLORS) {
    deck.push(`${c}_0_${n++}`);
    for (let v = 1; v <= 9; v++) {
      deck.push(`${c}_${v}_${n++}`);
      deck.push(`${c}_${v}_${n++}`);
    }
    for (const action of ['skip', 'reverse', 'draw2']) {
      deck.push(`${c}_${action}_${n++}`);
      deck.push(`${c}_${action}_${n++}`);
    }
  }
  for (let i = 0; i < 4; i++) deck.push(`wild_wild_${n++}`);
  for (let i = 0; i < 4; i++) deck.push(`wild_draw4_${n++}`);
  return deck;
}

export function parseCard(cardId: string): { color: string; value: string } {
  const [color, value] = cardId.split('_');
  return { color, value };
}

function isNumberCard(cardId: string): boolean {
  const { value } = parseCard(cardId);
  return /^[0-9]$/.test(value);
}

/** Reshuffle discard (all but the top card) back into the deck when empty. */
function ensureDeck(state: UnoState) {
  if (state.deck.length > 0) return;
  const top = state.discard[state.discard.length - 1];
  const rest = state.discard.slice(0, -1);
  state.deck = shuffle(rest);
  state.discard = [top];
}

function drawN(state: UnoState, n: number): string[] {
  const drawn: string[] = [];
  for (let i = 0; i < n; i++) {
    ensureDeck(state);
    if (state.deck.length === 0) break; // deck truly exhausted (rare)
    drawn.push(state.deck.pop()!);
  }
  return drawn;
}

function advanceTurn(state: UnoState, steps = 1) {
  const n = state.players.length;
  state.currentPlayerIndex =
    (((state.currentPlayerIndex + state.direction * steps) % n) + n) % n;
  state.turnPhase = 'play';
}

export function createInitialState(players: { userId: string; name: string }[]): UnoState {
  const deck = shuffle(buildDeck());
  const hands = players.map(() => [] as string[]);
  for (let round = 0; round < 7; round++) {
    for (let p = 0; p < players.length; p++) {
      hands[p].push(deck.pop()!);
    }
  }

  // Flip a starting card; keep flipping past wilds/action cards for a clean start.
  let starter = deck.pop()!;
  while (!isNumberCard(starter) && deck.length > 0) {
    deck.unshift(starter);
    starter = deck.pop()!;
  }
  const startColor = parseCard(starter).color as UnoColor;

  return {
    players: players.map((p, i) => ({ userId: p.userId, name: p.name, hand: hands[i] })),
    deck,
    discard: [starter],
    currentPlayerIndex: 0,
    direction: 1,
    currentColor: COLORS.includes(startColor) ? startColor : 'red',
    turnPhase: 'play',
    log: [`Game started. ${players[0].name} goes first.`],
  };
}

export function isPlayable(state: UnoState, cardId: string): boolean {
  const top = parseCard(state.discard[state.discard.length - 1]);
  const card = parseCard(cardId);
  if (card.color === 'wild') return true;
  return card.color === state.currentColor || card.value === top.value;
}

export function playCard(
  state: UnoState,
  userId: string,
  cardId: string,
  chosenColor?: UnoColor,
): UnoState {
  const s: UnoState = JSON.parse(JSON.stringify(state));
  const playerIndex = s.players.findIndex((p) => p.userId === userId);
  if (playerIndex !== s.currentPlayerIndex) throw new Error("It's not your turn.");
  const player = s.players[playerIndex];
  const cardIndex = player.hand.indexOf(cardId);
  if (cardIndex === -1) throw new Error("You don't have that card.");
  if (!isPlayable(s, cardId)) throw new Error("That card can't be played right now.");

  const { color, value } = parseCard(cardId);
  player.hand.splice(cardIndex, 1);
  s.discard.push(cardId);

  if (player.hand.length === 0) {
    s.winnerUserId = userId;
    s.log.unshift(`🎉 ${player.name} wins!`);
    return s;
  }

  if (color === 'wild') {
    if (!chosenColor || !COLORS.includes(chosenColor)) throw new Error('Choose a color for the wild card.');
    s.currentColor = chosenColor;
  } else {
    s.currentColor = color as UnoColor;
  }

  s.log.unshift(`${player.name} played ${formatCard(cardId)}.`);

  if (value === 'skip') {
    s.log.unshift(`${nextPlayerName(s)} was skipped.`);
    advanceTurn(s, 2);
  } else if (value === 'reverse') {
    s.direction = s.direction === 1 ? -1 : 1;
    if (s.players.length === 2) {
      advanceTurn(s, 2); // reverse acts like skip in 2-player games
    } else {
      s.log.unshift('Direction reversed.');
      advanceTurn(s, 1);
    }
  } else if (value === 'draw2') {
    advanceTurn(s, 1);
    const victim = s.players[s.currentPlayerIndex];
    const drawn = drawN(s, 2);
    victim.hand.push(...drawn);
    s.log.unshift(`${victim.name} drew 2 cards.`);
    advanceTurn(s, 1);
  } else if (value === 'draw4') {
    advanceTurn(s, 1);
    const victim = s.players[s.currentPlayerIndex];
    const drawn = drawN(s, 4);
    victim.hand.push(...drawn);
    s.log.unshift(`${victim.name} drew 4 cards.`);
    advanceTurn(s, 1);
  } else {
    advanceTurn(s, 1);
  }

  return s;
}

export function drawCard(state: UnoState, userId: string): UnoState {
  const s: UnoState = JSON.parse(JSON.stringify(state));
  const playerIndex = s.players.findIndex((p) => p.userId === userId);
  if (playerIndex !== s.currentPlayerIndex) throw new Error("It's not your turn.");
  if (s.turnPhase === 'drew') throw new Error('You already drew this turn — play or pass.');

  const [drawnCard] = drawN(s, 1);
  if (!drawnCard) throw new Error('No cards left to draw.');
  s.players[playerIndex].hand.push(drawnCard);
  s.turnPhase = 'drew';
  s.log.unshift(`${s.players[playerIndex].name} drew a card.`);
  return s;
}

export function passTurn(state: UnoState, userId: string): UnoState {
  const s: UnoState = JSON.parse(JSON.stringify(state));
  const playerIndex = s.players.findIndex((p) => p.userId === userId);
  if (playerIndex !== s.currentPlayerIndex) throw new Error("It's not your turn.");
  if (s.turnPhase !== 'drew') throw new Error('You can only pass after drawing.');
  s.log.unshift(`${s.players[playerIndex].name} passed.`);
  advanceTurn(s, 1);
  return s;
}

function nextPlayerName(s: UnoState): string {
  const n = s.players.length;
  const idx = (((s.currentPlayerIndex + s.direction) % n) + n) % n;
  return s.players[idx].name;
}

export function formatCard(cardId: string): string {
  const { color, value } = parseCard(cardId);
  const label = value === 'draw2' ? '+2' : value === 'draw4' ? '+4' : value === 'wild' ? 'Wild' : value;
  return color === 'wild' ? label : `${color} ${label}`;
}
