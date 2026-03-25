import type { PlaceableBlockType, WorldBlockType } from './blocks.ts';

export const TOOL_ITEM_TYPES = [
  'wooden-pickaxe',
  'stone-pickaxe',
  'iron-pickaxe',
  'wooden-sword',
  'stone-sword',
  'iron-sword',
] as const;

export type ToolItemType = (typeof TOOL_ITEM_TYPES)[number];

export const MATERIAL_ITEM_TYPES = [
  'oak-log',
  'oak-planks',
  'stick',
  'cobblestone',
  'coal',
  'iron-ore',
  'iron-ingot',
  'gold-ore',
  'gold-ingot',
  'diamond',
] as const;

export type MaterialItemType = (typeof MATERIAL_ITEM_TYPES)[number];

export const STATION_ITEM_TYPES = ['crafting-table', 'furnace'] as const;

export type StationItemType = (typeof STATION_ITEM_TYPES)[number];
export type InventoryItemType = PlaceableBlockType | MaterialItemType | ToolItemType | StationItemType;

export interface Recipe {
  readonly id: string;
  readonly inputs: Readonly<Partial<Record<InventoryItemType, number>>>;
  readonly outputs: Readonly<Partial<Record<InventoryItemType, number>>>;
  readonly station?: StationItemType;
}

type MiningTier = 'hand' | 'wood' | 'stone' | 'iron';

const PICKAXE_TIER: Partial<Record<ToolItemType, MiningTier>> = {
  'wooden-pickaxe': 'wood',
  'stone-pickaxe': 'stone',
  'iron-pickaxe': 'iron',
};

const TIER_ORDER: Record<MiningTier, number> = {
  hand: 0,
  wood: 1,
  stone: 2,
  iron: 3,
};

const DROP_BY_BLOCK: Partial<Record<WorldBlockType, InventoryItemType | null>> = {
  grass: 'dirt',
  dirt: 'dirt',
  stone: 'cobblestone',
  cobblestone: 'cobblestone',
  sand: 'sand',
  sandstone: 'sandstone',
  gravel: 'gravel',
  snow: 'snow',
  'oak-log': 'oak-log',
  'oak-planks': 'oak-planks',
  'oak-leaves': null,
  cactus: 'cactus',
  bedrock: null,
  deepslate: 'deepslate',
  'coal-ore': 'coal',
  'iron-ore': 'iron-ore',
  'gold-ore': 'gold-ore',
  'diamond-ore': 'diamond',
  'crafting-table': 'crafting-table',
  furnace: 'furnace',
};

const REQUIRED_TIER_BY_BLOCK: Partial<Record<WorldBlockType, MiningTier>> = {
  stone: 'wood',
  cobblestone: 'wood',
  sandstone: 'wood',
  deepslate: 'wood',
  'coal-ore': 'wood',
  'iron-ore': 'stone',
  'gold-ore': 'iron',
  'diamond-ore': 'iron',
  bedrock: 'iron',
};

export const RECIPES: readonly Recipe[] = [
  {
    id: 'oak-planks',
    inputs: { 'oak-log': 1 },
    outputs: { 'oak-planks': 4 },
  },
  {
    id: 'stick',
    inputs: { 'oak-planks': 2 },
    outputs: { stick: 4 },
  },
  {
    id: 'crafting-table',
    inputs: { 'oak-planks': 4 },
    outputs: { 'crafting-table': 1 },
  },
  {
    id: 'furnace',
    inputs: { cobblestone: 8 },
    outputs: { furnace: 1 },
    station: 'crafting-table',
  },
  {
    id: 'wooden-pickaxe',
    inputs: { 'oak-planks': 3, stick: 2 },
    outputs: { 'wooden-pickaxe': 1 },
    station: 'crafting-table',
  },
  {
    id: 'stone-pickaxe',
    inputs: { cobblestone: 3, stick: 2 },
    outputs: { 'stone-pickaxe': 1 },
    station: 'crafting-table',
  },
  {
    id: 'iron-ingot',
    inputs: { 'iron-ore': 1, coal: 1 },
    outputs: { 'iron-ingot': 1 },
    station: 'furnace',
  },
  {
    id: 'gold-ingot',
    inputs: { 'gold-ore': 1, coal: 1 },
    outputs: { 'gold-ingot': 1 },
    station: 'furnace',
  },
  {
    id: 'iron-pickaxe',
    inputs: { 'iron-ingot': 3, stick: 2 },
    outputs: { 'iron-pickaxe': 1 },
    station: 'crafting-table',
  },
  {
    id: 'wooden-sword',
    inputs: { 'oak-planks': 2, stick: 1 },
    outputs: { 'wooden-sword': 1 },
    station: 'crafting-table',
  },
  {
    id: 'stone-sword',
    inputs: { cobblestone: 2, stick: 1 },
    outputs: { 'stone-sword': 1 },
    station: 'crafting-table',
  },
  {
    id: 'iron-sword',
    inputs: { 'iron-ingot': 2, stick: 1 },
    outputs: { 'iron-sword': 1 },
    station: 'crafting-table',
  },
] as const;

