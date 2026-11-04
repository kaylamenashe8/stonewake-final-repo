import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';

// T20 (#20), REQ-API-05. Headers only: one request per test, the limit itself is never probed (ToS 4(g)).
test.describe('API rate-limit headers @api', () => {
  test('should send RateLimit and x-ratelimit headers on a keyed /v1 response', async ({ api }) => {
    requirement('REQ-API-05');
    api.setToken(apiKey());
    const res = await api.call('GET', '/v1/me');

    expect(res.status).toBe(200);
    expect(res.headers['ratelimit-policy']).toContain('"key-minute"');
    expect(res.headers.ratelimit).toMatch(/"key-minute";r=\d+;t=\d+/);
    expect(res.headers['x-ratelimit-limit']).toMatch(/^\d+$/);
    expect(res.headers['x-ratelimit-remaining']).toMatch(/^\d+$/);
    expect(Number(res.headers['x-ratelimit-remaining'])).toBeLessThanOrEqual(Number(res.headers['x-ratelimit-limit']));
    expect(res.headers['x-ratelimit-reset']).toMatch(/^\d+$/);
  });

  test('should send a RateLimit-Policy on a /v1 response even without a key', async ({ api }) => {
    requirement('REQ-API-05');
    const res = await api.call('GET', '/v1/me');

    expect(res.status).toBe(401);
    expect(res.headers['ratelimit-policy']).toMatch(/"key-minute";q=\d+;w=60/);
    expect(res.headers['content-type']).toContain('application/json');
  });
});
