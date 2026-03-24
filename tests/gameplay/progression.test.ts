import { describe, expect, it } from 'vitest';

import { Inventory, RECIPES, resolveBlockDrop, resolveMiningOutcome } from '../../src/gameplay/progression.ts';

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

  it('requires a crafting table for advanced tools and weapons', () => {
    const inventory = new Inventory();
    inventory.addItem('stick', 4);
    inventory.addItem('cobblestone', 3);

    expect(inventory.craft('stone-pickaxe')).toBe(false);

    inventory.addItem('crafting-table', 1);
    expect(inventory.craft('stone-pickaxe')).toBe(true);
    expect(inventory.getCount('stone-pickaxe')).toBe(1);
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
