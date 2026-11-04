import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { DealBookPage } from './pages/DealBookPage';
import { DealPage } from './pages/DealPage';

test.describe('Deal Book deal detail @regression', () => {
  test('should show the briefing, key facts and a cited source when a deal is opened from the Deal Book', async ({
    page,
  }) => {
    requirement('T02');
    const dealBook = new DealBookPage(page);
    await dealBook.open();
    const listed = await dealBook.openFirstDeal();

    const deal = new DealPage(page);
    await expect(page).toHaveURL(/\/deals\/[0-9a-z]+$/);
    await deal.waitUntilReady();
    await expect(await deal.titleHeading()).toHaveText(listed.name);

    await expect(await deal.briefing()).toBeVisible();
    const briefingLinks = deal.briefingSourceLinks();
    await expect(briefingLinks).not.toHaveCount(0);
    // first(): one external citation is enough; the count above proves the briefing is cited.
    await expect(briefingLinks.first()).toHaveAttribute('href', /^https?:\/\//);

    const facts = await deal.keyFacts();
    expect(facts.Sector).toBe(listed.sector);

    const viewAtSource = await deal.openFirstSource();
    await expect(viewAtSource).toHaveAttribute('href', /^https?:\/\//);
  });
});
