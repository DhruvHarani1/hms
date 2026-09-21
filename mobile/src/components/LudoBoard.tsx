import { useEffect, useRef } from 'react';
import { Animated, Image, Pressable, Text, View } from 'react-native';

const CELL = 22;
const GRID = 15;
const BOARD = CELL * GRID;
const TOKEN_SIZE = 20;

const COLOR_HEX: Record<string, string> = {
  red: '#e6392b',
  green: '#2ea043',
  yellow: '#f2c40f',
  blue: '#1b6ec2',
};
const COLOR_ORDER = ['red', 'green', 'yellow', 'blue'] as const;

const TOKEN_IMAGES: Record<string, any> = {
  red: require('../../assets/games/ludo/token-red.png'),
  green: require('../../assets/games/ludo/token-green.png'),
  yellow: require('../../assets/games/ludo/token-yellow.png'),
  blue: require('../../assets/games/ludo/token-blue.png'),
};

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

function AnimatedToken({
  color,
  left,
  top,
  canMove,
  isFinished,
  onPress,
}: {
  color: string;
  left: number;
  top: number;
  canMove: boolean;
  isFinished: boolean;
  onPress: () => void;
}) {
  const pos = useRef(new Animated.ValueXY({ x: left, y: top })).current;
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(pos, {
      toValue: { x: left, y: top },
      useNativeDriver: false,
      friction: 7,
      tension: 60,
    }).start();
  }, [left, top]);

  useEffect(() => {
    if (!canMove) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.25, duration: 500, useNativeDriver: false }),
        Animated.timing(pulse, { toValue: 1, duration: 500, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [canMove]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: pos.x,
        top: pos.y,
        width: TOKEN_SIZE,
        height: TOKEN_SIZE,
        transform: [{ scale: pulse }],
        zIndex: canMove ? 10 : 1,
      }}
    >
      <Pressable
        disabled={!canMove}
        onPress={onPress}
        style={{
          width: '100%',
          height: '100%',
          shadowColor: canMove ? '#ffd700' : '#000',
          shadowOpacity: canMove ? 0.9 : 0.3,
          shadowRadius: canMove ? 5 : 2,
          shadowOffset: { width: 0, height: 1 },
        }}
      >
        <Image source={TOKEN_IMAGES[color]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        {isFinished && (
          <Text style={{ position: 'absolute', top: -14, left: 2, fontSize: 10 }}>⭐</Text>
        )}
      </Pressable>
    </Animated.View>
  );
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
  const tokenCells: { color: string; tokenIndex: number; isMine: boolean; r: number; c: number; pos: number }[] = [];
  for (const p of players) {
    p.tokens.forEach((pos, i) => {
      let rc: RC;
      if (pos === -1) {
        rc = YARD_SLOTS[p.color][i];
      } else {
        rc = cellRC(p.color, pos);
      }
      tokenCells.push({ color: p.color, tokenIndex: i, isMine: p.color === currentPlayerColor, r: rc[0], c: rc[1], pos });
    });
  }

  return (
    <View style={{ width: BOARD, height: BOARD, backgroundColor: '#fdf6e3', borderRadius: 10, borderWidth: 3, borderColor: '#5b4636' }}>
      {/* Yard quadrants */}
      {COLOR_ORDER.map((color) => {
        const [r, c] = YARD_BLOCK[color];
        return (
          <View key={color} style={style(r, c, { width: CELL * 6, height: CELL * 6, backgroundColor: COLOR_HEX[color], borderRadius: 6 })}>
            <View style={{ position: 'absolute', left: CELL * 0.6, top: CELL * 0.6, width: CELL * 4.8, height: CELL * 4.8, backgroundColor: '#fff', borderRadius: 10 }} />
          </View>
        );
      })}

      {/* Shared path cells */}
      {ABS_PATH.map(([r, c], i) => (
        <View key={`p${i}`} style={style(r, c, { backgroundColor: '#fff', borderWidth: 0.5, borderColor: '#e5dcc3' })} />
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
      <View style={style(6, 6, { width: CELL * 3, height: CELL * 3, backgroundColor: '#5b4636', alignItems: 'center', justifyContent: 'center', borderRadius: 4 })}>
        <Text style={{ fontSize: 18 }}>🏠</Text>
      </View>

      {/* Tokens */}
      {tokenCells.map((t) => {
        const sameSpot = tokenCells.filter((o) => o.r === t.r && o.c === t.c);
        const spotIdx = sameSpot.indexOf(t);
        const nudge = sameSpot.length > 1 ? (spotIdx - (sameSpot.length - 1) / 2) * 8 : 0;
        const canMove = t.isMine && legalMoveTokens.includes(t.tokenIndex);
        return (
          <AnimatedToken
            key={`${t.color}-${t.tokenIndex}`}
            color={t.color}
            left={t.c * CELL + CELL / 2 - TOKEN_SIZE / 2 + nudge}
            top={t.r * CELL + CELL / 2 - TOKEN_SIZE / 2}
            canMove={canMove}
            isFinished={t.pos === 57}
            onPress={() => onTokenPress(t.tokenIndex)}
          />
        );
      })}
    </View>
  );
}

export { BOARD as LUDO_BOARD_SIZE };
