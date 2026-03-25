import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

import { DEFAULT_WORLD_CONFIG, VoxelWorld } from '../../src/gameplay/world.ts';

interface ResourceCell {
  readonly x: number;
  readonly y: number;
  readonly z: number;
  readonly type: 'stone' | 'coal-ore' | 'iron-ore';
}

function buildProgressionWorldSeed(): {
  readonly worldSeed: string;
  readonly resourceCells: readonly ResourceCell[];
} {
  const world = new VoxelWorld(DEFAULT_WORLD_CONFIG);
  const spawn = world.getSpawnPoint();
  const baseX = Math.floor(spawn.x) + 1;
  const baseZ = Math.floor(spawn.z);
  const resourceTypes: ResourceCell['type'][] = [
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'stone',
    'coal-ore',
    'coal-ore',
    'coal-ore',
    'iron-ore',
    'iron-ore',
    'iron-ore',
  ];
  const resourceCells: ResourceCell[] = [];
  let searchX = baseX;

  for (const type of resourceTypes) {
    let placed = false;

    while (!placed && searchX < baseX + 64) {
      for (let y = Math.floor(spawn.y) + 1; y <= Math.floor(spawn.y) + 8; y += 1) {
        if (!world.placeBlock(searchX, y, baseZ, type)) {
          continue;
        }

        resourceCells.push({ x: searchX, y, z: baseZ, type });
        placed = true;
        searchX += 1;
        break;
      }

      if (!placed) {
        searchX += 1;
      }
    }

    expect(placed).toBe(true);
  }

  return {
    worldSeed: JSON.stringify(world.getPersistence()),
    resourceCells,
  };
}

async function clickButtonBySelector(page: Page, selector: string): Promise<void> {
  const button = page.locator(selector);
  await expect(button).toBeVisible();
  await expect(button).toBeEnabled();
  await page.evaluate((buttonSelector: string) => {
    const target = document.querySelector<HTMLButtonElement>(buttonSelector);

    if (!target) {
      throw new Error(`Expected button for selector: ${buttonSelector}`);
    }

    target.click();
  }, selector);
}

