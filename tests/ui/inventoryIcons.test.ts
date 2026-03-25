import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

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

  it('exposes final asset metadata for every icon', () => {
    const assetPaths = new Set<string>();

    for (const type of [
      ...PLACEABLE_BLOCK_TYPES,
      ...MATERIAL_ITEM_TYPES,
      ...TOOL_ITEM_TYPES,
      ...STATION_ITEM_TYPES,
    ]) {
      const icon = getInventoryIcon(type);

      expect(icon.label.length).toBeGreaterThan(0);
      expect(icon.reference).toContain('Minecraft-style');
      expect(icon.checklistStatus).toBe('final-art-ready');
      expect(icon.source).toBe('repo-authored-svg');
      expect(icon.sourcePath).toBe('scripts/generateInventoryIcons.mjs');
      expect(icon.pixelGrid).toBe('16x16');
      expect(icon.assetPath).toBe(`/textures/inventory/${type}.svg`);
      expect(icon.artNotes.length).toBeGreaterThan(10);
      expect(existsSync(fileURLToPath(new URL(`../../public${icon.assetPath}`, import.meta.url)))).toBe(true);

      assetPaths.add(icon.assetPath);
    }

    expect(assetPaths.size).toBe(INVENTORY_ICON_CATALOG.length);
  });
});
