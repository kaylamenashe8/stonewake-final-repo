import { test, expect } from '../src/fixtures';

// Seed for the Playwright test agents (planner / generator / healer): every generated test starts from
// this environment, so it uses the kit fixtures (healer, data factory, pageErrors) like real specs.
test.describe('Seed', () => {
  test('should open the base URL when the agents seed a session', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.+/);
  });
});
