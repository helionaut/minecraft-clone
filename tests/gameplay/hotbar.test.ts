import { describe, expect, it } from 'vitest';

import type { HotbarBlockType } from '../../src/gameplay/blocks.ts';
import {
  cycleHotbarSelection,
  getHotbarSelectionForSlot,
  reconcileHotbarSelection,
} from '../../src/gameplay/hotbar.ts';

function hasCountFactory(counts: Partial<Record<HotbarBlockType, number>>) {
  return (type: HotbarBlockType): boolean => (counts[type] ?? 0) > 0;
}

describe('reconcileHotbarSelection', () => {
  it('falls back to the first real hotbar item when the current selection is no longer owned', () => {
    const slots: Array<HotbarBlockType | null> = [
      null,
      'crafting-table',
      null,
      'furnace',
      null,
      null,
      null,
      null,
      null,
    ];

    expect(reconcileHotbarSelection('oak-log', slots, hasCountFactory({
      'crafting-table': 1,
      furnace: 1,
      'oak-log': 0,
    }))).toBe('crafting-table');
  });
});

describe('cycleHotbarSelection', () => {
  it('cycles only through owned hotbar items and skips empty or zero-count slots', () => {
    const slots: Array<HotbarBlockType | null> = [
      'oak-log',
      null,
      'crafting-table',
      null,
      'furnace',
      null,
      null,
      null,
      null,
    ];
    const hasCount = hasCountFactory({
      'oak-log': 0,
      'crafting-table': 1,
      furnace: 1,
    });

    expect(cycleHotbarSelection('oak-log', slots, 1, hasCount)).toBe('crafting-table');
    expect(cycleHotbarSelection('crafting-table', slots, 1, hasCount)).toBe('furnace');
    expect(cycleHotbarSelection('crafting-table', slots, -1, hasCount)).toBe('furnace');
  });
});

describe('getHotbarSelectionForSlot', () => {
  it('returns only owned items from the addressed hotbar slot', () => {
    const slots: Array<HotbarBlockType | null> = [
      null,
      'crafting-table',
      null,
      null,
      null,
      null,
      null,
      null,
      null,
    ];

    expect(getHotbarSelectionForSlot(slots, 0, hasCountFactory({ 'crafting-table': 1 }))).toBeNull();
    expect(getHotbarSelectionForSlot(slots, 1, hasCountFactory({ 'crafting-table': 1 }))).toBe('crafting-table');
  });
});
