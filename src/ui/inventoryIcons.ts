import { PLACEABLE_BLOCK_TYPES } from '../gameplay/blocks.ts';
import {
  MATERIAL_ITEM_TYPES,
  STATION_ITEM_TYPES,
  TOOL_ITEM_TYPES,
  type InventoryItemType,
} from '../gameplay/progression.ts';

export type InventoryIconCategory = 'block' | 'material' | 'tool' | 'station';
export type InventoryIconSource = 'repo-authored-svg';

export interface InventoryIconDefinition {
  readonly type: InventoryItemType;
  readonly label: string;
  readonly category: InventoryIconCategory;
  readonly reference: string;
  readonly checklistStatus: 'final-art-ready';
  readonly source: InventoryIconSource;
  readonly sourcePath: string;
  readonly assetPath: string;
  readonly pixelGrid: '16x16';
  readonly artNotes: string;
}

function normalizeAssetBasePath(value: string): string {
  if (value === '/' || value === '') {
    return '/';
  }

  return value.endsWith('/') ? value : `${value}/`;
}

export function resolveInventoryIconAssetPath(
  type: InventoryItemType,
  basePath = import.meta.env.BASE_URL,
): string {
  const normalizedBasePath = normalizeAssetBasePath(basePath);
  return `${normalizedBasePath}textures/inventory/${type}.svg`;
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

const artNotesByType: Partial<Record<InventoryItemType, string>> = {
  grass: 'Dirt block face with a bright grass cap for fast terrain recognition.',
  dirt: 'Warm soil block tile with subtle stone flecks.',
  stone: 'Neutral stone block tile with light and dark mineral variation.',
  cobblestone: 'Chunkier gray block clusters to separate crafted stone from raw stone.',
  sand: 'Warm pale block tile with light grain noise.',
  sandstone: 'Layered sediment bands so recipes scan apart from loose sand.',
  gravel: 'Muted speckled aggregate tile.',
  snow: 'Snow cap over dirt to preserve the world-material cue from gameplay.',
  'oak-log': 'Top-down growth-ring cut that reads as wood at hotbar scale.',
  'oak-planks': 'Layered plank bands with warm oak shading.',
  'oak-leaves': 'Dense green canopy tile with translucent highlight clusters.',
  cactus: 'Tall segmented cactus slice with rib highlights and spines.',
  deepslate: 'Dark striated stone tile to separate late-game stone from regular stone.',
  'crafting-table': 'Workbench face with a bright top strip and twin tool-grid panels.',
  furnace: 'Stone furnace front with lit firebox opening.',
  stick: 'Single diagonal stick silhouette for crafting readability.',
  coal: 'Angular coal chunk with a cool highlight.',
  'iron-ore': 'Stone tile with copper-brown iron flecks.',
  'iron-ingot': 'Silver ingot bar with beveled top edge.',
  'gold-ore': 'Stone tile with bright gold flecks.',
  'gold-ingot': 'Bright gold ingot bar with a darker base.',
  diamond: 'Cyan faceted gem silhouette with bright crown highlight.',
  'wooden-pickaxe': 'Wood head and handle on the standard Minecraft pickaxe angle.',
  'stone-pickaxe': 'Gray pickaxe head over a wood handle.',
  'iron-pickaxe': 'Bright metal pickaxe head over a wood handle.',
  'wooden-sword': 'Warm wood blade silhouette with a darker hilt.',
  'stone-sword': 'Stone blade silhouette tuned darker than iron.',
  'iron-sword': 'Bright iron blade silhouette with cooler guard shading.',
};

function createInventoryIconDefinition(type: InventoryItemType): InventoryIconDefinition {
  return {
    type,
    label: labelOverrides[type] ?? defaultLabel(type),
    category: categoryByType.get(type) ?? 'material',
    reference: 'Minecraft-style 16x16 SVG inventory icon with transparent background and hotbar-scale readability.',
    checklistStatus: 'final-art-ready',
    source: 'repo-authored-svg',
    sourcePath: 'scripts/generateInventoryIcons.mjs',
    assetPath: resolveInventoryIconAssetPath(type),
    pixelGrid: '16x16',
    artNotes: artNotesByType[type] ?? 'Minecraft-style inventory icon silhouette aligned to the item family.',
  };
}

export const INVENTORY_ICON_CATALOG: readonly InventoryIconDefinition[] = [...new Set(TYPE_ORDER)].map(
  createInventoryIconDefinition,
);

const iconByType = new Map(INVENTORY_ICON_CATALOG.map((entry) => [entry.type, entry] as const));

export function getInventoryIcon(type: InventoryItemType): InventoryIconDefinition {
  const icon = iconByType.get(type);

  if (!icon) {
    throw new Error(`Missing inventory icon definition for ${type}.`);
  }

  return icon;
}
