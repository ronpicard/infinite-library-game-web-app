import { expect, test } from '@playwright/test';
import { open } from './open.js';

test.describe('overlays', () => {
  test('pause menu opens from the touch button and can resume', async ({ page }) => {
    await open(page, '/?touch');
    await page.getByRole('button', { name: 'Enter the Library' }).click();
    await page.getByRole('button', { name: 'Pause' }).click();

    const pause = page.getByRole('dialog', { name: 'A Pause Among the Shelves' });
    await expect(pause).toBeVisible();
    await expect(page.getByRole('slider', { name: 'brightness' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'volume' })).toBeVisible();

    await page.getByRole('button', { name: 'mute' }).click();
    await expect(page.getByRole('button', { name: 'unmute' })).toBeVisible();
    await expect(page.getByRole('slider', { name: 'volume' })).toBeDisabled();

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(pause).toHaveCount(0);
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByTestId('joystick')).toBeVisible();
  });

  test('restart from pause returns to the splash', async ({ page }) => {
    await open(page, '/?touch');
    await page.getByRole('button', { name: 'Enter the Library' }).click();
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Restart the Search' }).click();
    await expect(
      page.getByRole('dialog', { name: 'The Infinite Library' })
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Enter the Library' })
    ).toBeVisible();
    await expect(page.getByTestId('hud')).toHaveCount(0);
  });

  test('book overlay shows the clue and closes', async ({ page }) => {
    await open(page, '/?touch&preview=book');
    const book = page.getByRole('dialog', { name: 'An Account of the Way' });
    await expect(book).toBeVisible();
    await expect(page.getByText('a legible account', { exact: true })).toBeVisible();
    await expect(book.getByText(/hexagon that burns crimson/i)).toBeVisible();
    await expect(page.getByTestId('hud')).toBeVisible();

    await page.getByRole('button', { name: /close/ }).click();
    await expect(book).toHaveCount(0);
    await expect(page.getByTestId('hud')).toBeVisible();
  });

  test('book overlay closes on Escape', async ({ page }) => {
    await open(page, '/?touch&preview=book');
    const book = page.getByRole('dialog', { name: 'An Account of the Way' });
    await expect(book).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(book).toHaveCount(0);
  });

  test('pause preview can change brightness then resume', async ({ page }) => {
    await open(page, '/?touch&preview=pause');
    const pause = page.getByRole('dialog', { name: 'A Pause Among the Shelves' });
    await expect(pause).toBeVisible();

    const brightness = page.getByRole('slider', { name: 'brightness' });
    await brightness.fill('90');
    await expect(brightness).toHaveValue('90');

    await page.getByRole('button', { name: 'Resume' }).click();
    await expect(pause).toHaveCount(0);
  });

  test('mystery cutscene can be dismissed', async ({ page }) => {
    await page.clock.install();
    await open(page, '/?touch&preview=mystery');
    const mystery = page.getByRole('dialog', { name: 'Something notices' });
    await expect(mystery).toBeVisible();
    await expect(page.getByText('1 of 5')).toBeVisible();

    await page.clock.fastForward(1500);
    await page.keyboard.press('Enter');
    await page.clock.fastForward(1000);
    await expect(mystery).toHaveCount(0);
    await expect(page.getByTestId('hud')).toBeVisible();
  });

  test('crimson arrival title card is on screen', async ({ page }) => {
    await open(page, '/?touch&preview=crimson');
    await expect(page.getByTestId('crimson-arrival')).toBeVisible();
    await expect(page.getByText('The way ends here')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'The Crimson Hexagon' })
    ).toBeVisible();
    await expect(page.getByTestId('hud')).toBeVisible();
    await expect(page.getByTestId('joystick')).toHaveCount(0);
  });

  test('ending overlay can begin again', async ({ page }) => {
    await open(page, '/?preview=ending');
    const ending = page.getByRole('dialog', { name: 'The Crimson Hexagon' });
    await expect(ending).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'The Book of Sand and Certainty' })
    ).toBeVisible();
    await expect(page.getByText(/THE LIBRARY IS COMPLETE/)).toBeVisible();

    await page.getByRole('button', { name: 'Begin Again' }).click();
    await expect(
      page.getByRole('dialog', { name: 'The Infinite Library' })
    ).toBeVisible();
    await expect(ending).toHaveCount(0);
  });
});
