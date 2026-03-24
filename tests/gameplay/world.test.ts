import { describe, expect, it } from 'vitest';

import { BLOCK_DEFINITIONS } from '../../src/gameplay/blocks.ts';
import {
  DEFAULT_WORLD_CONFIG,
  VoxelWorld,
  generateFlatWorld,
  generateWorld,
  parseWorldPersistence,
} from '../../src/gameplay/world.ts';

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

describe('generateWorld', () => {
  it('is deterministic for the same config', () => {
    const world = generateWorld(DEFAULT_WORLD_CONFIG);

    expect(world).toEqual(generateWorld(DEFAULT_WORLD_CONFIG));
    expect(world.find((block) => block.x === 0 && block.y === 3 && block.z === 0)).toEqual({
      x: 0,
      y: 3,
      z: 0,
      type: 'grass',
    });
  });

  it('produces varied terrain away from the spawn plateau', () => {
    const world = generateWorld(DEFAULT_WORLD_CONFIG);
    const centerColumnHeight = world.filter(
      (block) => block.x === 0 && block.z === 0,
    ).length;
    const edgeColumnHeight = world.filter(
      (block) => block.x === DEFAULT_WORLD_CONFIG.radius && block.z === 0,
    ).length;

    expect(centerColumnHeight).toBeGreaterThan(edgeColumnHeight);
  });
});

describe('VoxelWorld', () => {
  it('removes and places blocks while preserving persistence diffs', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);

    expect(world.removeBlock(0, 3, 0)).toBe(true);
    expect(world.placeBlock(0, 4, 0, 'stone')).toBe(true);
    expect(world.placeBlock(0, -1, 0, 'stone')).toBe(false);

    expect(world.getPersistence()).toEqual({
      version: 1,
      seed: DEFAULT_WORLD_CONFIG.seed,
      radius: DEFAULT_WORLD_CONFIG.radius,
      mutations: [
        { x: 0, y: 3, z: 0, type: null },
        { x: 0, y: 4, z: 0, type: 'stone' },
      ],
    });
  });

  it('restores saved mutations and ignores malformed persistence', () => {
    const base = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    base.removeBlock(0, 3, 0);
    base.placeBlock(1, 5, 1, 'grass');
    const saved = base.getPersistence();

    const restored = new VoxelWorld(
      DEFAULT_WORLD_CONFIG,
      parseWorldPersistence(JSON.stringify(saved)),
    );

    expect(restored.getBlock(0, 3, 0)).toBeNull();
    expect(restored.getBlock(1, 5, 1)).toBe('grass');
    expect(parseWorldPersistence('{bad json')).toBeNull();
  });

  it('resets back to the deterministic baseline', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);

    world.removeBlock(0, 3, 0);
    world.placeBlock(0, 4, 0, 'dirt');
    world.reset();

    expect(world.getPersistence().mutations).toEqual([]);
    expect(world.getBlock(0, 3, 0)).toBe('grass');
    expect(world.getBlock(0, 4, 0)).toBeNull();
  });
});

describe('BLOCK_DEFINITIONS', () => {
  it('keeps the expected material map available for the renderer', () => {
    expect(BLOCK_DEFINITIONS.highlight.color).toBe(0xe6b84a);
    expect(BLOCK_DEFINITIONS.grass.type).toBe('grass');
  });
});
