import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { UNKNOWN_API_KEY_ID, UNKNOWN_DEAL_ID } from '../../src/api/ids';
import { ErrorEnvelope, METHOD_NOT_ALLOWED, OrgErrorEnvelope } from '../../src/api/schemas';

// T19 (#13), REQ-API-04. The viewer key is read-only. Safety: writes target only ids that do not exist and
// RUN_ID-prefixed bodies, never a real record. /v1 has no write route (openapi.json), so the API refuses the
// verb itself: 405 method_not_allowed with Allow: GET (the plan expected 403; see docs/API_MAP.md).
const writes = [
  { method: 'DELETE', path: `/v1/deals/${UNKNOWN_DEAL_ID}` },
  { method: 'PATCH', path: `/v1/deals/${UNKNOWN_DEAL_ID}` },
  { method: 'PUT', path: `/v1/deals/${UNKNOWN_DEAL_ID}` },
  { method: 'POST', path: '/v1/deals' },
] as const;

test.describe('API read-only key @api @regression', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  for (const { method, path } of writes) {
    test(`should refuse ${method} with 405 and no data when the viewer key writes to ${path}`, async ({
      api,
      data,
    }) => {
      requirement('REQ-API-04');
      const res = await api.call(method, path, { data: { name: data.uid('t19') } });

      expect(res.status).toBe(405);
      expect(ErrorEnvelope.parse(res.body)).toEqual(METHOD_NOT_ALLOWED); // envelope only: no record data
      expect(res.headers.allow).toBe('GET');
    });
  }

  test('should refuse a key revoke with 401 when the viewer key calls a dashboard-session route', async ({
    api,
  }) => {
    requirement('REQ-API-04');
    const res = await api.call('POST', `/org/api-keys/${UNKNOWN_API_KEY_ID}/revoke`);

    expect(res.status).toBe(401);
    expect(OrgErrorEnvelope.parse(res.body).error.code).toBe('unauthenticated');
  });
});
