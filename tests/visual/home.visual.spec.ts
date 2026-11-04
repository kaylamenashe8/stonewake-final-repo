import { test } from '../../src/fixtures';
import { expectPageScreenshot } from '../../src/utils/visual';

// Baselines: `docker compose run --rm update-snapshots` (Linux, same image as CI). Never from macOS.
test.describe('Visual @visual', () => {
  test.skip(!process.env.VISUAL, 'Visual suite runs only with VISUAL=1 (after Docker baselines exist)');

  test('should match the home page baseline when rendered', async ({ page }) => {
    await page.goto('/');
    await expectPageScreenshot(page, 'home');
  });
});
