import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { PORTFOLIO_TILES, PortfolioPage } from '../../../src/pages/PortfolioPage';

test.describe('Portfolio', () => {
  test('ui 10 portfolio: should show every status tile and open a company when it is clicked @regression', async ({
    page,
  }) => {
    requirement('REQ-PORT-01');
    const portfolio = new PortfolioPage(page);
    await portfolio.goto();

    // Every tile renders, even at a count of 0 (structure, not today's numbers: C4).
    for (const key of PORTFOLIO_TILES) {
      await expect(portfolio.tile(key), `tile-${key}`).toBeVisible();
      await expect(portfolio.tile(key)).toHaveText(/\d+/);
    }

    const company = portfolio.companyLinks().first();
    await expect(company).toBeVisible();
    const name = (await company.innerText()).trim();
    await company.click();
    await expect(page).toHaveURL((url) => /^\/entities\/n\d+$/.test(url.pathname));
    await expect(portfolio.pageHeading()).toHaveText(name);
  });
});
