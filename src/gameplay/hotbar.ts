import type { HotbarBlockType } from './blocks.ts';

export type HotbarSlots = readonly (HotbarBlockType | null)[];
type HasCount = (type: HotbarBlockType) => boolean;

function ownedHotbarSelections(slots: HotbarSlots, hasCount: HasCount): HotbarBlockType[] {
  return slots.flatMap((type) => (type && hasCount(type) ? [type] : []));
}

export function reconcileHotbarSelection(
  current: HotbarBlockType,
  slots: HotbarSlots,
  hasCount: HasCount,
): HotbarBlockType {
  if (hasCount(current) && slots.includes(current)) {
    return current;
  }

  return ownedHotbarSelections(slots, hasCount)[0] ?? current;
}

export function cycleHotbarSelection(
  current: HotbarBlockType,
  slots: HotbarSlots,
  offset: number,
  hasCount: HasCount,
): HotbarBlockType {
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

export function getHotbarSelectionForSlot(
  slots: HotbarSlots,
  slotIndex: number,
  hasCount: HasCount,
): HotbarBlockType | null {
  const type = slots[slotIndex];
  return type && hasCount(type) ? type : null;
}
