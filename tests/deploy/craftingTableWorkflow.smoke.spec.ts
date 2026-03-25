import { expect, test } from '@playwright/test';

test('the deployed sandbox can craft and place a crafting table with visible inventory icons', async ({ page }, testInfo) => {
  test.setTimeout(120_000);

  await page.addInitScript(() => {
    window.localStorage.setItem('minecraft-clone:inventory:v1:1337', JSON.stringify({
      'oak-log': 1,
    }));
    window.localStorage.removeItem('minecraft-clone:inventory-layout:v1');
    window.localStorage.removeItem('minecraft-clone:world:v2:1337:16');
  });

  await page.goto('./?qaHarness=1', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Inventory' }).click();
  await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();

  const oakPlanksRecipe = page.locator('[data-recipe-id="oak-planks"]');
  const craftingTableRecipe = page.locator('[data-recipe-id="crafting-table"]');
  const oakPlanksOutputIcon = oakPlanksRecipe.locator('.recipe-row-output .item-icon');
  const craftingTableOutputIcon = craftingTableRecipe.locator('.recipe-row-output .item-icon');

  await expect(oakPlanksRecipe).toBeVisible();
  await expect(oakPlanksOutputIcon).toBeVisible();
  await expect(oakPlanksOutputIcon).toHaveAttribute('style', /oak-planks\.svg/);
  await expect(craftingTableRecipe).toBeVisible();
  await expect(craftingTableRecipe).toBeDisabled();

  await oakPlanksRecipe.click();
  await expect(craftingTableRecipe).toBeEnabled();
  await expect(craftingTableOutputIcon).toBeVisible();
  await expect(craftingTableOutputIcon).toHaveAttribute('style', /crafting-table\.svg/);
  await craftingTableRecipe.click();

  const craftedTableSlot = page.locator('[data-item-type="crafting-table"]').first();
  await expect(craftedTableSlot).toBeVisible();
  await expect(craftedTableSlot.locator('.item-icon')).toBeVisible();
  await page.evaluate(() => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        moveInventorySlot: (fromIndex: number, toIndex: number) => void;
      };
    }).__minecraftCloneQa;

    if (!qa) {
      throw new Error('Expected QA harness.');
    }

    qa.moveInventorySlot(0, 27);
  });
  await expect(page.locator('[data-slot-index="27"][data-item-type="crafting-table"]')).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('crafting-table-inventory.png') });
  await page.getByRole('button', { name: 'Close' }).click();

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
});
