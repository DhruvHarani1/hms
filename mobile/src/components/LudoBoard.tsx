import { Pressable, Text, View } from 'react-native';

const CELL = 20;
const GRID = 15;
const BOARD = CELL * GRID;

const COLOR_HEX: Record<string, string> = {
  red: '#e6392b',
  green: '#2ea043',
  yellow: '#f2c40f',
  blue: '#1b6ec2',
};
const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'] as const;

type RC = [number, number];

/** Rotate a grid coordinate 90° clockwise about the 15x15 board's center. */
function rotate([r, c]: RC): RC {
  return [c, 14 - r];
}

const BASE_ARM: RC[] = [
  [6, 1], [6, 2], [6, 3], [6, 4], [6, 5],
  [5, 6], [4, 6], [3, 6], [2, 6], [1, 6], [0, 6],
  [0, 7],
  [0, 8],
];

// 52 shared-path cells, in absolute order (index 0 = red's entry, 13 = green's, etc).
const ABS_PATH: RC[] = (() => {
  const out: RC[] = [];
  let arm = BASE_ARM;
  for (let q = 0; q < 4; q++) {
    out.push(...arm);
    arm = arm.map(rotate);
  }
  return out;
})();

const BASE_HOME: RC[] = [[7, 1], [7, 2], [7, 3], [7, 4], [7, 5], [7, 6]];
const HOME_STRETCH: Record<string, RC[]> = (() => {
  const map: Record<string, RC[]> = {};
  let cells = BASE_HOME;
  for (const color of COLOR_ORDER) {
    map[color] = cells;
    cells = cells.map(rotate);
  }
  return map;
})();

const BASE_YARD_SLOTS: RC[] = [[1, 1], [1, 4], [4, 1], [4, 4]];
const YARD_SLOTS: Record<string, RC[]> = (() => {
  const map: Record<string, RC[]> = {};
  let slots = BASE_YARD_SLOTS;
  for (const color of COLOR_ORDER) {
    map[color] = slots;
    slots = slots.map(rotate);
  }
  return map;
})();

const YARD_BLOCK: Record<string, RC> = { red: [0, 0], green: [0, 9], yellow: [9, 9], blue: [9, 0] };

function cellRC(color: string, relative: number): RC {
  if (relative === -1) return YARD_SLOTS[color][0]; // caller picks exact slot separately
  if (relative >= 51) {
    const idx = Math.min(relative - 51, 5);
    return HOME_STRETCH[color][idx];
  }
  const startOffset = COLOR_ORDER.indexOf(color as any) * 13;
  return ABS_PATH[(startOffset + relative) % 52];
}

function style(r: number, c: number, extra?: object) {
  return { position: 'absolute' as const, left: c * CELL, top: r * CELL, width: CELL, height: CELL, ...extra };
}

export function LudoBoard({
  players,
  legalMoveTokens,
  currentPlayerColor,
  onTokenPress,
}: {
  players: { userId: string; color: string; tokens: number[] }[];
  legalMoveTokens: number[];
  currentPlayerColor: string | null;
  onTokenPress: (tokenIndex: number) => void;
}) {
  // Group tokens sitting on the exact same visual cell so we can offset them slightly.
  const tokenCells: { color: string; tokenIndex: number; isMine: boolean; r: number; c: number }[] = [];
  for (const p of players) {
    p.tokens.forEach((pos, i) => {
      let rc: RC;
      if (pos === -1) {
        rc = YARD_SLOTS[p.color][i];
      } else {
        rc = cellRC(p.color, pos);
      }
      tokenCells.push({ color: p.color, tokenIndex: i, isMine: p.color === currentPlayerColor, r: rc[0], c: rc[1] });
    });
  }

  return (
    <View style={{ width: BOARD, height: BOARD, backgroundColor: '#fff', borderRadius: 8, borderWidth: 2, borderColor: '#333' }}>
      {/* Yard quadrants */}
      {COLOR_ORDER.map((color) => {
        const [r, c] = YARD_BLOCK[color];
        return (
          <View key={color} style={style(r, c, { width: CELL * 6, height: CELL * 6, backgroundColor: COLOR_HEX[color] })}>
            <View style={{ position: 'absolute', left: CELL * 0.5, top: CELL * 0.5, width: CELL * 5, height: CELL * 5, backgroundColor: '#fff', borderRadius: 8 }} />
          </View>
        );
      })}

      {/* Shared path cells */}
      {ABS_PATH.map(([r, c], i) => (
        <View key={`p${i}`} style={style(r, c, { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#ddd' })} />
      ))}

      {/* Color each color's entry cell + home stretch */}
      {COLOR_ORDER.map((color) => {
        const startOffset = COLOR_ORDER.indexOf(color) * 13;
        const [er, ec] = ABS_PATH[startOffset];
        return (
          <View key={`entry-${color}`} style={style(er, ec, { backgroundColor: COLOR_HEX[color] + '55' })} />
        );
      })}
      {COLOR_ORDER.map((color) =>
        HOME_STRETCH[color].map(([r, c], i) => (
          <View key={`${color}-hs-${i}`} style={style(r, c, { backgroundColor: COLOR_HEX[color] })} />
        )),
      )}

      {/* Center home */}
      <View style={style(6, 6, { width: CELL * 3, height: CELL * 3, backgroundColor: '#333', alignItems: 'center', justifyContent: 'center' })}>
        <Text style={{ fontSize: 16 }}>🏠</Text>
      </View>

      {/* Tokens */}
      {tokenCells.map((t, idx) => {
        const sameSpot = tokenCells.filter((o) => o.r === t.r && o.c === t.c);
        const spotIdx = sameSpot.indexOf(t);
        const nudge = sameSpot.length > 1 ? (spotIdx - (sameSpot.length - 1) / 2) * 6 : 0;
        const canMove = t.isMine && legalMoveTokens.includes(t.tokenIndex);
        const player = players.find((p) => p.color === t.color);
        const posValue = player?.tokens[t.tokenIndex] ?? -1;
        return (
          <Pressable
            key={`${t.color}-${t.tokenIndex}`}
            disabled={!canMove}
            onPress={() => onTokenPress(t.tokenIndex)}
            style={{
              position: 'absolute',
              left: t.c * CELL + CELL / 2 - 7 + nudge,
              top: t.r * CELL + CELL / 2 - 7,
              width: 14,
              height: 14,
              borderRadius: 7,
              backgroundColor: COLOR_HEX[t.color],
              borderWidth: 2,
              borderColor: canMove ? '#fff' : '#00000055',
              zIndex: canMove ? 10 : 1,
              shadowColor: canMove ? '#fff' : undefined,
              shadowOpacity: canMove ? 0.9 : 0,
              shadowRadius: canMove ? 4 : 0,
            }}
          >
            {posValue === 57 && (
              <Text style={{ position: 'absolute', top: -14, left: -4, fontSize: 10 }}>⭐</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

export { BOARD as LUDO_BOARD_SIZE };
