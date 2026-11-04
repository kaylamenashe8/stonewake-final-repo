import { test, expect } from '../../../src/fixtures';
import { aiGenerated, requirement } from '../../../src/utils/annotations';
import { PORTFOLIO_TILE_STATUSES, PortfolioPage } from '../../generated/pages/PortfolioPage';
import { fetchPortfolioSummary } from '../../generated/pages/portfolioApi';

test.describe('Portfolio status tiles @regression', () => {
  test('should show the same status counts as the API portfolio summary when Portfolio is opened', async ({
    page,
    api,
  }) => {
    requirement('T15');
    aiGenerated('5c24557');
    const portfolio = new PortfolioPage(page);

    const summary = await test.step('read GET /v1/portfolio/summary', async () => {
      const res = await fetchPortfolioSummary(api);
      expect(res.status).toBe(200);
      return res.body;
    });

    await test.step('every status tile and the active exposures match the API', async () => {
      await portfolio.goto();
      const expected = Object.fromEntries(PORTFOLIO_TILE_STATUSES.map((s) => [s, summary.statuses[s]]));
      // Polled: tiles render their counts after the page's own summary request.
      await expect.poll(() => portfolio.tileCounts()).toEqual(expected);
      expect(await portfolio.activeExposures()).toBe(summary.active_exposures);
    });
  });
});
