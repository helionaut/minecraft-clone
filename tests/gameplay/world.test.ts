import { describe, expect, it } from 'vitest';

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
  it('is deterministic for the same config and coordinates', () => {
    const bounds = {
      minX: -16,
      maxX: 16,
      minY: DEFAULT_WORLD_CONFIG.minY,
      maxY: DEFAULT_WORLD_CONFIG.maxY,
      minZ: -16,
      maxZ: 16,
    };

    expect(generateWorld(DEFAULT_WORLD_CONFIG, bounds)).toEqual(
      generateWorld(DEFAULT_WORLD_CONFIG, bounds),
    );
  });

  it('produces deeper terrain with progression materials and fluids', () => {
    const world = generateWorld(DEFAULT_WORLD_CONFIG, {
      minX: -32,
      maxX: 32,
      minY: DEFAULT_WORLD_CONFIG.minY,
      maxY: DEFAULT_WORLD_CONFIG.maxY,
      minZ: -32,
      maxZ: 32,
    });
    const blockTypes = new Set(world.map((block) => block.type));
    let minY = Number.POSITIVE_INFINITY;
    let maxY = Number.NEGATIVE_INFINITY;

    for (const block of world) {
      minY = Math.min(minY, block.y);
      maxY = Math.max(maxY, block.y);
    }

    expect(DEFAULT_WORLD_CONFIG.chunkSize).toBeGreaterThanOrEqual(16);
    expect(minY).toBe(DEFAULT_WORLD_CONFIG.minY);
    expect(maxY).toBeGreaterThan(DEFAULT_WORLD_CONFIG.seaLevel + 6);
    expect([...blockTypes]).toEqual(
      expect.arrayContaining([
        'bedrock',
        'grass',
        'stone',
        'deepslate',
        'coal-ore',
        'iron-ore',
        'diamond-ore',
        'water',
        'lava',
      ]),
    );
  });
});

describe('VoxelWorld', () => {
  it('streams deterministic chunk data for distant coordinates', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    const nearChunk = world.getChunk(0, 0);
    const farChunk = world.getChunk(12, -8);

    expect(nearChunk.key).toBe('0,0');
    expect(farChunk.key).toBe('12,-8');
    expect(world.getLoadedChunkKeys()).toEqual(expect.arrayContaining(['0,0', '12,-8']));
    expect(world.getBlock(12 * DEFAULT_WORLD_CONFIG.chunkSize, DEFAULT_WORLD_CONFIG.minY, -8 * DEFAULT_WORLD_CONFIG.chunkSize))
      .toBe('bedrock');
  });

  it('finds a deterministic spawn above non-fluid terrain', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    const spawn = world.getSpawnPoint();
    const footY = Math.floor(spawn.y - 0.02) - 1;

    expect(world.getBlock(Math.floor(spawn.x), footY, Math.floor(spawn.z))).not.toMatchObject({
      type: 'water',
    });
    expect(world.hasBlock(Math.floor(spawn.x), Math.floor(spawn.y), Math.floor(spawn.z))).toBe(false);
    expect(world.hasBlock(Math.floor(spawn.x), Math.floor(spawn.y) + 1, Math.floor(spawn.z))).toBe(false);
  });

  it('flows water and lava into newly opened cells', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);

    world.setBlock(0, 4, 0, 'water');
    world.setBlock(3, 4, 0, 'lava');
    world.setBlock(0, 3, 0, 'stone');
    world.setBlock(3, 3, 0, 'stone');
    world.setBlock(0, 4, 1, 'stone');
    world.setBlock(3, 4, 1, 'stone');

    world.removeBlock(0, 3, 0);
    world.removeBlock(3, 3, 0);
    world.tickFluids(4);

    expect(world.getBlock(0, 3, 0)).toBe('water');
    expect(world.getBlock(3, 3, 0)).toBe('lava');
  });

  it('preserves only mutations in persistence payloads', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    const spawn = world.getSpawnPoint();
    const x = Math.floor(spawn.x) + 1;
    const y = Math.floor(spawn.y) + 1;
    const z = Math.floor(spawn.z);

    expect(world.placeBlock(x, y, z, 'crafting-table')).toBe(true);
    expect(world.placeBlock(x, y + 1, z, 'furnace')).toBe(true);
    const saved = world.getPersistence();
    const restored = new VoxelWorld(
      DEFAULT_WORLD_CONFIG,
      parseWorldPersistence(JSON.stringify(saved)),
    );

    expect(saved.chunkSize).toBe(DEFAULT_WORLD_CONFIG.chunkSize);
    expect(saved.mutations).toEqual([
      { x, y, z, type: 'crafting-table' },
      { x, y: y + 1, z, type: 'furnace' },
    ]);
    expect(restored.getBlock(x, y, z)).toBe('crafting-table');
    expect(restored.getBlock(x, y + 1, z)).toBe('furnace');
  });
});
