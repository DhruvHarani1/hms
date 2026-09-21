import { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing } from 'react-native';

const { width: SCREEN_W } = Dimensions.get('window');
const COLORS = ['#e6392b', '#2ea043', '#f2c40f', '#1b6ec2', '#a855f7', '#f97316'];
const PIECE_COUNT = 24;

function Piece({ index }: { index: number }) {
  const progress = useRef(new Animated.Value(0)).current;
  const startX = Math.random() * SCREEN_W;
  const color = COLORS[index % COLORS.length];
  const size = 6 + Math.random() * 6;
  const drift = (Math.random() - 0.5) * 120;
  const spins = 2 + Math.random() * 3;
  const delay = Math.random() * 300;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2200 + Math.random() * 800,
      delay,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  }, []);

  const translateY = progress.interpolate({ inputRange: [0, 1], outputRange: [-20, 700] });
  const translateX = progress.interpolate({ inputRange: [0, 1], outputRange: [0, drift] });
  const rotate = progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${spins * 360}deg`] });
  const opacity = progress.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] });

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
        top: 0,
        width: size,
        height: size * 1.6,
        backgroundColor: color,
        borderRadius: 2,
        opacity,
        transform: [{ translateY }, { translateX }, { rotate }],
      }}
    />
  );
}

/** One-shot confetti burst — mount when a win happens, no props needed. */
export function Confetti() {
  return (
    <>
      {Array.from({ length: PIECE_COUNT }).map((_, i) => (
        <Piece key={i} index={i} />
      ))}
    </>
  );
}
