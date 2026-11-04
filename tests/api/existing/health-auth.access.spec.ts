import { test, expect } from '../../../src/fixtures';
import { UNAUTHENTICATED, authHeaders, expectValidTeamScope, json, type TeamScope } from './helpers';

// Migrated from tests/api.spec.ts (api 1-4). Read-only calls with our viewer key.
test.describe('Legacy API: health and auth @api @regression', () => {
  test('api 1 health: should report the app status when /health is requested', async ({ request }) => {
    const res = await request.get('/health');
    expect(res.status()).toBe(200);
    const body = await json<Record<string, unknown>>(res);
    expect(Object.keys(body).sort()).toEqual(['app', 'environment', 'status', 'version']);
    expect(body.status).toBe('ok');
    expect(body.app).toBe('stonewake');
    expect(typeof body.version).toBe('string');
    expect(typeof body.environment).toBe('string');
  });

  test('api 2 me: should describe the key when called with a Bearer API key', async ({ request }) => {
    const res = await request.get('/v1/me', { headers: authHeaders() });
    expect(res.status()).toBe(200);
    const body = await json<{ credential: string; role: unknown; team_scope: TeamScope }>(res);
    expect(body.credential).toBe('api_key');
    expect(body.role).toEqual(expect.stringMatching(/^[a-z_]+$/));
    expectValidTeamScope(body.team_scope);
    expect(res.headers()['x-ratelimit-limit']).toMatch(/^\d+$/);
    expect(res.headers()['x-ratelimit-remaining']).toMatch(/^\d+$/);
  });

  test('api 3 no token: should answer 401 unauthenticated when no credential is sent', async ({ request }) => {
    for (const path of ['/v1/me', '/v1/portfolio', '/v1/countries', '/v1/entities']) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(401);
      expect(await res.json(), path).toEqual(UNAUTHENTICATED);
    }
    const post = await request.post('/v1/citations/resolve');
    expect(post.status()).toBe(401);
    expect(await post.json()).toEqual(UNAUTHENTICATED);
  });

  test('api 4 bad keys: should answer 401 unauthenticated when the credential is invalid', async ({ request }) => {
    for (const authorization of ['Bearer swk_live_invalid000000000000000000000000', 'Bearer not-a-key', 'Basic abc']) {
      const res = await request.get('/v1/me', { headers: { Authorization: authorization } });
      expect(res.status(), authorization).toBe(401);
      expect(await res.json(), authorization).toEqual(UNAUTHENTICATED);
    }
    const portfolio = await request.get('/v1/portfolio', {
      headers: { Authorization: 'Bearer swk_live_invalid000000000000000000000000' },
    });
    expect(portfolio.status()).toBe(401);
  });
});
