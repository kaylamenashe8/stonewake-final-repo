import { test, expect } from '../../../src/fixtures';
import { env } from '../../../src/config/env';
import { requirement } from '../../../src/utils/annotations';
import { PORTFOLIO_TILES, PortfolioPage } from '../../../src/pages/PortfolioPage';
import { PortfolioSummarySchema } from '../../api/legacy-api/response-schemas';
import { apiKey } from '../../api/legacy-api/test-data-and-api-key';

/** Absolute, because the chromium project's request baseURL is the UI host (BASE_URL), not the API host. */
const SUMMARY_URL = `${env.API_URL ?? env.BASE_URL}/v1/portfolio/summary`;
/** A reading can land between the page load and the API call; give the pair time to settle. */
const SETTLE_TIMEOUT_MS = 30_000;

test.describe('Portfolio: status tiles', () => {
  test('should show each status tile with the count the portfolio summary API reports when the portfolio is opened @regression', async ({
    page,
    api,
  }) => {
    requirement('REQ-POR-01');
    api.setToken(apiKey());
    const portfolio = new PortfolioPage(page);

    // UI and API are read together and retried as a pair, so a status change mid-read cannot fail the test (C4).
    await expect
      .poll(
        async () => {
          await portfolio.goto();
          const summary = await api.call('GET', SUMMARY_URL, { schema: PortfolioSummarySchema });
          const { statuses } = PortfolioSummarySchema.parse(summary.body);
          const tiles = await Promise.all(
            PORTFOLIO_TILES.map(async (key) => ({
              key,
              shown: Number((await portfolio.tile(key).innerText()).match(/\d+/)?.[0]),
              reported: statuses[key] ?? 0,
            })),
          );
          return tiles
            .filter(({ shown, reported }) => shown !== reported)
            .map(({ key, shown, reported }) => `${key}: tile ${shown}, API ${reported}`);
        },
        { message: 'status tiles that differ from GET /v1/portfolio/summary', timeout: SETTLE_TIMEOUT_MS },
      )
      .toEqual([]);
  });
});
