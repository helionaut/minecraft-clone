import { expect, test } from '@playwright/test';

test('the deployed sandbox shell loads', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Playable voxel sandbox' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset world' })).toBeVisible();
  await expect(page.locator('canvas[aria-label="Minecraft clone sandbox viewport"]')).toBeVisible();
  await expect(page.locator('[data-prompt]')).toContainText('Click the viewport');
});
