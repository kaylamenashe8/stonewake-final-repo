import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { DealDetailSchema, DealListSchema, NOT_FOUND, UNAUTHENTICATED } from '../../src/api/schemas';

// T17 (#11), REQ-API-02. The deal under test is picked from the live list, never hardcoded.
test.describe('API deal detail @api', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('should return the same deal as its list row with detail blocks when GET /v1/deals/{id} is called', async ({ api }) => {
    requirement('REQ-API-02');
    const list = await api.call('GET', '/v1/deals', { schema: DealListSchema, params: { limit: 1 } });
    expect(list.status).toBe(200);
    const row = list.body.items[0];
    expect(row, 'the Finalist 4 Deal Book should hold at least one deal').toBeDefined();
    const id = row?.deal_id ?? '';

    const res = await api.call('GET', `/v1/deals/${id}`, { schema: DealDetailSchema });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ deal_id: id, team_id: row?.team_id, name: row?.name, first_seen_at: row?.first_seen_at });
    expect(res.body.timeline_total).toBeGreaterThanOrEqual(res.body.timeline.length);
  });

  test('should return the canonical 404 envelope when the deal id is unknown', async ({ api }) => {
    requirement('REQ-API-02');
    const res = await api.call('GET', '/v1/deals/000000000000');

    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  test('should return 401 when the deal detail is requested without a key', async ({ api }) => {
    requirement('REQ-API-02');
    api.setToken(undefined);
    const res = await api.call('GET', '/v1/deals/000000000000');

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHENTICATED);
  });
});