test('the deployed sandbox supports a station-based gather and crafting loop with visible inventory icons', async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  const { worldSeed, resourceCells } = buildProgressionWorldSeed();

  await page.addInitScript((seededWorld: string) => {
    window.localStorage.setItem('minecraft-clone:inventory:v1:1337', JSON.stringify({
      'oak-log': 3,
    }));
    window.localStorage.removeItem('minecraft-clone:inventory-layout:v1');
    window.localStorage.setItem('minecraft-clone:world:v2:1337:16', seededWorld);
  }, worldSeed);

  await page.goto('./?qaHarness=1', { waitUntil: 'domcontentloaded' });
  await clickButtonBySelector(page, '[data-open-menu]');
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();

  const oakPlanksRecipe = page.locator('[data-recipe-id="oak-planks"]');
  const stickRecipe = page.locator('[data-recipe-id="stick"]');
  const craftingTableRecipe = page.locator('[data-recipe-id="crafting-table"]');
  const woodenPickaxeRecipe = page.locator('[data-recipe-id="wooden-pickaxe"]');
  const furnaceRecipe = page.locator('[data-recipe-id="furnace"]');
  const stonePickaxeRecipe = page.locator('[data-recipe-id="stone-pickaxe"]');
  const ironIngotRecipe = page.locator('[data-recipe-id="iron-ingot"]');
  const ironPickaxeRecipe = page.locator('[data-recipe-id="iron-pickaxe"]');

  await expect(oakPlanksRecipe.locator('.recipe-row-output .item-icon')).toHaveAttribute('style', /oak-planks\.svg/);
  await expect(craftingTableRecipe.locator('.recipe-row-output .item-icon')).toHaveAttribute('style', /crafting-table\.svg/);
  await expect(woodenPickaxeRecipe).toBeDisabled();
  await expect(stonePickaxeRecipe).toBeDisabled();
  await expect(ironIngotRecipe).toBeDisabled();

  await clickButtonBySelector(page, '[data-recipe-id="oak-planks"]');
  await clickButtonBySelector(page, '[data-recipe-id="oak-planks"]');
  await clickButtonBySelector(page, '[data-recipe-id="oak-planks"]');
  await clickButtonBySelector(page, '[data-recipe-id="stick"]');
  await expect(craftingTableRecipe).toBeEnabled();
  await clickButtonBySelector(page, '[data-recipe-id="crafting-table"]');

  const craftedTableSlot = page.locator('[data-item-type="crafting-table"]').first();
  await expect(craftedTableSlot).toBeVisible();
  await expect(craftedTableSlot.locator('.item-icon')).toBeVisible();
  const craftedTableSlotIndex = await craftedTableSlot.getAttribute('data-slot-index');

  if (!craftedTableSlotIndex) {
    throw new Error('Expected crafting table slot index.');
  }

  await page.evaluate((fromIndex: number) => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        moveInventorySlot: (fromIndex: number, toIndex: number) => void;
      };
    }).__minecraftCloneQa;

    if (!qa) {
      throw new Error('Expected QA harness.');
    }

    qa.moveInventorySlot(fromIndex, 27);
  }, Number(craftedTableSlotIndex));
  await expect(page.locator('[data-slot-index="27"][data-item-type="crafting-table"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('crafting-table-inventory.png') });
  await clickButtonBySelector(page, 'button[data-close-menu]');

  const placementProof = await page.evaluate(() => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        setSelectedBlock: (type: string) => void;
        placeSelectedBlockOnNearestSurface: () => {
          placed: boolean;
          position: { x: number; y: number; z: number } | null;
        };
        getBlockAt: (x: number, y: number, z: number) => string | null;
        getStatus: () => {
          inventory: Array<{ type: string; count: number }>;
        } | null;
      };
    }).__minecraftCloneQa;

    if (!qa) {
      throw new Error('Expected QA harness.');
    }

    qa.setSelectedBlock('crafting-table');
    const result = qa.placeSelectedBlockOnNearestSurface();

    return {
      ...result,
      placedBlock: result.position ? qa.getBlockAt(result.position.x, result.position.y, result.position.z) : null,
      inventory: qa.getStatus()?.inventory ?? [],
    };
  });

  expect(placementProof.placed).toBe(true);
  expect(placementProof.position).not.toBeNull();
  expect(placementProof.placedBlock).toBe('crafting-table');
  expect(placementProof.inventory.find((entry) => entry.type === 'crafting-table')?.count ?? 0).toBe(0);
  await page.screenshot({ path: testInfo.outputPath('crafting-table-placed.png') });

  await clickButtonBySelector(page, '[data-open-menu]');
  await expect(woodenPickaxeRecipe).toBeEnabled();
  await clickButtonBySelector(page, '[data-recipe-id="wooden-pickaxe"]');
  await expect(furnaceRecipe).toBeDisabled();
  await expect(page.locator('[data-item-type="wooden-pickaxe"]').first()).toBeVisible();

  const miningProof = await page.evaluate((cells: readonly ResourceCell[]) => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        mineBlockAt: (x: number, y: number, z: number) => { success: boolean; drop: string | null };
        getStatus: () => {
          inventory: Array<{ type: string; count: number }>;
        } | null;
      };
    }).__minecraftCloneQa;

    if (!qa) {
      throw new Error('Expected QA harness.');
    }

    const mined = cells.map((cell) => qa.mineBlockAt(cell.x, cell.y, cell.z));

    return {
      mined,
      inventory: qa.getStatus()?.inventory ?? [],
    };
  }, resourceCells);

  expect(miningProof.mined).toEqual([
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'cobblestone' },
    { success: true, drop: 'coal' },
    { success: true, drop: 'coal' },
    { success: true, drop: 'coal' },
    { success: false, drop: null },
    { success: false, drop: null },
    { success: false, drop: null },
  ]);
  expect(miningProof.inventory.find((entry) => entry.type === 'cobblestone')?.count ?? 0).toBe(11);
  expect(miningProof.inventory.find((entry) => entry.type === 'coal')?.count ?? 0).toBe(3);
  expect(miningProof.inventory.find((entry) => entry.type === 'iron-ore')?.count ?? 0).toBe(0);

  await expect(furnaceRecipe).toBeEnabled();
  await clickButtonBySelector(page, '[data-recipe-id="furnace"]');
  await expect(stonePickaxeRecipe).toBeEnabled();
  await clickButtonBySelector(page, '[data-recipe-id="stone-pickaxe"]');
  await expect(page.locator('[data-item-type="stone-pickaxe"]').first()).toBeVisible();

  const furnacePlacementProof = await page.evaluate(() => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        setSelectedBlock: (type: string) => void;
        placeSelectedBlockOnNearestSurface: () => {
          placed: boolean;
          position: { x: number; y: number; z: number } | null;
        };
        getBlockAt: (x: number, y: number, z: number) => string | null;
      };
    }).__minecraftCloneQa;

    if (!qa) {
      throw new Error('Expected QA harness.');
    }

    qa.setSelectedBlock('furnace');
    const result = qa.placeSelectedBlockOnNearestSurface();

    return {
      ...result,
      placedBlock: result.position ? qa.getBlockAt(result.position.x, result.position.y, result.position.z) : null,
    };
  });

  expect(furnacePlacementProof.placed).toBe(true);
  expect(furnacePlacementProof.placedBlock).toBe('furnace');

  const ironProof = await page.evaluate((cells: readonly ResourceCell[]) => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        mineBlockAt: (x: number, y: number, z: number) => { success: boolean; drop: string | null };
        getStatus: () => {
          inventory: Array<{ type: string; count: number }>;
        } | null;
      };
    }).__minecraftCloneQa;

    if (!qa) {
      throw new Error('Expected QA harness.');
    }

    const ironCells = cells.filter((cell) => cell.type === 'iron-ore');
    const minedIron = ironCells.map((cell) => qa.mineBlockAt(cell.x, cell.y, cell.z));

    return {
      minedIron,
      inventory: qa.getStatus()?.inventory ?? [],
    };
  }, resourceCells);

  expect(ironProof.minedIron).toEqual([
    { success: true, drop: 'iron-ore' },
    { success: true, drop: 'iron-ore' },
    { success: true, drop: 'iron-ore' },
  ]);
  expect(ironProof.inventory.find((entry) => entry.type === 'iron-ore')?.count ?? 0).toBe(3);

  await expect(ironIngotRecipe).toBeEnabled();
  await clickButtonBySelector(page, '[data-recipe-id="iron-ingot"]');
  await clickButtonBySelector(page, '[data-recipe-id="iron-ingot"]');
  await clickButtonBySelector(page, '[data-recipe-id="iron-ingot"]');
  await expect(stickRecipe).toBeEnabled();
  await clickButtonBySelector(page, '[data-recipe-id="stick"]');
  await expect(ironPickaxeRecipe).toBeEnabled();
  await clickButtonBySelector(page, '[data-recipe-id="iron-pickaxe"]');

  const finalIronPickaxeSlot = page.locator('[data-item-type="iron-pickaxe"]').first();
  await expect(finalIronPickaxeSlot).toBeVisible();
  await expect(finalIronPickaxeSlot.locator('.item-icon')).toBeVisible();
  await expect(finalIronPickaxeSlot.locator('.item-icon')).toHaveAttribute('style', /iron-pickaxe\.svg/);
  await page.screenshot({ path: testInfo.outputPath('progression-loop-inventory.png') });
});
