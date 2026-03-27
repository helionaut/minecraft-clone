import type { InputState, PlayerState } from '../gameplay/player.ts';

type AudioContextLike = AudioContext;

const MUSIC_PATTERN = [
  [57, 64, 69],
  [60, 67, 72],
  [53, 60, 65],
  [55, 62, 67],
] as const;

function midiToFrequency(note: number): number {
  return 440 * (2 ** ((note - 69) / 12));
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function createMusicBar(step: number): readonly number[] {
  return MUSIC_PATTERN[step % MUSIC_PATTERN.length] ?? MUSIC_PATTERN[0];
}

type GameAudio = {
  unlock: () => void;
  playJump: () => void;
  playMine: () => void;
  playPlace: () => void;
  playCraft: () => void;
  playSelect: () => void;
  update: (
    previousPlayer: PlayerState,
    nextPlayer: PlayerState,
    input: InputState,
    delta: number,
  ) => void;
  dispose: () => void;
};

export function createGameAudio(
  AudioContextCtor: typeof AudioContext | undefined = window.AudioContext,
): GameAudio {

  if (!AudioContextCtor) {
    return {
      unlock: () => undefined,
      playJump: () => undefined,
      playMine: () => undefined,
      playPlace: () => undefined,
      playCraft: () => undefined,
      playSelect: () => undefined,
      update: () => undefined,
      dispose: () => undefined,
    };
  }

  let context: AudioContextLike | null = null;
  let masterGain: GainNode | null = null;
  let musicGain: GainNode | null = null;
  let musicTimer: number | null = null;
  let musicStep = 0;
  let lastMotionAccentAt = -Infinity;

  const playJump = () => {
    // A layered pitch rise lands closer to a tactile "whoosh" than two fixed notes.
    pulse(196, { duration: 0.2, type: 'triangle', gain: 0.055, attack: 0.008, endFrequency: 392 });
    pulse(294, { duration: 0.14, type: 'sawtooth', gain: 0.018, attack: 0.003, endFrequency: 540 });
    pulse(523.25, { duration: 0.22, type: 'sine', gain: 0.02, attack: 0.012, endFrequency: 392 });
  };

  const playPlace = () => {
    pulse(164.81, { duration: 0.16, type: 'triangle', gain: 0.043, attack: 0.003, endFrequency: 110 });
    pulse(246.94, {
      duration: 0.07,
      type: 'square',
      gain: 0.02,
      attack: 0.002,
      endFrequency: 196,
      delay: 0.008,
    });
    pulse(392, {
      duration: 0.06,
      type: 'sine',
      gain: 0.012,
      attack: 0.002,
      endFrequency: 329.63,
      delay: 0.012,
    });
  };

  const playCraft = () => {
    pulse(196, { duration: 0.16, type: 'triangle', gain: 0.022, attack: 0.003, endFrequency: 246.94 });
    pulse(392, {
      duration: 0.09,
      type: 'sine',
      gain: 0.015,
      attack: 0.002,
      endFrequency: 587.33,
      delay: 0.028,
    });
    pulse(493.88, {
      duration: 0.09,
      type: 'triangle',
      gain: 0.017,
      attack: 0.002,
      endFrequency: 739.99,
      delay: 0.052,
    });
    pulse(659.25, {
      duration: 0.16,
      type: 'sine',
      gain: 0.016,
      attack: 0.006,
      endFrequency: 987.77,
      delay: 0.086,
    });
  };

  const playSelect = () => {
    pulse(392, { duration: 0.06, type: 'triangle', gain: 0.016, attack: 0.002, endFrequency: 329.63 });
    pulse(659.25, {
      duration: 0.04,
      type: 'sine',
      gain: 0.01,
      attack: 0.001,
      endFrequency: 523.25,
      delay: 0.004,
    });
  };

  const ensureContext = (): AudioContextLike => {
    if (context && masterGain && musicGain) {
      return context;
    }

    context = new AudioContextCtor();
    masterGain = context.createGain();
    musicGain = context.createGain();
    masterGain.gain.value = 0.18;
    musicGain.gain.value = 0.15;
    musicGain.connect(masterGain);
    masterGain.connect(context.destination);
    return context;
  };

  const pulse = (
    frequency: number,
    {
      duration,
      type,
      gain,
      attack = 0.01,
      endFrequency,
      destination,
      delay = 0,
    }: {
      duration: number;
      type: OscillatorType;
      gain: number;
      attack?: number;
      endFrequency?: number;
      destination?: AudioNode | null;
      delay?: number;
    },
  ) => {
    const activeContext = ensureContext();
    const resolvedDestination = destination ?? masterGain;

    if (!resolvedDestination) {
      return;
    }

    const oscillator = activeContext.createOscillator();
    const amp = activeContext.createGain();
    const now = activeContext.currentTime + delay;

    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    if (endFrequency !== undefined) {
      oscillator.frequency.exponentialRampToValueAtTime(endFrequency, now + duration);
    }
    amp.gain.setValueAtTime(0.0001, now);
    amp.gain.linearRampToValueAtTime(gain, now + attack);
    amp.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(amp);
    amp.connect(resolvedDestination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  };

  const scheduleMusic = () => {
    if (!context || !musicGain) {
      return;
    }

    const chord = createMusicBar(musicStep);
    const now = context.currentTime + 0.02;

    chord.forEach((note, index) => {
      const oscillator = context!.createOscillator();
      const amp = context!.createGain();
      oscillator.type = index === 0 ? 'triangle' : 'sine';
      oscillator.frequency.setValueAtTime(midiToFrequency(note), now);
      amp.gain.setValueAtTime(0.0001, now);
      amp.gain.linearRampToValueAtTime(index === 0 ? 0.05 : 0.032, now + 0.22);
      amp.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);
      oscillator.connect(amp);
      amp.connect(musicGain!);
      oscillator.start(now);
      oscillator.stop(now + 1.8);
    });

    musicStep += 1;
    musicTimer = window.setTimeout(scheduleMusic, 1450);
  };

  const unlock = () => {
    const activeContext = ensureContext();

    if (activeContext.state === 'suspended') {
      void activeContext.resume();
    }

    if (musicTimer === null) {
      scheduleMusic();
    }
  };

  return {
    unlock,
    playJump,
    playMine: () => {
      pulse(164.81, { duration: 0.14, type: 'square', gain: 0.05, attack: 0.004 });
      pulse(110, { duration: 0.09, type: 'triangle', gain: 0.025, attack: 0.002 });
    },
    playPlace,
    playCraft,
    playSelect,
    update: (previousPlayer, nextPlayer, input, delta) => {
      if (!context || !masterGain) {
        return;
      }

      if (!previousPlayer.inFluid && nextPlayer.inFluid) {
        pulse(196, { duration: 0.25, type: 'triangle', gain: 0.045, attack: 0.006 });
      }

      if (!previousPlayer.grounded && nextPlayer.grounded && previousPlayer.velocity.y < -3.5) {
        pulse(146.83, { duration: 0.12, type: 'triangle', gain: 0.03, attack: 0.003 });
      }

      if (!previousPlayer.inFluid && input.jump && !nextPlayer.grounded && nextPlayer.velocity.y > 0) {
        playJump();
      }

      const horizontalSpeed = Math.hypot(nextPlayer.velocity.x, nextPlayer.velocity.z);
      const accentInterval = nextPlayer.inFluid ? 0.34 : 0.42;
      lastMotionAccentAt += delta;

      if (
        horizontalSpeed > 1.1 &&
        nextPlayer.inFluid &&
        lastMotionAccentAt >= accentInterval
      ) {
        lastMotionAccentAt = 0;
        pulse(clamp(180 + horizontalSpeed * 8, 180, 240), {
          duration: 0.11,
          type: 'sine',
          gain: 0.022,
          attack: 0.003,
        });
      }
    },
    dispose: () => {
      if (musicTimer !== null) {
        window.clearTimeout(musicTimer);
        musicTimer = null;
      }

      if (context) {
        void context.close();
      }

      context = null;
      masterGain = null;
      musicGain = null;
    },
  };
}
