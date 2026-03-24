import { expect, test } from '@playwright/test';

test('the deployed sandbox shell loads', async ({ page }) => {
  test.setTimeout(120_000);

  await expect(async () => {
    await page.goto('./', { waitUntil: 'domcontentloaded' });

    await expect(page.getByRole('heading', { name: 'Playable voxel sandbox' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Reset world' })).toBeVisible();
    await expect(page.locator('canvas[aria-label="Minecraft clone sandbox viewport"]')).toBeVisible();
    await expect(page.locator('[data-prompt]')).toContainText('Click the viewport');
  }).toPass({
    timeout: 90_000,
    intervals: [1_000, 2_000, 5_000, 10_000],
  });
});
