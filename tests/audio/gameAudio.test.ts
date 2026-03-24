import { describe, expect, it } from 'vitest';

import { createMusicBar } from '../../src/audio/gameAudio.ts';

describe('createMusicBar', () => {
  it('cycles through a repeating chord pattern for the background music loop', () => {
    expect(createMusicBar(0)).toEqual([57, 64, 69]);
    expect(createMusicBar(1)).toEqual([60, 67, 72]);
    expect(createMusicBar(4)).toEqual([57, 64, 69]);
  });
});
