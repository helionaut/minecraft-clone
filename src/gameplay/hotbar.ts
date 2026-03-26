export type HotbarSlots<T extends string> = readonly (T | null)[];
type HasCount<T extends string> = (type: T) => boolean;

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

export function cycleHotbarSelection<T extends string>(
  current: T,
  slots: HotbarSlots<T>,
  offset: number,
  hasCount: HasCount<T>,
): T {
  const available = ownedHotbarSelections(slots, hasCount);

  if (available.length === 0) {
    return current;
  }

  const currentIndex = available.indexOf(current);

  if (currentIndex === -1) {
    return offset >= 0 ? available[0] : (available.at(-1) ?? current);
  }

  const nextIndex = (currentIndex + offset + available.length) % available.length;
  return available[nextIndex] ?? current;
}

export function getHotbarSelectionForSlot<T extends string>(
  slots: HotbarSlots<T>,
  slotIndex: number,
  hasCount: HasCount<T>,
): T | null {
  const type = slots[slotIndex];
  return type && hasCount(type) ? type : null;
}
