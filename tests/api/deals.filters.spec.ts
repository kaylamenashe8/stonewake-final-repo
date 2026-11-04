import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { DealListSchema, ErrorEnvelope, ValidationErrorEnvelope } from '../../src/api/schemas';

// T20 (#20), REQ-API-05. A bad filter must give a 422 naming the param, never an empty book.
const invalidFilters: readonly { param: string; value: string; type: string }[] = [
  { param: 'country_code', value: 'DE', type: 'literal_error' }, // two-letter
  { param: 'country_code', value: 'deu', type: 'literal_error' }, // lower case
  { param: 'min_value_usd', value: 'inf', type: 'finite_number' },
  { param: 'min_value_usd', value: '1e400', type: 'finite_number' },
  { param: 'stage', value: 'bogus', type: 'literal_error' },
  { param: 'team', value: '', type: 'string_too_short' },
  { param: 'q', value: 'a'.repeat(129), type: 'string_too_long' }, // boundary: max 128
  { param: 'offset', value: '-1', type: 'greater_than_equal' },
];

test.describe('API deals filters @api', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  for (const { param, value, type } of invalidFilters) {
    test(`should refuse ${param}=${value.slice(0, 12)}${value.length > 12 ? '…' : ''} with a 422 naming ${param} when the filter is invalid`, async ({ api }) => {
      requirement('REQ-API-05');
      const res = await api.call('GET', '/v1/deals', { params: { [param]: value } });

      expect(res.status).toBe(422);
      const body = ValidationErrorEnvelope.parse(res.body);
      expect(body.detail[0]?.loc.slice(0, 2)).toEqual(['query', param]);
      expect(body.detail[0]?.type).toBe(type);
    });
  }

  test('should return 200 when q is 128 chars and country_code is XKX', async ({ api }) => {
    requirement('REQ-API-05');
    const longQ = await api.call('GET', '/v1/deals', { schema: DealListSchema, params: { q: 'a'.repeat(128), limit: 1 } });
    const kosovo = await api.call('GET', '/v1/deals', { schema: DealListSchema, params: { country_code: 'XKX', limit: 1 } });

    expect(longQ.status).toBe(200);
    expect(kosovo.status).toBe(200);
  });

  test('should return 403 forbidden when a well-formed team outside the key scope is requested', async ({ api }) => {
    requirement('REQ-API-05');
    const res = await api.call('GET', '/v1/deals', { params: { team: '000000000000', limit: 1 } });

    expect(res.status).toBe(403);
    expect(ErrorEnvelope.parse(res.body).error.code).toBe('forbidden');
  });
});
