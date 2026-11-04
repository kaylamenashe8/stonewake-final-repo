import { test, expect } from '../../../src/fixtures';
import { PORTFOLIO_STATUSES, authHeaders, json, type ValidationError } from './helpers';

// Migrated from tests/api.spec.ts (api 5-10). Read-only calls with our viewer key.

interface ListEnvelope<T> {
  items: T[];
  limit: number;
  offset: number;
  total: number;
}
interface PortfolioRow {
  id: unknown;
  label: unknown;
  active: unknown;
  status: string;
  completeness: number;
}
interface Entity {
  id: unknown;
  slug: unknown;
  display_name: unknown;
  kind: unknown;
}
interface Country {
  iso3: string;
  iso2?: string;
  name: string;
  region?: string;
  risk?: { score: number };
}
interface SearchResult {
  query: string;
  hits: { node_id: unknown; label: unknown; score: number }[];
}

test.describe('Legacy API: data reads @api @regression', () => {
  test('api 5 portfolio list: should page portfolio rows when limit is within 1-100', async ({ request }) => {
    const headers = authHeaders();
    const res = await request.get('/v1/portfolio', { headers, params: { limit: 2 } });
    expect(res.status()).toBe(200);
    const body = await json<ListEnvelope<PortfolioRow>>(res);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeLessThanOrEqual(2);
    expect(body.limit).toBe(2);
    expect(body.offset).toBe(0);
    expect(Number.isInteger(body.total)).toBe(true);
    for (const row of body.items) {
      expect(typeof row.id).toBe('number');
      expect(typeof row.label).toBe('string');
      expect(typeof row.active).toBe('boolean');
      expect(PORTFOLIO_STATUSES).toContain(row.status);
      expect(row.completeness).toBeGreaterThanOrEqual(0);
      expect(row.completeness).toBeLessThanOrEqual(1);
    }

    const max = await request.get('/v1/portfolio', { headers, params: { limit: 100 } });
    expect(max.status()).toBe(200);
    expect((await json<ListEnvelope<PortfolioRow>>(max)).limit).toBe(100);

    for (const limit of ['-1', 'abc']) {
      const bad = await request.get('/v1/portfolio', { headers, params: { limit } });
      expect(bad.status(), `limit=${limit}`).toBe(422);
    }
    const tooBig = await request.get('/v1/portfolio', { headers, params: { limit: 100000 } });
    expect(tooBig.status()).toBe(422);
    expect((await json<ValidationError>(tooBig)).detail[0]?.msg).toBe('Input should be less than or equal to 100');
  });

  test('api 6 portfolio summary: should count every active exposure when the summary is requested', async ({
    request,
  }) => {
    const headers = authHeaders();
    const res = await request.get('/v1/portfolio/summary', { headers });
    expect(res.status()).toBe(200);
    const summary = await json<{ statuses: Record<string, number>; active_exposures: number; reviews_overdue: number }>(
      res,
    );
    expect(Object.keys(summary.statuses).sort()).toEqual(PORTFOLIO_STATUSES);
    const counts = Object.values(summary.statuses);
    expect(counts.every((n) => Number.isInteger(n))).toBe(true);
    expect(Number.isInteger(summary.active_exposures)).toBe(true);
    expect(Number.isInteger(summary.reviews_overdue)).toBe(true);
    expect(counts.reduce((a, b) => a + b, 0)).toBe(summary.active_exposures);

    const list = await request.get('/v1/portfolio', { headers, params: { limit: 1 } });
    expect((await json<ListEnvelope<PortfolioRow>>(list)).total).toBe(summary.active_exposures);
  });

  test('api 7 entities: should return the same entity when it is fetched by id from the list', async ({ request }) => {
    const headers = authHeaders();
    const res = await request.get('/v1/entities', { headers, params: { limit: 2 } });
    expect(res.status()).toBe(200);
    const body = await json<ListEnvelope<Entity>>(res);
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.limit).toBe(2);
    expect(body.total).toBeGreaterThan(0);
    for (const entity of body.items) {
      expect(typeof entity.id).toBe('number');
      expect(typeof entity.slug).toBe('string');
      expect(typeof entity.display_name).toBe('string');
      expect(typeof entity.kind).toBe('string');
    }
    const [first] = body.items;
    const detail = await request.get(`/v1/entities/${String(first?.id)}`, { headers });
    expect(detail.status()).toBe(200);
    expect(await detail.json()).toEqual(first);
  });

  test('api 8 entity not found: should answer 404 or 422 when the id is unknown or malformed', async ({ request }) => {
    const headers = authHeaders();
    const missing = await request.get('/v1/entities/999999', { headers });
    expect(missing.status()).toBe(404);
    expect(await missing.json()).toEqual({ error: { code: 'not_found', message: 'Resource not found.' } });

    const malformed = await request.get('/v1/entities/abc', { headers });
    expect(malformed.status()).toBe(422);
    const err = await json<ValidationError>(malformed);
    expect(err.error.code).toBe('validation_failed');
    expect(err.detail[0]?.type).toBe('int_parsing');
    expect(err.detail[0]?.loc).toEqual(['path', 'entity_id']);

    expect((await request.get('/v1/nodes/999999999', { headers })).status()).toBe(404);
    expect((await request.get('/v1/entities/999999')).status()).toBe(401);
  });

  test('api 9 countries: should return Germany with iso2 DE when DEU is requested', async ({ request }) => {
    const headers = authHeaders();
    const res = await request.get('/v1/countries', { headers });
    expect(res.status()).toBe(200);
    const body = await json<{ regions: unknown; countries: Country[] }>(res);
    expect(Array.isArray(body.regions)).toBe(true);
    expect(body.countries.length).toBeGreaterThanOrEqual(100);
    for (const c of body.countries) {
      expect(c.iso3).toMatch(/^[A-Z]{3}$/);
      expect(typeof c.name).toBe('string');
    }
    expect(body.countries.find((c) => c.iso3 === 'DEU')?.name).toBe('Germany');

    const de = await request.get('/v1/countries/DEU', { headers });
    expect(de.status()).toBe(200);
    const country = await json<Country>(de);
    expect(country.iso3).toBe('DEU');
    // ISO 3166-1 alpha-2 for Germany is DE (the legacy test expected "GE", which is Georgia).
    expect(country.iso2).toBe('DE');
    expect(country.name).toBe('Germany');
    expect(country.region).toBe('europe');
    expect(country.risk?.score).toBeGreaterThanOrEqual(0);
    expect(country.risk?.score).toBeLessThanOrEqual(100);

    expect((await request.get('/v1/countries/ZZZ', { headers })).status()).toBe(404);
  });

  test('api 10 search: should cap hits at limit and reject limit above 25', async ({ request }) => {
    const headers = authHeaders();
    const res = await request.get('/v1/search', { headers, params: { q: 'bank', limit: 3 } });
    expect(res.status()).toBe(200);
    const body = await json<SearchResult>(res);
    expect(body.query).toBe('bank');
    expect(body.hits.length).toBeGreaterThanOrEqual(1);
    expect(body.hits.length).toBeLessThanOrEqual(3);
    for (const hit of body.hits) {
      expect(typeof hit.node_id).toBe('number');
      expect(typeof hit.label).toBe('string');
      expect(hit.score).toBeGreaterThanOrEqual(0);
      expect(hit.score).toBeLessThanOrEqual(1);
    }

    const none = await request.get('/v1/search', { headers, params: { q: 'zzzzqqqxxxyy' } });
    expect((await json<SearchResult>(none)).hits).toEqual([]);

    expect((await request.get('/v1/search', { headers })).status()).toBe(422);

    const short = await request.get('/v1/search', { headers, params: { q: 'a' } });
    expect(short.status()).toBe(422);
    expect((await json<ValidationError>(short)).detail[0]?.msg).toBe('String should have at least 2 characters');

    // API docs: search `limit` caps at 25 (the legacy test expected 50).
    const tooBig = await request.get('/v1/search', { headers, params: { q: 'bank', limit: 99999 } });
    expect(tooBig.status()).toBe(422);
    expect((await json<ValidationError>(tooBig)).detail[0]?.msg).toBe('Input should be less than or equal to 25');
  });
});
