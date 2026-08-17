import { expect, test } from '@playwright/test';
import { open } from './open.js';

test.describe('smoke', () => {
  test('shows the splash and a live canvas', async ({ page }) => {
    await open(page);
    await expect(
      page.getByRole('dialog', { name: 'The Library of Babel' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enter the Library' })
    ).toBeVisible();
    await expect(page.getByTestId('game-canvas')).toBeVisible();
    await expect(page.getByTestId('hud')).toHaveCount(0);
  });

  test('entering the library reveals the HUD', async ({ page }) => {
    await open(page);
    await page.getByRole('button', { name: 'Enter the Library' }).click();
    await expect(
      page.getByRole('dialog', { name: 'The Library of Babel' })
    ).toHaveCount(0);
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByText('1 galleries')).toBeVisible();
    await expect(page.getByText('0 books opened')).toBeVisible();
    await expect(page.getByText('facing', { exact: true })).toBeVisible();
  });

  test('?touch swaps in the phone controls', async ({ page }) => {
    await open(page, '/?touch');
    await expect(page.getByText('left stick — walk')).toBeVisible();
    await page.getByRole('button', { name: 'Enter the Library' }).click();
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByTestId('joystick')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Pause' })).toBeVisible();
    await expect(page.getByText('read — E')).toHaveCount(0);
  });
});
