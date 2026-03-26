export type HotbarSlots<T extends string> = readonly (T | null)[];
type HasCount<T extends string> = (type: T) => boolean;

export function normalizeHotbarSlotIndex(slotCount: number, slotIndex: number): number {
  if (slotCount <= 0) {
    return 0;
  }

  return Math.min(Math.max(slotIndex, 0), slotCount - 1);
}

export function cycleHotbarSlotIndex(currentSlotIndex: number, slotCount: number, offset: number): number {
  if (slotCount <= 0) {
    return 0;
  }

  const normalizedIndex = normalizeHotbarSlotIndex(slotCount, currentSlotIndex);
  return (normalizedIndex + offset + slotCount) % slotCount;
}

function ownedHotbarSelections<T extends string>(slots: HotbarSlots<T>, hasCount: HasCount<T>): T[] {
  return slots.flatMap((type) => (type && hasCount(type) ? [type] : []));
}

export function reconcileHotbarSelection<T extends string>(
  current: T,
  slots: HotbarSlots<T>,
  hasCount: HasCount<T>,
): T {
  if (hasCount(current) && slots.includes(current)) {
    return current;
  }

  return ownedHotbarSelections(slots, hasCount)[0] ?? current;
}

export function getHotbarSelectionForSlot<T extends string>(
  slots: HotbarSlots<T>,
  slotIndex: number,
  hasCount: HasCount<T>,
): T | null {
  const type = slots[slotIndex];
  return type && hasCount(type) ? type : null;
}
