import { test, expect } from '../../../src/fixtures';
import { aiGenerated, requirement } from '../../../src/utils/annotations';
import { DealBookFlows } from '../../generated/pages/DealBookFlows';
import { DealPage } from '../../generated/pages/DealPage';

test.describe('Deal Book deal detail @regression', () => {
  test('should show the briefing, key facts and a cited source when a deal is opened from the Deal Book', async ({
    page,
  }) => {
    requirement('T02');
    aiGenerated('a6ed91c');
    const dealBook = new DealBookFlows(page);
    const deal = new DealPage(page);

    const listed = await test.step('open the first deal from the Deal Book', async () => {
      await dealBook.open();
      return dealBook.openFirstDeal();
    });

    await test.step('the deal page is the deal that was listed', async () => {
      await expect(page).toHaveURL(/\/deals\/[0-9a-z]+$/);
      await deal.waitUntilReady();
      await expect(await deal.titleHeading()).toHaveText(listed.name);
      // Polled: Key facts can render after their heading.
      await expect.poll(async () => (await deal.keyFacts()).Sector).toBe(listed.sector);
    });

    await test.step('the briefing cites at least one external source', async () => {
      await expect(await deal.briefing()).toBeVisible();
      const briefingLinks = deal.briefingSourceLinks();
      await expect(briefingLinks).not.toHaveCount(0);
      // first(): one external citation is enough; the count above proves the briefing is cited.
      await expect(briefingLinks.first()).toHaveAttribute('href', /^https?:\/\//);
    });

    await test.step('an update opens its source drawer with View at source', async () => {
      const viewAtSource = await deal.openFirstSource();
      await expect(viewAtSource).toHaveAttribute('href', /^https?:\/\//);
    });
  });
});
