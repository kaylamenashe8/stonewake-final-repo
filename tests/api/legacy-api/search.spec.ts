import { test, expect } from '../../../src/fixtures';
import { apiKey } from './test-data-and-api-key';
import { SearchResultSchema, ValidationErrorSchema } from './response-schemas';

// Migrated from tests/api.spec.ts (api 10). Read-only calls with our viewer key.

/** Documented page-size cap: search `limit` <= 25 (API docs; legacy test said 50). */
const SEARCH_MAX_LIMIT = 25;
/** Far above every cap, so the 422 is about the cap and not about the exact boundary. */
const OVERSIZED_LIMIT = 100_000;
/** Search runs over the company-register graph (reference data no lane writes); many names contain "bank". */
const SEARCH_TERM = 'bank';
const NO_MATCH_TERM = 'zzzzqqqxxxyy';

test.describe('Legacy API: search @api @regression', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('api 10 search: should cap hits at limit and reject limit above 25', async ({ api }) => {
    const hitLimit = 3;

    await test.step(`search "${SEARCH_TERM}" with limit ${hitLimit} returns 1-${hitLimit} scored hits`, async () => {
      const res = await api.call('GET', '/v1/search', {
        schema: SearchResultSchema,
        params: { q: SEARCH_TERM, limit: hitLimit },
      });
      expect(res.status).toBe(200);
      expect(res.body.query).toBe(SEARCH_TERM);
      // Hit shape (numeric node_id, label, score in [0, 1]) is enforced by SearchResultSchema.
      expect(res.body.hits.length).toBeGreaterThanOrEqual(1);
      expect(res.body.hits.length).toBeLessThanOrEqual(hitLimit);
    });

    await test.step('search with no match returns no hits', async () => {
      const none = await api.call('GET', '/v1/search', {
        schema: SearchResultSchema,
        params: { q: NO_MATCH_TERM },
      });
      expect(none.status).toBe(200);
      expect(none.body.hits).toEqual([]);
    });

    await test.step('search without q or with a 1-character q answers 422', async () => {
      const missing = await api.call('GET', '/v1/search');
      expect(missing.status).toBe(422);
      ValidationErrorSchema.parse(missing.body);

      const short = await api.call('GET', '/v1/search', { params: { q: 'a' } });
      expect(short.status).toBe(422);
      expect(ValidationErrorSchema.parse(short.body).detail[0]?.msg).toBe(
        'String should have at least 2 characters',
      );
    });

    await test.step(`search with limit above ${SEARCH_MAX_LIMIT} answers 422`, async () => {
      const tooBig = await api.call('GET', '/v1/search', {
        params: { q: SEARCH_TERM, limit: OVERSIZED_LIMIT },
      });
      expect(tooBig.status).toBe(422);
      expect(ValidationErrorSchema.parse(tooBig.body).detail[0]?.msg).toBe(
        `Input should be less than or equal to ${SEARCH_MAX_LIMIT}`,
      );
    });
  });
});
