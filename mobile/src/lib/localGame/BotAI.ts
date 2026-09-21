import { isPlayable, parseCard, UnoColor } from '../gameEngines/uno.engine';

const COLORS: UnoColor[] = ['red', 'yellow', 'green', 'blue'];

function pickBestColor(hand: string[]): UnoColor {
  const counts: Record<string, number> = { red: 0, yellow: 0, green: 0, blue: 0 };
  for (const c of hand) {
    const { color } = parseCard(c);
    if (counts[color] !== undefined) counts[color]++;
  }
  let best: UnoColor = 'red';
  let bestCount = -1;
  for (const c of COLORS) {
    if (counts[c] > bestCount) {
      bestCount = counts[c];
      best = c;
    }
  }
  return best;
}

export function decideUnoBotMove(state: any, botId: string): { action: string; payload?: any } {
  const player = state.players.find((p: any) => p.userId === botId);

  if (state.turnPhase === 'drew') {
    const drawn = player.hand[player.hand.length - 1];
    if (drawn && isPlayable(state, drawn)) {
      const { color } = parseCard(drawn);
      return { action: 'play', payload: { cardId: drawn, chosenColor: color === 'wild' ? pickBestColor(player.hand) : undefined } };
    }
    return { action: 'pass' };
  }

  // Prefer a non-wild playable card first so wilds are saved for when nothing else fits.
  const playable = [...player.hand].sort((a, b) => (parseCard(a).color === 'wild' ? 1 : 0) - (parseCard(b).color === 'wild' ? 1 : 0));
  const chosen = playable.find((c) => isPlayable(state, c));
  if (chosen) {
    const { color } = parseCard(chosen);
    return { action: 'play', payload: { cardId: chosen, chosenColor: color === 'wild' ? pickBestColor(player.hand) : undefined } };
  }
  return { action: 'draw' };
}

export function decideLudoBotMove(state: any, botId: string): { action: string; payload?: any } {
  if (state.turnPhase === 'roll') return { action: 'roll' };

  const player = state.players.find((p: any) => p.userId === botId);
  const dice = state.diceValue ?? 0;
  let best = state.legalMoves[0];
  let bestScore = -Infinity;

  for (const idx of state.legalMoves as number[]) {
    const pos = player.tokens[idx];
    const to = pos === -1 ? 0 : pos + dice;
    let score = to;
    if (to === 57) score += 100; // finishing a token is best
    if (pos === -1) score += 5; // small nudge to get tokens moving early
    if (score > bestScore) {
      bestScore = score;
      best = idx;
    }
  }
  return { action: 'move', payload: { tokenIndex: best } };
}
