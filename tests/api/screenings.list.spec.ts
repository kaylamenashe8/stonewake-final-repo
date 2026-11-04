import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { NOT_FOUND, ScreeningListSchema, UNAUTHENTICATED, ValidationErrorEnvelope } from '../../src/api/schemas';

// T18 (#12), REQ-API-03. The Finalist 4 workspace holds no screenings today (total 0, 2026-11-04),
// so this pins the envelope and the filter validation; screening detail parity waits for data.
test.describe('API screenings @api', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('should return a schema-valid page when GET /v1/screenings is called', async ({ api }) => {
    requirement('REQ-API-03');
    const res = await api.call('GET', '/v1/screenings', { schema: ScreeningListSchema, params: { limit: 5 } });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ limit: 5, offset: 0 });
    expect(res.body.items.length).toBeLessThanOrEqual(Math.min(5, res.body.total));
  });

  test('should accept an upper-case iso3 filter when iso3=DEU', async ({ api }) => {
    requirement('REQ-API-03');
    const res = await api.call('GET', '/v1/screenings', { schema: ScreeningListSchema, params: { iso3: 'DEU', limit: 5 } });

    expect(res.status).toBe(200);
  });

  for (const [param, value] of [
    ['iso3', 'deu'],
    ['subject_type', 'bogus'],
  ] as const) {
    test(`should return a 422 naming ${param} when ${param}=${value}`, async ({ api }) => {
      requirement('REQ-API-03');
      const res = await api.call('GET', '/v1/screenings', { params: { [param]: value } });

      expect(res.status).toBe(422);
      expect(ValidationErrorEnvelope.parse(res.body).detail[0]?.loc).toEqual(['query', param]);
    });
  }

  test('should return a 422 naming the path parameter when the screening id is not an integer', async ({ api }) => {
    requirement('REQ-API-03');
    const res = await api.call('GET', '/v1/screenings/abc');

    expect(res.status).toBe(422);
    expect(ValidationErrorEnvelope.parse(res.body).detail[0]).toMatchObject({ loc: ['path', 'screening_id'], type: 'int_parsing' });
  });

  test('should return the canonical 404 envelope when the screening id is unknown', async ({ api }) => {
    requirement('REQ-API-03');
    const res = await api.call('GET', '/v1/screenings/999999999');

    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  test('should return 401 when screenings are listed without a key', async ({ api }) => {
    requirement('REQ-API-03');
    api.setToken(undefined);
    const res = await api.call('GET', '/v1/screenings', { params: { limit: 1 } });

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHENTICATED);
  });
});
