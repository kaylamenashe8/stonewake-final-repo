import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { DEAL_PAGE_SIZE, DealBookPage } from './pages/DealBookPage';

test.describe('Deal Book sector filter @regression', () => {
  test('should list only deals of the chosen sector when a sector filter is applied', async ({ page }) => {
    requirement('T01');
    const dealBook = new DealBookPage(page);
    const allTotal = await dealBook.open();
    // Sector chosen from live data (first listed deal), so the test does not depend on a fixed dataset.
    const sector = await dealBook.firstDealSector();

    const filteredTotal = await dealBook.filterBySector(sector);

    await expect(page).toHaveURL(/[?&]sector=[a-z_]+/);
    expect(filteredTotal).toBeGreaterThan(0);
    expect(filteredTotal).toBeLessThan(allTotal);
    // Polled: a sector with 50+ deals keeps the row count, so the old rows could still be on screen.
    await expect
      .poll(async () => [...new Set(await dealBook.visibleDealSectors())], { message: `every row is ${sector}` })
      .toEqual([sector]);
    await expect(await dealBook.dealRows()).toHaveCount(Math.min(filteredTotal, DEAL_PAGE_SIZE));
  });
});
