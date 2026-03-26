import { describe, expect, it } from 'vitest';

import type { HotbarBlockType } from '../../src/gameplay/blocks.ts';
import {
  cycleHotbarSlotIndex,
  getHotbarSelectionForSlot,
  normalizeHotbarSlotIndex,
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

describe('normalizeHotbarSlotIndex', () => {
  it('keeps the selected slot inside the stable nine-slot range', () => {
    expect(normalizeHotbarSlotIndex(9, -1)).toBe(0);
    expect(normalizeHotbarSlotIndex(9, 3)).toBe(3);
    expect(normalizeHotbarSlotIndex(9, 12)).toBe(8);
  });
});

describe('cycleHotbarSlotIndex', () => {
  it('cycles by slot index across the stable hotbar even when slots are empty', () => {
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

    expect(cycleHotbarSlotIndex(0, slots.length, 1)).toBe(1);
    expect(cycleHotbarSlotIndex(1, slots.length, 1)).toBe(2);
    expect(cycleHotbarSlotIndex(0, slots.length, -1)).toBe(8);
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
