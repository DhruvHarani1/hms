import { createAudioPlayer } from 'expo-audio';

const SOUNDS = {
  diceRoll: require('../../assets/games/sfx/dice-roll.ogg'),
  tokenMove: require('../../assets/games/sfx/token-move.ogg'),
  capture: require('../../assets/games/sfx/capture.ogg'),
  win: require('../../assets/games/sfx/win.ogg'),
} as const;

export type GameSound = keyof typeof SOUNDS;

/** Fire-and-forget one-shot SFX. Never throws — sound is decoration, not critical. */
export function playSound(name: GameSound) {
  try {
    const player = createAudioPlayer(SOUNDS[name]);
    player.play();
    setTimeout(() => {
      try {
        player.remove();
      } catch {}
    }, 3000);
  } catch {}
}
