import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, Pressable, Text, View } from 'react-native';

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
  const x = useRef(new Animated.Value(left)).current;
  const y = useRef(new Animated.Value(top)).current;
  const lift = useRef(new Animated.Value(0)).current; // arc "hop" height while moving
  const squashY = useRef(new Animated.Value(1)).current;
  const squashX = useRef(new Animated.Value(1)).current;
  const pulse = useRef(new Animated.Value(1)).current;
  const mounted = useRef(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      x.setValue(left);
      y.setValue(top);
      return;
    }
    Animated.parallel([
      Animated.timing(x, { toValue: left, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.timing(y, { toValue: top, duration: 380, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
      Animated.sequence([
        Animated.timing(lift, { toValue: -14, duration: 190, easing: Easing.out(Easing.quad), useNativeDriver: false }),
        Animated.timing(lift, { toValue: 0, duration: 190, easing: Easing.in(Easing.quad), useNativeDriver: false }),
      ]),
    ]).start(() => {
      // Squash-and-stretch landing bounce.
      Animated.sequence([
        Animated.parallel([
          Animated.timing(squashY, { toValue: 0.6, duration: 70, useNativeDriver: false }),
          Animated.timing(squashX, { toValue: 1.3, duration: 70, useNativeDriver: false }),
        ]),
        Animated.parallel([
          Animated.spring(squashY, { toValue: 1, friction: 3.5, tension: 200, useNativeDriver: false }),
          Animated.spring(squashX, { toValue: 1, friction: 3.5, tension: 200, useNativeDriver: false }),
        ]),
      ]).start();
    });
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

  const shadowScale = lift.interpolate({ inputRange: [-14, 0], outputRange: [0.6, 1] });
  const shadowOpacity = lift.interpolate({ inputRange: [-14, 0], outputRange: [0.15, 0.35] });

  return (
    <>
      {/* Ground contact shadow — follows the cell-to-cell move but not the hop lift */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: Animated.add(x, TOKEN_SIZE * 0.15),
          top: Animated.add(y, TOKEN_SIZE * 0.72),
          width: TOKEN_SIZE * 0.7,
          height: TOKEN_SIZE * 0.28,
          borderRadius: 999,
          backgroundColor: '#000',
          opacity: shadowOpacity,
          transform: [{ scale: shadowScale }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          left: x,
          top: Animated.add(y, lift),
          width: TOKEN_SIZE,
          height: TOKEN_SIZE,
          transform: [{ scale: pulse }, { scaleX: squashX }, { scaleY: squashY }],
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
            shadowOpacity: canMove ? 0.95 : 0.4,
            shadowRadius: canMove ? 6 : 2,
            shadowOffset: { width: 0, height: 1 },
          }}
        >
          <Image source={TOKEN_IMAGES[color]} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
          {/* Glossy highlight for a rounder, more 3D-looking piece */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: '10%',
              left: '18%',
              width: '38%',
              height: '26%',
              borderRadius: 999,
              backgroundColor: '#ffffff',
              opacity: 0.55,
              transform: [{ rotate: '-20deg' }],
            }}
          />
          {isFinished && (
            <Text style={{ position: 'absolute', top: -14, left: 2, fontSize: 10 }}>⭐</Text>
          )}
        </Pressable>
      </Animated.View>
    </>
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
    <View
      style={{
        width: BOARD,
        height: BOARD,
        backgroundColor: '#e8c99b',
        borderRadius: 12,
        borderWidth: 4,
        borderColor: '#7a4f2b',
        shadowColor: '#000',
        shadowOpacity: 0.35,
        shadowRadius: 10,
        shadowOffset: { width: 0, height: 5 },
        elevation: 8,
      }}
    >
      {/* Subtle wood-tone shading (layered gradients-by-hand, no image asset) */}
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 8, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '50%', backgroundColor: '#fff', opacity: 0.08 }} />
        <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '35%', backgroundColor: '#000', opacity: 0.06 }} />
      </View>

      {/* Yard quadrants */}
      {COLOR_ORDER.map((color) => {
        const [r, c] = YARD_BLOCK[color];
        return (
          <View
            key={color}
            style={style(r, c, {
              width: CELL * 6,
              height: CELL * 6,
              backgroundColor: COLOR_HEX[color],
              borderRadius: 6,
              shadowColor: '#000',
              shadowOpacity: 0.2,
              shadowRadius: 3,
              shadowOffset: { width: 0, height: 2 },
            })}
          >
            <View style={{ position: 'absolute', left: CELL * 0.6, top: CELL * 0.6, width: CELL * 4.8, height: CELL * 4.8, backgroundColor: '#fff', borderRadius: 10 }} />
          </View>
        );
      })}

      {/* Shared path cells */}
      {ABS_PATH.map(([r, c], i) => (
        <View key={`p${i}`} style={style(r, c, { backgroundColor: '#fffaf0', borderWidth: 0.5, borderColor: '#d9bd8f' })} />
      ))}

      {/* Color each color's entry cell + home stretch */}
      {COLOR_ORDER.map((color) => {
        const startOffset = COLOR_ORDER.indexOf(color) * 13;
        const [er, ec] = ABS_PATH[startOffset];
        return (
          <View key={`entry-${color}`} style={style(er, ec, { backgroundColor: COLOR_HEX[color] + '55' })} />
        );
      })}

      {/* Star safe cells (8 steps into each arm) — tokens here can't be captured */}
      {COLOR_ORDER.map((color) => {
        const starIdx = COLOR_ORDER.indexOf(color) * 13 + 8;
        const [sr, sc] = ABS_PATH[starIdx];
        return (
          <View key={`star-${color}`} style={style(sr, sc, { alignItems: 'center', justifyContent: 'center' })}>
            <Text style={{ fontSize: 11, color: '#c9a227' }}>★</Text>
          </View>
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
