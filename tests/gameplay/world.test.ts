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
    expect(generateWorld(DEFAULT_WORLD_CONFIG)).toEqual(generateWorld(DEFAULT_WORLD_CONFIG));
  });

  it('produces a larger and more varied world with multiple materials and fluids', () => {
    const world = generateWorld(DEFAULT_WORLD_CONFIG);
    const blockTypes = new Set(world.map((block) => block.type));
    const minY = Math.min(...world.map((block) => block.y));
    const maxY = Math.max(...world.map((block) => block.y));

    expect(DEFAULT_WORLD_CONFIG.radius).toBeGreaterThan(12);
    expect(minY).toBeLessThan(0);
    expect(maxY).toBeGreaterThan(DEFAULT_WORLD_CONFIG.seaLevel + 4);
    expect([...blockTypes]).toEqual(
      expect.arrayContaining([
        'grass',
        'stone',
        'sand',
        'snow',
        'water',
        'lava',
        'oak-log',
        'oak-leaves',
        'cactus',
      ]),
    );
  });

  it('adds deterministic surface decorations that match biome surfaces', () => {
    const world = generateWorld(DEFAULT_WORLD_CONFIG);
    const byKey = new Map(world.map((block) => [`${block.x},${block.y},${block.z}`, block.type]));
    const logs = world.filter((block) => block.type === 'oak-log');
    const leaves = world.filter((block) => block.type === 'oak-leaves');
    const cacti = world.filter((block) => block.type === 'cactus');

    expect(logs).not.toHaveLength(0);
    expect(leaves.length).toBeGreaterThan(logs.length);
    expect(cacti).not.toHaveLength(0);

    for (const block of cacti) {
      const below = byKey.get(`${block.x},${block.y - 1},${block.z}`);
      expect(['sand', 'cactus']).toContain(below);
    }
  });
});

describe('VoxelWorld', () => {
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

  it('keeps the central spawn area clear of decoration columns', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);

    for (let x = -2; x <= 2; x += 1) {
      for (let z = -2; z <= 2; z += 1) {
        for (let y = DEFAULT_WORLD_CONFIG.seaLevel + 1; y <= DEFAULT_WORLD_CONFIG.maxY + 1; y += 1) {
          expect(world.getBlock(x, y, z)).not.toBe('oak-log');
          expect(world.getBlock(x, y, z)).not.toBe('cactus');
        }
      }
    }
  });

  it('removes and places blocks while preserving persistence diffs', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    const spawn = world.getSpawnPoint();
    const x = Math.floor(spawn.x);
    const z = Math.floor(spawn.z);
    const groundY = Math.floor(spawn.y) - 1;

    expect(world.removeBlock(x, groundY, z)).toBe(true);
    expect(world.placeBlock(x, groundY, z, 'stone')).toBe(true);
    expect(world.placeBlock(0, DEFAULT_WORLD_CONFIG.minY - 1, 0, 'stone')).toBe(false);

    expect(world.getPersistence().mutations).toEqual([
      { x, y: groundY, z, type: 'stone' },
    ]);
  });

  it('restores saved mutations and ignores malformed persistence', () => {
    const base = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    const spawn = base.getSpawnPoint();
    const x = Math.floor(spawn.x);
    const z = Math.floor(spawn.z);
    const groundY = Math.floor(spawn.y) - 1;

    base.removeBlock(x, groundY, z);
    base.placeBlock(x, groundY + 1, z, 'grass');
    const saved = base.getPersistence();

    const restored = new VoxelWorld(
      DEFAULT_WORLD_CONFIG,
      parseWorldPersistence(JSON.stringify(saved)),
    );

    expect(restored.getBlock(x, groundY, z)).toBeNull();
    expect(restored.getBlock(x, groundY + 1, z)).toBe('grass');
    expect(parseWorldPersistence('{bad json')).toBeNull();
  });

  it('resets back to the deterministic baseline', () => {
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    const spawn = world.getSpawnPoint();
    const x = Math.floor(spawn.x);
    const z = Math.floor(spawn.z);
    const groundY = Math.floor(spawn.y) - 1;

    world.removeBlock(x, groundY, z);
    world.placeBlock(x, groundY + 1, z, 'dirt');
    world.reset();

    expect(world.getPersistence().mutations).toEqual([]);
    expect(world.getBlock(x, groundY, z)).not.toBeNull();
    expect(world.getBlock(x, groundY + 1, z)).toBeNull();
  });
});

describe('BLOCK_DEFINITIONS', () => {
  it('keeps expected metadata available for rendering and lighting', () => {
    expect(BLOCK_DEFINITIONS.highlight.color).toBe(0xe6b84a);
    expect(BLOCK_DEFINITIONS.grass.texture.top).toBe('grass-top');
    expect(BLOCK_DEFINITIONS['oak-log'].texture.side).toBe('oak-log-side');
    expect(BLOCK_DEFINITIONS.cactus.texture.top).toBe('cactus-top');
    expect(BLOCK_DEFINITIONS.lava.emittedLight).toBe(15);
  });
});
