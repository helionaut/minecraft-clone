import { describe, expect, it } from 'vitest';

import { BLOCK_DEFINITIONS } from '../../src/gameplay/blocks.ts';
import { generateFlatWorld } from '../../src/gameplay/world.ts';

describe('generateFlatWorld', () => {
  it('creates a deterministic block count for the configured plateau', () => {
    const world = generateFlatWorld({ radius: 2, plateauHeight: 3 });

    expect(world).toHaveLength(75);
  });

  it('places a grass cap, dirt middle, and stone base on each column', () => {
    const world = generateFlatWorld({ radius: 0, plateauHeight: 3 });

    expect(world).toEqual([
      { x: 0, y: 0, z: 0, type: 'stone' },
      { x: 0, y: 1, z: 0, type: 'dirt' },
      { x: 0, y: 2, z: 0, type: 'grass' },
    ]);
  });
});

describe('BLOCK_DEFINITIONS', () => {
  it('keeps the expected material map available for the renderer', () => {
    expect(BLOCK_DEFINITIONS.highlight.color).toBe(0xe6b84a);
    expect(BLOCK_DEFINITIONS.grass.type).toBe('grass');
  });
});
