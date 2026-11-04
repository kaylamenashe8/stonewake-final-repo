import { test, expect } from '../../../src/fixtures';
import { apiKey } from './test-data-and-api-key';
import {
  PORTFOLIO_STATUSES,
  PortfolioListSchema,
  PortfolioSummarySchema,
  ValidationErrorSchema,
} from './response-schemas';

// Migrated from tests/api.spec.ts (api 5-6). Read-only calls with our viewer key.

/** Documented page-size cap: portfolio `limit` 1-100 (API docs). */
const PORTFOLIO_MAX_LIMIT = 100;
/** Far above every cap, so the 422 is about the cap and not about the exact boundary. */
const OVERSIZED_LIMIT = 100_000;

test.describe('Legacy API: portfolio @api @regression', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('api 5 portfolio list: should page portfolio rows when limit is within 1-100', async ({ api }) => {
    const pageSize = 2;

    await test.step(`GET /v1/portfolio?limit=${pageSize} returns one page of valid rows`, async () => {
      const res = await api.call('GET', '/v1/portfolio', {
        schema: PortfolioListSchema,
        params: { limit: pageSize },
      });
      expect(res.status).toBe(200);
      // Row shape (numeric id, label, active flag, documented status, completeness in [0, 1]) is enforced
      // by PortfolioRowSchema.
      expect(res.body.items.length).toBeLessThanOrEqual(pageSize);
      expect(res.body.limit).toBe(pageSize);
      expect(res.body.offset).toBe(0);
    });

    await test.step(`GET /v1/portfolio?limit=${PORTFOLIO_MAX_LIMIT} accepts the maximum`, async () => {
      const max = await api.call('GET', '/v1/portfolio', {
        schema: PortfolioListSchema,
        params: { limit: PORTFOLIO_MAX_LIMIT },
      });
      expect(max.status).toBe(200);
      expect(max.body.limit).toBe(PORTFOLIO_MAX_LIMIT);
    });

    await test.step('GET /v1/portfolio rejects a negative or non-numeric limit with 422', async () => {
      for (const limit of ['-1', 'abc']) {
        const bad = await api.call('GET', '/v1/portfolio', { params: { limit } });
        expect(bad.status, `limit=${limit}`).toBe(422);
        ValidationErrorSchema.parse(bad.body);
      }
    });

    await test.step('GET /v1/portfolio rejects a limit above the cap with 422', async () => {
      const tooBig = await api.call('GET', '/v1/portfolio', { params: { limit: OVERSIZED_LIMIT } });
      expect(tooBig.status).toBe(422);
      expect(ValidationErrorSchema.parse(tooBig.body).detail[0]?.msg).toBe(
        `Input should be less than or equal to ${PORTFOLIO_MAX_LIMIT}`,
      );
    });
  });

  test('api 6 portfolio summary: should count every active exposure when the summary is requested', async ({
    api,
  }) => {
    await test.step('summary lists one count per documented status', async () => {
      const res = await api.call('GET', '/v1/portfolio/summary', { schema: PortfolioSummarySchema });
      expect(res.status).toBe(200);
      // Integer counts and totals are enforced by PortfolioSummarySchema.
      expect(Object.keys(res.body.statuses).sort()).toEqual([...PORTFOLIO_STATUSES]);
    });

    await test.step('status counts and the portfolio list total both equal active_exposures', async () => {
      // Portfolio data is shared with other lanes that may write between the two reads, so re-read both
      // until one consistent pair is seen instead of comparing a single snapshot.
      await expect
        .poll(async () => {
          const summary = await api.call('GET', '/v1/portfolio/summary', { schema: PortfolioSummarySchema });
          const list = await api.call('GET', '/v1/portfolio', {
            schema: PortfolioListSchema,
            params: { limit: 1 },
          });
          const active = summary.body.active_exposures;
          const statusSum = Object.values(summary.body.statuses).reduce((a, b) => a + b, 0);
          return { statusSumMinusActive: statusSum - active, listTotalMinusActive: list.body.total - active };
        })
        .toEqual({ statusSumMinusActive: 0, listTotalMinusActive: 0 });
    });
  });
});
