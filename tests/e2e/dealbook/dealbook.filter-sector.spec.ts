import { test, expect } from '../../../src/fixtures';
import { aiGenerated, requirement } from '../../../src/utils/annotations';
import { DEAL_PAGE_SIZE, DealBookPage } from '../../generated/pages/DealBookPage';

test.describe('Deal Book sector filter @regression', () => {
  test('should list only deals of the chosen sector when a sector filter is applied', async ({ page }) => {
    requirement('T01');
    aiGenerated('e80d159');
    const dealBook = new DealBookPage(page);

    const { allTotal, sector } =
      await test.step('open the Deal Book and pick a sector from live data', async () => {
        const total = await dealBook.open();
        // Sector of the first listed deal, so the test does not depend on a fixed dataset.
        return { allTotal: total, sector: await dealBook.firstDealSector() };
      });

    const filteredTotal = await test.step(`filter by ${sector}`, () => dealBook.filterBySector(sector));

    await test.step('the list narrows to that sector only', async () => {
      await expect(page).toHaveURL(/[?&]sector=[a-z_]+/);
      expect(filteredTotal).toBeGreaterThan(0);
      expect(filteredTotal).toBeLessThan(allTotal);
      // Polled: a sector with 50+ deals keeps the row count, so the old rows could still be on screen.
      await expect
        .poll(async () => [...new Set(await dealBook.visibleDealSectors())], {
          message: `every row is ${sector}`,
        })
        .toEqual([sector]);
      await expect(await dealBook.dealRows()).toHaveCount(Math.min(filteredTotal, DEAL_PAGE_SIZE));
    });
  });
});
