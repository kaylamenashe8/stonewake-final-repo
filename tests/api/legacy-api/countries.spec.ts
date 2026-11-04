import { test, expect } from '../../../src/fixtures';
import { apiKey } from './test-data-and-api-key';
import { CountryListSchema, CountrySchema, ErrorEnvelopeSchema } from './response-schemas';

// Migrated from tests/api.spec.ts (api 9). Read-only calls with our viewer key.

/** The country reference list covers every ISO country; 100 is a floor well below that, not a live count. */
const MIN_COUNTRIES = 100;

test.describe('Legacy API: countries @api @regression', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('api 9 countries: should return Germany with iso2 DE when DEU is requested', async ({ api }) => {
    await test.step('GET /v1/countries lists the reference countries', async () => {
      const res = await api.call('GET', '/v1/countries', { schema: CountryListSchema });
      expect(res.status).toBe(200);
      // iso3 format and string names for every country are enforced by CountrySchema.
      expect(res.body.countries.length).toBeGreaterThanOrEqual(MIN_COUNTRIES);
      expect(res.body.countries.find((c) => c.iso3 === 'DEU')?.name).toBe('Germany');
    });

    await test.step('GET /v1/countries/DEU returns Germany with iso2 DE', async () => {
      const de = await api.call('GET', '/v1/countries/DEU', { schema: CountrySchema });
      expect(de.status).toBe(200);
      expect(de.body.iso3).toBe('DEU');
      // ISO 3166-1 alpha-2 for Germany is DE (the legacy test expected "GE", which is Georgia).
      expect(de.body.iso2).toBe('DE');
      expect(de.body.name).toBe('Germany');
      expect(de.body.region).toBe('europe');
      // Country risk is scored on a 0-100 scale; the value itself is live, so only the range is asserted.
      expect(de.body.risk?.score).toBeGreaterThanOrEqual(0);
      expect(de.body.risk?.score).toBeLessThanOrEqual(100);
    });

    await test.step('GET /v1/countries/ZZZ answers 404', async () => {
      const unknown = await api.call('GET', '/v1/countries/ZZZ');
      expect(unknown.status).toBe(404);
      ErrorEnvelopeSchema.parse(unknown.body);
    });
  });
});
