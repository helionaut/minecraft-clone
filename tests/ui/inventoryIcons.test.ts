import { describe, expect, it } from 'vitest';

import { PLACEABLE_BLOCK_TYPES } from '../../src/gameplay/blocks.ts';
import {
  MATERIAL_ITEM_TYPES,
  STATION_ITEM_TYPES,
  TOOL_ITEM_TYPES,
} from '../../src/gameplay/progression.ts';
import { INVENTORY_ICON_CATALOG, getInventoryIcon } from '../../src/ui/inventoryIcons.ts';

describe('inventory icon catalog', () => {
  it('covers every inventory item type used by gameplay', () => {
    const expectedTypes = new Set([
      ...PLACEABLE_BLOCK_TYPES,
      ...MATERIAL_ITEM_TYPES,
      ...TOOL_ITEM_TYPES,
      ...STATION_ITEM_TYPES,
    ]);
    const actualTypes = new Set(INVENTORY_ICON_CATALOG.map((entry) => entry.type));

    expect(actualTypes).toEqual(expectedTypes);
  });

  it('exposes readable labels and checklist metadata for every icon', () => {
    for (const type of [
      ...PLACEABLE_BLOCK_TYPES,
      ...MATERIAL_ITEM_TYPES,
      ...TOOL_ITEM_TYPES,
      ...STATION_ITEM_TYPES,
    ]) {
      const icon = getInventoryIcon(type);

      expect(icon.label.length).toBeGreaterThan(0);
      expect(icon.reference).toContain('Minecraft');
      expect(icon.checklistStatus).toBe('needs-final-art');
    }
  });
});
