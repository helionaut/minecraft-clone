// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGameAudio, createMusicBar } from '../../src/audio/gameAudio.ts';

type ParamEvent = {
  method: 'setValueAtTime' | 'linearRampToValueAtTime' | 'exponentialRampToValueAtTime';
  value: number;
  time: number;
};

class FakeAudioParam {
  readonly events: ParamEvent[] = [];

  setValueAtTime(value: number, time: number): void {
    this.events.push({ method: 'setValueAtTime', value, time });
  }

  linearRampToValueAtTime(value: number, time: number): void {
    this.events.push({ method: 'linearRampToValueAtTime', value, time });
  }

  exponentialRampToValueAtTime(value: number, time: number): void {
    this.events.push({ method: 'exponentialRampToValueAtTime', value, time });
  }
}

class FakeGainNode {
  readonly gain = new FakeAudioParam();
  readonly connections: unknown[] = [];

  connect(destination: unknown): void {
    this.connections.push(destination);
  }
}

class FakeOscillatorNode {
  type: OscillatorType = 'sine';
  readonly frequency = new FakeAudioParam();
  readonly connections: unknown[] = [];
  readonly starts: number[] = [];
  readonly stops: number[] = [];

  connect(destination: unknown): void {
    this.connections.push(destination);
  }

  start(time: number): void {
    this.starts.push(time);
  }

  stop(time: number): void {
    this.stops.push(time);
  }
}

class FakeAudioContext {
  static latest: FakeAudioContext | null = null;

  readonly currentTime = 12;
  readonly destination = { kind: 'destination' };
  readonly oscillators: FakeOscillatorNode[] = [];
  readonly gains: FakeGainNode[] = [];
  state: AudioContextState = 'running';
  readonly resume = vi.fn(async () => undefined);
  readonly close = vi.fn(async () => undefined);

  constructor() {
    FakeAudioContext.latest = this;
  }

  createOscillator(): FakeOscillatorNode {
    const oscillator = new FakeOscillatorNode();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain(): FakeGainNode {
    const gain = new FakeGainNode();
    this.gains.push(gain);
    return gain;
  }
}

afterEach(() => {
  FakeAudioContext.latest = null;
  vi.unstubAllGlobals();
});

describe('createMusicBar', () => {
  it('cycles through a repeating chord pattern for the background music loop', () => {
    expect(createMusicBar(0)).toEqual([57, 64, 69]);
    expect(createMusicBar(1)).toEqual([60, 67, 72]);
    expect(createMusicBar(4)).toEqual([57, 64, 69]);
  });
});

describe('createGameAudio', () => {
  it('layers a pitch-shaped jump cue instead of static MIDI-like notes', () => {
    const audio = createGameAudio(FakeAudioContext as unknown as typeof AudioContext);
    audio.playJump();

    const context = FakeAudioContext.latest;
    expect(context).not.toBeNull();
    expect(context!.oscillators).toHaveLength(3);
    expect(context!.oscillators.map((oscillator) => oscillator.type)).toEqual([
      'triangle',
      'sawtooth',
      'sine',
    ]);

    const [body, air, tail] = context!.oscillators;

    expect(body.frequency.events).toEqual([
      { method: 'setValueAtTime', value: 196, time: 12 },
      { method: 'exponentialRampToValueAtTime', value: 392, time: 12.2 },
    ]);
    expect(air.frequency.events).toEqual([
      { method: 'setValueAtTime', value: 294, time: 12 },
      { method: 'exponentialRampToValueAtTime', value: 540, time: 12.14 },
    ]);
    expect(tail.frequency.events).toEqual([
      { method: 'setValueAtTime', value: 523.25, time: 12 },
      { method: 'exponentialRampToValueAtTime', value: 392, time: 12.22 },
    ]);

    expect(context!.gains.slice(2).map((gain) => gain.gain.events)).toEqual([
      [
        { method: 'setValueAtTime', value: 0.0001, time: 12 },
        { method: 'linearRampToValueAtTime', value: 0.055, time: 12.008 },
        { method: 'exponentialRampToValueAtTime', value: 0.0001, time: 12.2 },
      ],
      [
        { method: 'setValueAtTime', value: 0.0001, time: 12 },
        { method: 'linearRampToValueAtTime', value: 0.018, time: 12.003 },
        { method: 'exponentialRampToValueAtTime', value: 0.0001, time: 12.14 },
      ],
      [
        { method: 'setValueAtTime', value: 0.0001, time: 12 },
        { method: 'linearRampToValueAtTime', value: 0.02, time: 12.012 },
        { method: 'exponentialRampToValueAtTime', value: 0.0001, time: 12.22 },
      ],
    ]);

    audio.dispose();
    expect(context!.close).toHaveBeenCalledTimes(1);
  });
});
