import { expect, test } from '@playwright/test';
import type { Locator, Page } from '@playwright/test';

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

function trackInventoryIconResponses(page: Page) {
  const responses: Array<{ url: string; status: number }> = [];

  page.on('response', (response) => {
    const url = response.url();

    if (url.includes('/textures/inventory/')) {
      responses.push({
        url,
        status: response.status(),
      });
    }
  });

  return responses;
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

async function moveInventoryItemToSlot(page: Page, itemType: string, toIndex: number) {
  const sourceIndexRaw = await page.locator(`[data-item-type="${itemType}"]`).first().getAttribute('data-slot-index');

  if (!sourceIndexRaw) {
    throw new Error(`Expected inventory slot for ${itemType}.`);
  }

  const fromIndex = Number(sourceIndexRaw);

  await page.evaluate(([from, to]) => {
    const qa = (window as Window & {
      __minecraftCloneQa?: {
        moveInventorySlot: (sourceIndex: number, targetIndex: number) => void;
      };
    }).__minecraftCloneQa;

    if (!qa) {
      throw new Error('Expected QA harness.');
    }

    qa.moveInventorySlot(from, to);
  }, [fromIndex, toIndex] as const);
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

async function expectTouchHelpCollapsed(page: Page) {
  await page.waitForTimeout(2600);
  await expect(page.locator('[data-hud-status]')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Help' })).toBeVisible();
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
  const desktopIconResponses = trackInventoryIconResponses(desktopPage);
  await seedInventory(desktopPage);

  await desktopPage.goto('./?qaHarness=1', { waitUntil: 'domcontentloaded' });
  await expect(desktopPage.getByRole('button', { name: 'Inventory' })).toBeVisible();
  await expect(desktopPage.locator('[data-prompt]')).toBeVisible();
  await expect(desktopPage.locator('.hotbar-shell')).toBeVisible();
  await desktopPage.screenshot({ path: testInfo.outputPath('desktop-shell.png') });
  await desktopPage.getByRole('button', { name: 'Inventory' }).click();
  await expect(desktopPage.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  await expect(desktopPage.getByRole('button', { name: 'Reset world' })).toBeVisible();
  const desktopOakLogSlot = desktopPage.locator('[data-item-type="oak-log"]').first();
  await expect(desktopOakLogSlot).toBeVisible();
  await expect(desktopOakLogSlot.locator('.item-icon')).toBeVisible();
  await expect
    .poll(() => desktopIconResponses.filter((response) => response.url.includes('oak-log.svg')).at(-1)?.status)
    .toBe(200);
  await moveInventoryItemToSlot(desktopPage, 'oak-log', 27);
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
  const mobileIconResponses = trackInventoryIconResponses(mobilePage);
  await seedInventory(mobilePage);

  await mobilePage.goto('./?qaHarness=1', { waitUntil: 'domcontentloaded' });
  const moveStick = mobilePage.locator('[data-move-stick]');
  const jumpButton = mobilePage.getByRole('button', { name: 'Jump' });
  const inventoryButton = mobilePage.getByRole('button', { name: 'Inventory' });

  await expectTouchHelpCollapsed(mobilePage);
  await expect(moveStick).toBeVisible();
  await expect(jumpButton).toBeVisible();
  await expect(inventoryButton).toBeVisible();
  await expectVisibleInViewport(moveStick);
  await expectVisibleInViewport(jumpButton);
  await expectVisibleInViewport(inventoryButton);
  await mobilePage.screenshot({ path: testInfo.outputPath('mobile-shell-390x844.png') });

  await clickButtonBySelector(mobilePage, '[data-open-help]');
  await expect(mobilePage.locator('[data-hud-status]')).toBeVisible();
  await clickButtonBySelector(mobilePage, '[data-dismiss-help]');
  await expect(mobilePage.locator('[data-hud-status]')).toBeHidden();

  await clickButtonBySelector(mobilePage, '[data-open-menu]');
  const closeButton = mobilePage.getByRole('button', { name: 'Close' });
  const resetButton = mobilePage.getByRole('button', { name: 'Reset world' });
  await expect(mobilePage.getByRole('heading', { name: 'Inventory' })).toBeVisible();
  const mobileOakLogSlot = mobilePage.locator('[data-item-type="oak-log"]').first();
  await expect(mobileOakLogSlot).toBeVisible();
  await expect(mobileOakLogSlot.locator('.item-icon')).toBeVisible();
  await expect(mobileOakLogSlot.locator('.item-icon')).toHaveAttribute('style', /oak-log\.svg/);
  await expect
    .poll(() => mobileIconResponses.filter((response) => response.url.includes('oak-log.svg')).at(-1)?.status)
    .toBe(200);
  await moveInventoryItemToSlot(mobilePage, 'oak-log', 27);
  await expect(mobilePage.locator('[data-slot-index="27"][data-item-type="oak-log"]')).toBeVisible();
  await expect(closeButton).toBeVisible();
  await expect(resetButton).toBeVisible();
  await expectVisibleInViewport(closeButton);
  await mobilePage.screenshot({ path: testInfo.outputPath('mobile-inventory-390x844.png') });
  await resetButton.scrollIntoViewIfNeeded();
  await expectVisibleInViewport(resetButton);
  await clickButtonBySelector(mobilePage, 'button[data-close-menu]');
  await mobileContext.close();

  const mobileLandscapeContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const mobileLandscapePage = await mobileLandscapeContext.newPage();
  await seedInventory(mobileLandscapePage);

  await mobileLandscapePage.goto('./?qaHarness=1', { waitUntil: 'domcontentloaded' });
  await expectTouchHelpCollapsed(mobileLandscapePage);
  const landscapeMoveStick = mobileLandscapePage.locator('[data-move-stick]');
  const landscapeJumpButton = mobileLandscapePage.getByRole('button', { name: 'Jump' });
  const landscapeInventoryButton = mobileLandscapePage.getByRole('button', { name: 'Inventory' });
  await expect(landscapeMoveStick).toBeVisible();
  await expect(landscapeJumpButton).toBeVisible();
  await expect(landscapeInventoryButton).toBeVisible();
  await expectVisibleInViewport(landscapeMoveStick);
  await expectVisibleInViewport(landscapeJumpButton);
  await expectVisibleInViewport(landscapeInventoryButton);
  await mobileLandscapePage.screenshot({ path: testInfo.outputPath('mobile-shell-844x390.png') });
  await mobileLandscapeContext.close();
});
