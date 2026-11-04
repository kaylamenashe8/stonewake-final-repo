import { test, expect } from '../../../src/fixtures';
import { NOT_FOUND, UNAUTHENTICATED, apiKey } from './helpers';
import {
  CountryListSchema,
  CountrySchema,
  EntityListSchema,
  EntitySchema,
  ErrorEnvelopeSchema,
  PORTFOLIO_STATUSES,
  PortfolioListSchema,
  PortfolioSummarySchema,
  SearchResultSchema,
  ValidationErrorSchema,
} from './schemas';

// Migrated from tests/api.spec.ts (api 5-10). Read-only calls with our viewer key.

/** Documented page-size caps: portfolio `limit` 1-100, search `limit` <= 25 (API docs; legacy test said 50). */
const PORTFOLIO_MAX_LIMIT = 100;
const SEARCH_MAX_LIMIT = 25;
/** Far above every cap, so the 422 is about the cap and not about the exact boundary. */
const OVERSIZED_LIMIT = 100_000;
/** Ids that are valid integers but never issued. */
const UNKNOWN_ENTITY_ID = 999_999;
const UNKNOWN_NODE_ID = 999_999_999;
/** The country reference list covers every ISO country; 100 is a floor well below that, not a live count. */
const MIN_COUNTRIES = 100;
/** Search runs over the company-register graph (reference data no lane writes); many names contain "bank". */
const SEARCH_TERM = 'bank';
const NO_MATCH_TERM = 'zzzzqqqxxxyy';

test.describe('Legacy API: data reads @api @regression', () => {
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

  test('api 7 entities: should return the same entity when it is fetched by id from the list', async ({
    api,
  }) => {
    const pageSize = 2;

    const first = await test.step(`GET /v1/entities?limit=${pageSize} returns valid entities`, async () => {
      const res = await api.call('GET', '/v1/entities', {
        schema: EntityListSchema,
        params: { limit: pageSize },
      });
      expect(res.status).toBe(200);
      // Entity shape (numeric id, slug, display_name, kind) is enforced by EntitySchema. Entities come from the
      // register graph (reference data no lane deletes), so "at least one" is stable.
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.limit).toBe(pageSize);
      expect(res.body.total).toBeGreaterThan(0);
      return EntitySchema.parse(res.body.items[0]);
    });

    await test.step('GET /v1/entities/{id} returns the same entity', async () => {
      const detail = await api.call('GET', `/v1/entities/${first.id}`, { schema: EntitySchema });
      expect(detail.status).toBe(200);
      expect(detail.body).toEqual(first);
    });
  });

  test('api 8 entity not found: should answer 404 or 422 when the id is unknown or malformed', async ({
    api,
  }) => {
    await test.step('unknown entity id answers 404 not_found', async () => {
      const missing = await api.call('GET', `/v1/entities/${UNKNOWN_ENTITY_ID}`);
      expect(missing.status).toBe(404);
      expect(ErrorEnvelopeSchema.parse(missing.body)).toEqual(NOT_FOUND);
    });

    await test.step('non-integer entity id answers 422 int_parsing on the path', async () => {
      const malformed = await api.call('GET', '/v1/entities/abc');
      expect(malformed.status).toBe(422);
      const err = ValidationErrorSchema.parse(malformed.body);
      expect(err.error.code).toBe('validation_failed');
      expect(err.detail[0]?.type).toBe('int_parsing');
      expect(err.detail[0]?.loc).toEqual(['path', 'entity_id']);
    });

    await test.step('unknown node id answers 404', async () => {
      const node = await api.call('GET', `/v1/nodes/${UNKNOWN_NODE_ID}`);
      expect(node.status).toBe(404);
      ErrorEnvelopeSchema.parse(node.body);
    });

    await test.step('the 404 route still answers 401 without a credential', async () => {
      api.setToken(undefined);
      const anonymous = await api.call('GET', `/v1/entities/${UNKNOWN_ENTITY_ID}`);
      expect(anonymous.status).toBe(401);
      expect(ErrorEnvelopeSchema.parse(anonymous.body)).toEqual(UNAUTHENTICATED);
    });
  });

  test('api 9 countries: should return Germany with iso2 DE when DEU is requested', async ({ api }) => {
    await test.step('GET /v1/countries lists the reference countries', async () => {
      const res = await api.call('GET', '/v1/countries', { schema: CountryListSchema });
      expect(res.status).toBe(200);
      // iso3 format and string names for every country are enforced by CountrySchema.
      expect(res.body.countries.length).toBeGreaterThanOrEqual(MIN_COUNTRIES);
      expect(res.body.countries.find((c) => c.iso3 === 'DEU')?.name).toBe('Germany');
    });

    await test.step('GET /v1/countries/DEU returns Germany with iso2 DE', async () => {
      const de = await api.call('GET', '/v1/countries/DEU', { schema: CountrySchema });
      expect(de.status).toBe(200);
      expect(de.body.iso3).toBe('DEU');
      // ISO 3166-1 alpha-2 for Germany is DE (the legacy test expected "GE", which is Georgia).
      expect(de.body.iso2).toBe('DE');
      expect(de.body.name).toBe('Germany');
      expect(de.body.region).toBe('europe');
      // Country risk is scored on a 0-100 scale; the value itself is live, so only the range is asserted.
      expect(de.body.risk?.score).toBeGreaterThanOrEqual(0);
      expect(de.body.risk?.score).toBeLessThanOrEqual(100);
    });

    await test.step('GET /v1/countries/ZZZ answers 404', async () => {
      const unknown = await api.call('GET', '/v1/countries/ZZZ');
      expect(unknown.status).toBe(404);
      ErrorEnvelopeSchema.parse(unknown.body);
    });
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
