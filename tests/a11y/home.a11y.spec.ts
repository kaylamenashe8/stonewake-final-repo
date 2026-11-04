import { test } from '../../src/fixtures';
import { expectNoSeriousA11y } from '../../src/utils/a11y';

test.describe('Accessibility @a11y', () => {
  test('should have no critical or serious axe violations when the home page loads', async ({ page }) => {
    await page.goto('/');
    await expectNoSeriousA11y(page);
  });
});
