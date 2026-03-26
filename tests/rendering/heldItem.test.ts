import { describe, expect, it } from 'vitest';

import {
  getActivePlaceableBlock,
  isHeldItemType,
  reconcileActiveHotbarItem,
} from '../../src/rendering/heldItem.ts';

describe('reconcileActiveHotbarItem', () => {
  it('keeps the current active tool when it is still owned in the hotbar', () => {
    expect(reconcileActiveHotbarItem(
      'stone-pickaxe',
      ['oak-log', 'stone-pickaxe', null, null, null, null, null, null, null],
      (type) => type !== 'furnace',
      'oak-log',
    )).toBe('stone-pickaxe');
  });

  it('prefers an externally selected tool when it is still owned in the hotbar', () => {
    expect(reconcileActiveHotbarItem(
      'oak-log',
      ['oak-log', 'stone-pickaxe', null, null, null, null, null, null, null],
      () => true,
      'oak-log',
      'stone-pickaxe',
    )).toBe('stone-pickaxe');
  });

  it('falls back to the selected block when the previous active item disappears', () => {
    expect(reconcileActiveHotbarItem(
      'stone-pickaxe',
      ['oak-log', 'crafting-table', null, null, null, null, null, null, null],
      (type) => type !== 'stone-pickaxe',
      'crafting-table',
    )).toBe('crafting-table');
  });
});

describe('held item helpers', () => {
  it('marks only hotbar blocks and tools as visible held items', () => {
    expect(isHeldItemType('stone-pickaxe')).toBe(true);
    expect(isHeldItemType('crafting-table')).toBe(true);
    expect(isHeldItemType('coal')).toBe(false);
  });

  it('returns placeable blocks and excludes tools from placement', () => {
    expect(getActivePlaceableBlock('furnace')).toBe('furnace');
    expect(getActivePlaceableBlock('wooden-sword')).toBeNull();
  });
});
