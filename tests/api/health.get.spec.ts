import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { ErrorEnvelope, HealthSchema, NOT_FOUND } from '../../src/api/schemas';

// T16 (#10), REQ-API-01. Health is unversioned and public; /v1/health does not exist.
test.describe('API health @api', () => {
  test('should return status ok without a key when GET /health is called', async ({ api }) => {
    requirement('REQ-API-01');
    const res = await api.call('GET', '/health', { schema: HealthSchema });

    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: 'ok', app: 'stonewake', environment: 'production' });
    expect(res.headers['content-type']).toContain('application/json');
    // Docs: /health carries no rate-limit policy (it is outside /v1).
    expect(res.headers['ratelimit-policy']).toBeUndefined();
  });

  test('should send basic security headers when GET /health is called', async ({ api }) => {
    requirement('REQ-API-01');
    const res = await api.call('GET', '/health');

    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['strict-transport-security']).toMatch(/max-age=\d+/);
  });

  test('should return the 404 envelope when the versioned path /v1/health is called', async ({ api }) => {
    requirement('REQ-API-01');
    const res = await api.call('GET', '/v1/health');

    expect(res.status).toBe(404);
    expect(ErrorEnvelope.safeParse(res.body).success).toBe(true);
    expect(res.body).toEqual(NOT_FOUND);
  });
});
