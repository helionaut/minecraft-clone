import { describe, expect, it } from 'vitest';

import { Inventory, RECIPES, resolveBlockDrop, resolveMiningOutcome } from '../../src/gameplay/progression.ts';
import { getNearbyStations } from '../../src/gameplay/stations.ts';
import { DEFAULT_WORLD_CONFIG, VoxelWorld } from '../../src/gameplay/world.ts';

describe('Inventory', () => {
  it('stacks items and crafts basic progression recipes', () => {
    const inventory = new Inventory();

    inventory.addItem('oak-log', 3);
    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.craft('stick')).toBe(true);
    expect(inventory.craft('crafting-table')).toBe(true);

    expect(inventory.getCount('oak-log')).toBe(1);
    expect(inventory.getCount('oak-planks')).toBe(2);
    expect(inventory.getCount('stick')).toBe(4);
    expect(inventory.getCount('crafting-table')).toBe(1);
  });

  it('supports the full wood to placed crafting table to wooden tools loop', () => {
    const inventory = new Inventory();

    inventory.addItem('oak-log', 3);

    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.getCount('oak-planks')).toBe(12);

    expect(inventory.craft('stick')).toBe(true);
    expect(inventory.getCount('stick')).toBe(4);
    expect(inventory.getCount('oak-planks')).toBe(10);

    expect(inventory.craft('crafting-table')).toBe(true);
    expect(inventory.getCount('crafting-table')).toBe(1);
    expect(inventory.craft('wooden-pickaxe')).toBe(false);
    expect(inventory.craft('wooden-sword')).toBe(false);

    // Placing the crafting table consumes the item while unlocking station recipes nearby.
    expect(inventory.removeItem('crafting-table')).toBe(true);
    expect(inventory.getCount('crafting-table')).toBe(0);

    expect(inventory.craft('wooden-pickaxe', ['crafting-table'])).toBe(true);
    expect(inventory.craft('wooden-sword', ['crafting-table'])).toBe(true);

    expect(inventory.getCount('wooden-pickaxe')).toBe(1);
    expect(inventory.getCount('wooden-sword')).toBe(1);
    expect(inventory.getCount('oak-log')).toBe(0);
    expect(inventory.getCount('oak-planks')).toBe(1);
    expect(inventory.getCount('stick')).toBe(1);
  });

  it('unlocks wooden tools only after the crafted table is placed into the nearby world', () => {
    const inventory = new Inventory();
    const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);
    const spawn = world.getSpawnPoint();
    const playerCell = {
      x: Math.floor(spawn.x),
      y: Math.floor(spawn.y),
      z: Math.floor(spawn.z),
    };
    const tableCell = {
      x: playerCell.x + 1,
      y: playerCell.y + 1,
      z: playerCell.z,
    };

    inventory.addItem('oak-log', 3);
    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.craft('oak-planks')).toBe(true);
    expect(inventory.craft('stick')).toBe(true);
    expect(inventory.craft('crafting-table')).toBe(true);

    expect(inventory.craft('wooden-pickaxe')).toBe(false);
    expect(inventory.craft('wooden-sword')).toBe(false);
    expect(getNearbyStations(world, playerCell.x, playerCell.y, playerCell.z)).toEqual([]);

    expect(world.placeBlock(tableCell.x, tableCell.y, tableCell.z, 'crafting-table')).toBe(true);
    expect(inventory.removeItem('crafting-table')).toBe(true);

    const nearbyStations = getNearbyStations(world, playerCell.x, playerCell.y, playerCell.z);
    expect(nearbyStations).toEqual(['crafting-table']);
    expect(inventory.craft('wooden-pickaxe', nearbyStations)).toBe(true);
    expect(inventory.craft('wooden-sword', nearbyStations)).toBe(true);
    expect(inventory.getCount('wooden-pickaxe')).toBe(1);
    expect(inventory.getCount('wooden-sword')).toBe(1);
  });

  it('requires nearby crafting stations for advanced tools and smelting', () => {
    const inventory = new Inventory();
    inventory.addItem('stick', 4);
    inventory.addItem('cobblestone', 3);
    inventory.addItem('crafting-table', 1);
    inventory.addItem('iron-ore', 1);
    inventory.addItem('coal', 1);

    expect(inventory.craft('stone-pickaxe')).toBe(false);
    expect(inventory.craft('iron-ingot')).toBe(false);

    expect(inventory.craft('stone-pickaxe', ['crafting-table'])).toBe(true);
    expect(inventory.getCount('stone-pickaxe')).toBe(1);
    expect(inventory.craft('iron-ingot', ['furnace'])).toBe(true);
    expect(inventory.getCount('iron-ingot')).toBe(1);
  });
});

describe('progression rules', () => {
  it('maps representative blocks to drops', () => {
    expect(resolveBlockDrop('stone')).toBe('cobblestone');
    expect(resolveBlockDrop('diamond-ore')).toBe('diamond');
    expect(resolveBlockDrop('crafting-table')).toBe('crafting-table');
  });

  it('enforces pickaxe tiers for mining rare ores', () => {
    expect(resolveMiningOutcome('stone', null).success).toBe(false);
    expect(resolveMiningOutcome('stone', 'wooden-pickaxe').success).toBe(true);
    expect(resolveMiningOutcome('iron-ore', 'wooden-pickaxe').success).toBe(false);
    expect(resolveMiningOutcome('iron-ore', 'stone-pickaxe').success).toBe(true);
    expect(resolveMiningOutcome('diamond-ore', 'iron-pickaxe').success).toBe(true);
  });

  it('keeps the recipe registry aligned with the progression slice', () => {
    expect(RECIPES.map((recipe) => recipe.id)).toEqual(
      expect.arrayContaining([
        'oak-planks',
        'stick',
        'crafting-table',
        'furnace',
        'wooden-pickaxe',
        'stone-pickaxe',
        'iron-pickaxe',
        'wooden-sword',
        'stone-sword',
        'iron-sword',
      ]),
    );
  });
});
