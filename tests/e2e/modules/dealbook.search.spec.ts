import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { DealBookPage } from '../../../src/pages/DealBookPage';

test.describe('Deal Book', () => {
  test('ui 7 deal book search: should show no deals for an unmatched search and open a deal when it is clicked @regression', async ({
    page,
  }) => {
    requirement('REQ-DEAL-01');
    const dealBook = new DealBookPage(page);
    await dealBook.goto();
    await expect(await dealBook.sectorFilter()).toBeVisible();
    await expect(await dealBook.dealsTabLocator()).toHaveAttribute('aria-selected', 'true');

    // Pick whichever deal the workspace lists first (C4): no deal id or count is assumed.
    const firstDeal = dealBook.dealLinks().first();
    await expect(firstDeal).toBeVisible();
    const href = await firstDeal.getAttribute('href');
    expect(href).toMatch(/^\/deals\/\w+$/);
    const deal = page.getByRole('main').locator(`a[href="${String(href)}"]`);

    await dealBook.searchFor('zzzzqqxx');
    await expect(dealBook.noMatchMessage()).toBeVisible();
    await expect(dealBook.dealLinks()).toHaveCount(0);

    await dealBook.searchFor('');
    await expect(deal).toBeVisible();
    await deal.click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(dealBook.section('Briefing')).toBeVisible();
  });
});