function recipeById(id: string): Recipe | undefined {
  return RECIPES.find((recipe) => recipe.id === id);
}

export class Inventory {
  #counts = new Map<InventoryItemType, number>();

  clear(): void {
    this.#counts.clear();
  }

  addItem(type: InventoryItemType, quantity = 1): void {
    if (quantity <= 0) {
      return;
    }

    this.#counts.set(type, this.getCount(type) + quantity);
  }

  getCount(type: InventoryItemType): number {
    return this.#counts.get(type) ?? 0;
  }

  hasItem(type: InventoryItemType, quantity = 1): boolean {
    return this.getCount(type) >= quantity;
  }

  removeItem(type: InventoryItemType, quantity = 1): boolean {
    if (!this.hasItem(type, quantity)) {
      return false;
    }

    const nextCount = this.getCount(type) - quantity;

    if (nextCount > 0) {
      this.#counts.set(type, nextCount);
    } else {
      this.#counts.delete(type);
    }

    return true;
  }

  craft(recipeId: string, nearbyStations: readonly StationItemType[] = []): boolean {
    const recipe = recipeById(recipeId);

    if (!recipe) {
      return false;
    }

    if (
      recipe.station &&
      !this.hasItem(recipe.station) &&
      !nearbyStations.includes(recipe.station)
    ) {
      return false;
    }

    for (const [type, quantity] of Object.entries(recipe.inputs) as Array<[InventoryItemType, number]>) {
      if (!this.hasItem(type, quantity)) {
        return false;
      }
    }

    for (const [type, quantity] of Object.entries(recipe.inputs) as Array<[InventoryItemType, number]>) {
      this.removeItem(type, quantity);
    }

    for (const [type, quantity] of Object.entries(recipe.outputs) as Array<[InventoryItemType, number]>) {
      this.addItem(type, quantity);
    }

    return true;
  }

  entries(): Array<{ readonly type: InventoryItemType; readonly count: number }> {
    return [...this.#counts.entries()]
      .map(([type, count]) => ({ type, count }))
      .sort((left, right) => left.type.localeCompare(right.type));
  }

  toJSON(): Record<string, number> {
    return Object.fromEntries(this.#counts.entries());
  }

  static fromJSON(value: string | null): Inventory {
    const inventory = new Inventory();

    if (!value) {
      return inventory;
    }

    try {
      const parsed = JSON.parse(value) as Record<string, number>;

      for (const [type, quantity] of Object.entries(parsed)) {
        if (typeof quantity !== 'number' || quantity <= 0) {
          continue;
        }

        inventory.addItem(type as InventoryItemType, quantity);
      }
    } catch {
      return inventory;
    }

    return inventory;
  }
}

export function resolveBlockDrop(type: WorldBlockType): InventoryItemType | null {
  return DROP_BY_BLOCK[type] ?? (type as InventoryItemType);
}

export function resolveMiningOutcome(
  block: WorldBlockType,
  selectedTool: ToolItemType | null,
): { readonly success: boolean; readonly drop: InventoryItemType | null } {
  if (block === 'water' || block === 'lava' || block === 'bedrock') {
    return { success: false, drop: null };
  }

  const requiredTier = REQUIRED_TIER_BY_BLOCK[block] ?? 'hand';
  const currentTier = selectedTool ? (PICKAXE_TIER[selectedTool] ?? 'hand') : 'hand';

  if (TIER_ORDER[currentTier] < TIER_ORDER[requiredTier]) {
    return { success: false, drop: null };
  }

  return {
    success: true,
    drop: resolveBlockDrop(block),
  };
}
