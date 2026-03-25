import { PLACEABLE_BLOCK_TYPES } from '../gameplay/blocks.ts';
import {
  MATERIAL_ITEM_TYPES,
  STATION_ITEM_TYPES,
  TOOL_ITEM_TYPES,
  type InventoryItemType,
} from '../gameplay/progression.ts';

export type InventoryIconCategory = 'block' | 'material' | 'tool' | 'station';

export interface InventoryIconDefinition {
  readonly type: InventoryItemType;
  readonly label: string;
  readonly category: InventoryIconCategory;
  readonly reference: string;
  readonly checklistStatus: 'ui-placeholder-ready' | 'needs-final-art';
}

const TYPE_ORDER = [
  ...PLACEABLE_BLOCK_TYPES,
  ...MATERIAL_ITEM_TYPES,
  ...TOOL_ITEM_TYPES,
  ...STATION_ITEM_TYPES,
] as const;

const categoryByType = new Map<InventoryItemType, InventoryIconCategory>([
  ...PLACEABLE_BLOCK_TYPES.map((type) => [type, 'block'] as const),
  ...MATERIAL_ITEM_TYPES.map((type) => [type, 'material'] as const),
  ...TOOL_ITEM_TYPES.map((type) => [type, 'tool'] as const),
  ...STATION_ITEM_TYPES.map((type) => [type, 'station'] as const),
]);

const labelOverrides: Partial<Record<InventoryItemType, string>> = {
  'oak-log': 'Oak Log',
  'oak-planks': 'Oak Planks',
  'oak-leaves': 'Oak Leaves',
  'crafting-table': 'Crafting Table',
  'wooden-pickaxe': 'Wooden Pickaxe',
  'stone-pickaxe': 'Stone Pickaxe',
  'iron-pickaxe': 'Iron Pickaxe',
  'wooden-sword': 'Wooden Sword',
  'stone-sword': 'Stone Sword',
  'iron-sword': 'Iron Sword',
  'iron-ore': 'Iron Ore',
  'iron-ingot': 'Iron Ingot',
  'gold-ore': 'Gold Ore',
  'gold-ingot': 'Gold Ingot',
};

function defaultLabel(type: InventoryItemType): string {
  return type
    .split('-')
    .map((part) => `${part.slice(0, 1).toUpperCase()}${part.slice(1)}`)
    .join(' ');
}

export const INVENTORY_ICON_CATALOG: readonly InventoryIconDefinition[] = [...new Set(TYPE_ORDER)].map((type) => ({
  type,
  label: labelOverrides[type] ?? defaultLabel(type),
  category: categoryByType.get(type) ?? 'material',
  reference: 'Minecraft inventory icon silhouette, color family, and slot readability',
  checklistStatus: 'needs-final-art',
}));

export function getInventoryIcon(type: InventoryItemType): InventoryIconDefinition {
  const icon = INVENTORY_ICON_CATALOG.find((entry) => entry.type === type);

  if (!icon) {
    throw new Error(`Missing inventory icon definition for ${type}.`);
  }

  return icon;
}
