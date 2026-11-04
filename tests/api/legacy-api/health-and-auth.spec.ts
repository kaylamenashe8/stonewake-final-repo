import { test, expect } from '../../../src/fixtures';
import { FAKE_LIVE_KEY, UNAUTHENTICATED, apiKey } from './test-data-and-api-key';
import { ErrorEnvelopeSchema, HealthSchema, MeSchema } from './response-schemas';

// Migrated from tests/api.spec.ts (api 1-4). Read-only calls; api 2 uses our viewer key.

/** Routes that must refuse a request without a credential (one per resource family). */
const PROTECTED_GET_PATHS = ['/v1/me', '/v1/portfolio', '/v1/countries', '/v1/entities'];

test.describe('Legacy API: health and auth @api @regression', () => {
  test('api 1 health: should report the app status when /health is requested', async ({ api }) => {
    const res = await test.step('GET /health', () => api.call('GET', '/health', { schema: HealthSchema }));

    await test.step('assert status, app and version fields', () => {
      expect(res.status).toBe(200);
      expect(Object.keys(res.body).sort()).toEqual(['app', 'environment', 'status', 'version']);
      expect(res.body.status).toBe('ok');
      expect(res.body.app).toBe('stonewake');
      expect(typeof res.body.version).toBe('string');
      expect(typeof res.body.environment).toBe('string');
    });
  });

  test('api 2 me: should describe the key when called with a Bearer API key', async ({ api }) => {
    api.setToken(apiKey());

    const res = await test.step('GET /v1/me with the Bearer key', () =>
      api.call('GET', '/v1/me', { schema: MeSchema }));

    await test.step('assert the credential, role, team scope and rate-limit headers', () => {
      expect(res.status).toBe(200);
      expect(res.body.credential).toBe('api_key');
      expect(res.body.role).toMatch(/^[a-z_]+$/);
      // Team scope shape (string id/name, at least one team unless all_teams) is enforced by TeamScopeSchema.
      expect(res.headers['x-ratelimit-limit']).toMatch(/^\d+$/);
      expect(res.headers['x-ratelimit-remaining']).toMatch(/^\d+$/);
    });
  });

  test('api 3 no token: should answer 401 unauthenticated when no credential is sent', async ({ api }) => {
    await test.step('GET each protected route without a credential', async () => {
      for (const path of PROTECTED_GET_PATHS) {
        const res = await api.call('GET', path);
        expect(res.status, path).toBe(401);
        expect(ErrorEnvelopeSchema.parse(res.body), path).toEqual(UNAUTHENTICATED);
      }
    });

    await test.step('POST /v1/citations/resolve without a credential', async () => {
      const post = await api.call('POST', '/v1/citations/resolve');
      expect(post.status).toBe(401);
      expect(ErrorEnvelopeSchema.parse(post.body)).toEqual(UNAUTHENTICATED);
    });
  });

  test('api 4 bad keys: should answer 401 unauthenticated when the credential is invalid', async ({
    api,
  }) => {
    const badAuthorizations = [`Bearer ${FAKE_LIVE_KEY}`, 'Bearer not-a-key', 'Basic abc'];

    await test.step('GET /v1/me with each invalid Authorization header', async () => {
      for (const authorization of badAuthorizations) {
        const res = await api.call('GET', '/v1/me', { headers: { Authorization: authorization } });
        expect(res.status, authorization).toBe(401);
        expect(ErrorEnvelopeSchema.parse(res.body), authorization).toEqual(UNAUTHENTICATED);
      }
    });

    await test.step('GET /v1/portfolio with the fake live key', async () => {
      const portfolio = await api.call('GET', '/v1/portfolio', {
        headers: { Authorization: `Bearer ${FAKE_LIVE_KEY}` },
      });
      expect(portfolio.status).toBe(401);
      ErrorEnvelopeSchema.parse(portfolio.body);
    });
  });
});
