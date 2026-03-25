import { expect, test } from '@playwright/test';
import type { Locator } from '@playwright/test';

async function expectVisibleInViewport(locator: Locator) {
  const box = await locator.boundingBox();

  expect(box).not.toBeNull();

  if (!box) {
    return;
  }

  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeGreaterThan(0);
  expect(box.y + box.height).toBeGreaterThan(0);
}

async function seedInventory(page: { addInitScript: (script: () => void) => Promise<void> }) {
  await page.addInitScript(() => {
    window.localStorage.setItem('minecraft-clone:inventory:v1:1337', JSON.stringify({
      'oak-log': 3,
      cobblestone: 8,
      'stone-pickaxe': 1,
    }));
    window.localStorage.removeItem('minecraft-clone:inventory-layout:v1');
  });
}

test('the deployed sandbox shell loads', async ({ page }) => {
  test.setTimeout(120_000);

  await expect(async () => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('button', { name: 'Inventory' })).toBeVisible();
    await expect(page.locator('canvas[aria-label="Minecraft clone sandbox viewport"]')).toBeVisible();
    await expect(page.locator('[data-prompt]')).toContainText('Click the viewport');

    await page.getByRole('button', { name: 'Inventory' }).click();

    await expect(page.getByRole('heading', { name: 'Inventory' })).toBeVisible();
    await expect(page.getByText('Recipe Book', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset world' })).toBeVisible();
  }).toPass({
    timeout: 90_000,
    intervals: [1_000, 2_000, 5_000, 10_000],
  });
});

test('the deployed sandbox keeps desktop and mobile controls visible in release screenshots', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);

  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
  });
  const desktopPage = await desktopContext.newPage();
  await seedInventory(desktopPage);

  await desktopPage.goto('./', { waitUntil: 'domcontentloaded' });
  await expect(desktopPage.getByRole('button', { name: 'Inventory' })).toBeVisible();
  await expect(desktopPage.locator('[data-prompt]')).toBeVisible();
  await expect(desktopPage.locator('.hotbar-shell')).toBeVisible();
  await desktopPage.screenshot({ path: testInfo.outputPath('desktop-shell.png') });
  await desktopPage.getByRole('button', { name: 'Inventory' }).click();
  await expect(desktopPage.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await expect(desktopPage.getByRole('button', { name: 'Reset world' })).toBeVisible();
  const desktopOakLogSlot = desktopPage.locator('[data-item-type="oak-log"]').first();
  await expect(desktopOakLogSlot).toBeVisible();
  await desktopOakLogSlot.click();
  await expect(desktopOakLogSlot).toHaveClass(/selected/);
  await desktopPage.locator('[data-slot-index="27"]').click();
  await expect(desktopPage.locator('[data-slot-index="27"][data-item-type="oak-log"]')).toBeVisible();
  await expectVisibleInViewport(desktopPage.getByRole('button', { name: 'Reset world' }));
  await desktopPage.screenshot({ path: testInfo.outputPath('desktop-inventory.png') });
  await desktopContext.close();

  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    hasTouch: true,
    isMobile: true,
  });
  const mobilePage = await mobileContext.newPage();
  await seedInventory(mobilePage);

  await mobilePage.goto('./', { waitUntil: 'domcontentloaded' });
  const moveStick = mobilePage.locator('[data-move-stick]');
  const jumpButton = mobilePage.getByRole('button', { name: 'Jump' });
  const inventoryButton = mobilePage.getByRole('button', { name: 'Inventory' });

  await expect(moveStick).toBeVisible();
  await expect(jumpButton).toBeVisible();
  await expect(inventoryButton).toBeVisible();
  await expectVisibleInViewport(moveStick);
  await expectVisibleInViewport(jumpButton);
  await expectVisibleInViewport(inventoryButton);
  await mobilePage.screenshot({ path: testInfo.outputPath('mobile-shell-390x844.png') });

  await inventoryButton.click();
  const closeButton = mobilePage.getByRole('button', { name: 'Close' });
  const resetButton = mobilePage.getByRole('button', { name: 'Reset world' });
  await expect(mobilePage.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  const mobileOakLogSlot = mobilePage.locator('[data-item-type="oak-log"]').first();
  await expect(mobileOakLogSlot).toBeVisible();
  await mobileOakLogSlot.click();
  await mobilePage.locator('[data-slot-index="27"]').click();
  await expect(mobilePage.locator('[data-slot-index="27"][data-item-type="oak-log"]')).toBeVisible();
  await expect(closeButton).toBeVisible();
  await expect(resetButton).toBeVisible();
  await expectVisibleInViewport(closeButton);
  await mobilePage.screenshot({ path: testInfo.outputPath('mobile-inventory-390x844.png') });
  await resetButton.scrollIntoViewIfNeeded();
  await expectVisibleInViewport(resetButton);
  await closeButton.click();

  await mobilePage.setViewportSize({ width: 844, height: 390 });
  await expect(moveStick).toBeVisible();
  await expect(jumpButton).toBeVisible();
  await expect(inventoryButton).toBeVisible();
  await expectVisibleInViewport(moveStick);
  await expectVisibleInViewport(jumpButton);
  await expectVisibleInViewport(inventoryButton);
  await mobilePage.screenshot({ path: testInfo.outputPath('mobile-shell-844x390.png') });

  await mobileContext.close();
});
