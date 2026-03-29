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

async function expectSelectorVisibleInViewport(page: Page, selector: string, message: string) {
  await expect
    .poll(async () => {
      return await page.evaluate((targetSelector: string) => {
        const element = document.querySelector<HTMLElement>(targetSelector);

        if (!element || element.hidden) {
          return false;
        }

        const style = window.getComputedStyle(element);

        if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
          return false;
        }

        const rect = element.getBoundingClientRect();

        return rect.width > 0
          && rect.height > 0
          && rect.bottom > 0
          && rect.right > 0
          && rect.left < window.innerWidth
          && rect.top < window.innerHeight;
      }, selector);
    }, { timeout: 30_000, message })
    .toBe(true);
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
  await expect
    .poll(async () => {
      return await page.evaluate(() => {
        const qa = (window as Window & {
          __minecraftCloneQa?: {
            getStatus: () => {
              touchDevice: boolean;
              inventory: Array<{ type: string; count: number }>;
            } | null;
          };
        }).__minecraftCloneQa;

        return qa?.getStatus()?.touchDevice === true;
      });
    }, { timeout: 30_000, message: 'Expected the mobile HUD to publish a touch-device status.' })
    .toBe(true);
  await expect(page.locator('[data-open-help]')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-hud-status]')).toBeHidden({ timeout: 10_000 });
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

test('the deployed sandbox keeps desktop controls visible in release screenshots', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
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
  await expect(desktopPage.locator('[data-hud-hotbar-slot="0"] .item-icon')).toBeVisible();
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
  await expect(desktopPage.locator('[data-slot-index="27"] .item-icon')).toBeVisible();
  await expectVisibleInViewport(desktopPage.getByRole('button', { name: 'Reset world' }));
  await desktopPage.screenshot({ path: testInfo.outputPath('desktop-inventory.png') });
  await desktopContext.close();
});

test('the deployed sandbox keeps mobile portrait controls visible in release screenshots', async ({ browser }, testInfo) => {
  test.setTimeout(180_000);
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

  await expectTouchHelpCollapsed(mobilePage);
  await expectSelectorVisibleInViewport(mobilePage, '[data-move-stick]', 'Expected the mobile move stick to be visible.');
  await expectSelectorVisibleInViewport(mobilePage, '[data-jump]', 'Expected the mobile jump button to be visible.');
  await expectSelectorVisibleInViewport(mobilePage, '[data-open-menu]', 'Expected the mobile inventory button to be visible.');
  await expectVisibleInViewport(moveStick);
  await expect(mobilePage.locator('[data-hud-hotbar-slot="0"]')).toHaveAttribute('data-item-type', /.+/);
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
  await expect(mobilePage.locator('[data-slot-index="27"] .item-icon')).toBeVisible();
  await expect(closeButton).toBeVisible();
  await expect(resetButton).toBeVisible();
  await expectVisibleInViewport(closeButton);
  await mobilePage.screenshot({ path: testInfo.outputPath('mobile-inventory-390x844.png') });
  await resetButton.scrollIntoViewIfNeeded();
  await expectVisibleInViewport(resetButton);
  await clickButtonBySelector(mobilePage, 'button[data-close-menu]');
  await mobileContext.close();
});

test('the deployed sandbox keeps mobile landscape controls visible in release screenshots', async ({ browser }, testInfo) => {
  test.setTimeout(120_000);
  const mobileLandscapeContext = await browser.newContext({
    viewport: { width: 844, height: 390 },
    hasTouch: true,
    isMobile: true,
  });
  const mobileLandscapePage = await mobileLandscapeContext.newPage();
  await seedInventory(mobileLandscapePage);

  await mobileLandscapePage.goto('./?qaHarness=1', { waitUntil: 'domcontentloaded' });
  await expectTouchHelpCollapsed(mobileLandscapePage);
  await expectSelectorVisibleInViewport(
    mobileLandscapePage,
    '[data-move-stick]',
    'Expected the landscape move stick to be visible.',
  );
  await expectSelectorVisibleInViewport(
    mobileLandscapePage,
    '[data-jump]',
    'Expected the landscape jump button to be visible.',
  );
  await expectSelectorVisibleInViewport(
    mobileLandscapePage,
    '[data-open-menu]',
    'Expected the landscape inventory button to be visible.',
  );
  await mobileLandscapePage.screenshot({ path: testInfo.outputPath('mobile-shell-844x390.png') });
  await mobileLandscapeContext.close();
});
