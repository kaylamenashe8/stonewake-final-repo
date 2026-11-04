import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { Header } from '../../../src/components/Header';

// Universal layer (@smoke): fits any product. Recon replaces / extends on the day.
test.describe('Home @smoke', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('should load the home page when visited anonymously', async ({ page }) => {
    requirement('REQ-SMOKE-01');
    const response = await page.goto('/');
    expect(response?.status()).toBeLessThan(400);
    await expect(page).toHaveTitle(/.+/);
  });

  test('should show no console or page errors when the home page loads', async ({ page, pageErrors }) => {
    requirement('REQ-SMOKE-02');
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    expect(pageErrors).toEqual([]);
  });

  test('should resolve every main navigation link when the header is present', async ({ page, request }) => {
    requirement('REQ-SMOKE-03');
    await page.goto('/');
    const header = new Header(page);
    const hrefs = await header.navLinks().evaluateAll((links) =>
      links.map((a) => (a as HTMLAnchorElement).href).filter((h) => h.startsWith('http')),
    );
    const unique = [...new Set(hrefs)].slice(0, 15);
    const statuses = await Promise.all(unique.map(async (h) => ({ h, s: (await request.get(h)).status() })));
    expect(statuses.filter((x) => x.s >= 400)).toEqual([]);
  });
});
