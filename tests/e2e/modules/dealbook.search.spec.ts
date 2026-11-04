import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { DealBookPage } from '../../../src/pages/DealBookPage';

/** A search term no deal name, country or sector contains. */
const UNMATCHED_SEARCH = 'zzzzqqxx';

test.describe('Deal Book', () => {
  test('ui 7 deal book search: should show no deals for an unmatched search and open a deal when it is clicked @regression', async ({
    page,
  }) => {
    requirement('REQ-DEAL-01');
    const dealBook = new DealBookPage(page);

    const href = await test.step('open the Deal Book and note the first listed deal', async () => {
      await dealBook.goto();
      await expect(await dealBook.sectorFilter()).toBeVisible();
      await expect(await dealBook.dealsTabLocator()).toHaveAttribute('aria-selected', 'true');
      const first = await dealBook.firstDealHref();
      expect(first).toMatch(/^\/deals\/\w+$/);
      return first;
    });

    await test.step('an unmatched search lists no deals', async () => {
      await dealBook.searchFor(UNMATCHED_SEARCH);
      await expect(dealBook.dealLinks()).toHaveCount(0);
      await expect(await dealBook.noMatchMessage()).toBeVisible();
    });

    await test.step('clearing the search brings the deal back and it opens', async () => {
      await dealBook.searchFor('');
      const deal = dealBook.dealLink(href);
      await expect(deal).toBeVisible();
      await deal.click();
      await expect(page).toHaveURL((url) => url.pathname === href);
      await expect(dealBook.section('Briefing')).toBeVisible();
    });
  });
});
