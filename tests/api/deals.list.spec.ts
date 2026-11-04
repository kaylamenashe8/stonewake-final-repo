import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { orderViolations, toEpoch } from '../../src/api/ordering';
import { DealListSchema, MeSchema, UNAUTHENTICATED, ValidationErrorEnvelope } from '../../src/api/schemas';

// T17 (#11), REQ-API-02. Read-only; asserts structure and ordering, never exact counts (live data).
test.describe('API deals list @api', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('should return a schema-valid page scoped to the key team when GET /v1/deals is called', async ({ api }) => {
    requirement('REQ-API-02');
    const me = await api.call('GET', '/v1/me', { schema: MeSchema });
    const res = await api.call('GET', '/v1/deals', { schema: DealListSchema, params: { limit: 5 } });

    expect(me.status).toBe(200);
    expect(res.status).toBe(200);
    expect(res.body.limit).toBe(5);
    expect(res.body.offset).toBe(0);
    expect(res.body.items.length, 'the Finalist 4 Deal Book should hold deals').toBeGreaterThan(0);
    expect(res.body.items.length).toBeLessThanOrEqual(5);
    expect(res.body.total).toBeGreaterThanOrEqual(res.body.items.length);
    // A key reads exactly its issued team: every row belongs to the /me team.
    expect(me.body.team_scope).toMatchObject({ all_teams: false, teams: [expect.anything()] });
    const teamId = me.body.team_scope.teams[0]?.id;
    expect(res.body.items.filter((d) => d.team_id !== teamId)).toEqual([]);
    // Hidden rows are excluded unless include_hidden=true.
    expect(res.body.items.filter((d) => d.score_hidden)).toEqual([]);
  });

  for (const direction of ['asc', 'desc'] as const) {
    test(`should order by score ${direction} with unscored rows last when sort=score&direction=${direction}`, async ({ api }) => {
      requirement('REQ-API-02');
      const res = await api.call('GET', '/v1/deals', { schema: DealListSchema, params: { sort: 'score', direction, limit: 25 } });

      expect(res.status).toBe(200);
      expect(orderViolations(res.body.items.map((d) => d.relevance_score), direction)).toEqual([]);
    });

    test(`should order by first seen ${direction} when sort=first_seen&direction=${direction}`, async ({ api }) => {
      requirement('REQ-API-02');
      const res = await api.call('GET', '/v1/deals', { schema: DealListSchema, params: { sort: 'first_seen', direction, limit: 25 } });

      expect(res.status).toBe(200);
      expect(orderViolations(res.body.items.map((d) => toEpoch(d.first_seen_at)), direction)).toEqual([]);
    });
  }

  test('should refuse an unknown sort with a 422 naming the parameter when sort=bogus', async ({ api }) => {
    requirement('REQ-API-02');
    const res = await api.call('GET', '/v1/deals', { params: { sort: 'bogus' } });

    expect(res.status).toBe(422);
    const body = ValidationErrorEnvelope.parse(res.body);
    expect(body.detail[0]?.loc).toEqual(['query', 'sort']);
  });

  test('should refuse an ascending priority sort with a 422 when sort=priority&direction=asc', async ({ api }) => {
    requirement('REQ-API-02');
    const res = await api.call('GET', '/v1/deals', { params: { sort: 'priority', direction: 'asc' } });

    expect(res.status).toBe(422);
    const body = ValidationErrorEnvelope.parse(res.body);
    expect(body.detail[0]?.loc).toEqual(['query', 'direction']);
  });

  test('should refuse a page larger than 100 with a 422 when limit=101', async ({ api }) => {
    requirement('REQ-API-02');
    const res = await api.call('GET', '/v1/deals', { params: { limit: 101 } });

    expect(res.status).toBe(422);
    const body = ValidationErrorEnvelope.parse(res.body);
    expect(body.detail[0]).toMatchObject({ loc: ['query', 'limit'], type: 'less_than_equal' });
  });

  test('should return 401 with the uniform envelope when no key is sent', async ({ api }) => {
    requirement('REQ-API-02');
    api.setToken(undefined);
    const res = await api.call('GET', '/v1/deals', { params: { limit: 1 } });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHENTICATED);
  });
});
