import { test, expect } from '../../../src/fixtures';
import { NOT_FOUND, UNAUTHENTICATED, apiKey } from './test-data-and-api-key';
import {
  EntityListSchema,
  EntitySchema,
  ErrorEnvelopeSchema,
  ValidationErrorSchema,
} from './response-schemas';

// Migrated from tests/api.spec.ts (api 7-8). Read-only calls with our viewer key.

/** Ids that are valid integers but never issued. */
const UNKNOWN_ENTITY_ID = 999_999;
const UNKNOWN_NODE_ID = 999_999_999;

test.describe('Legacy API: entities @api @regression', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('api 7 entities: should return the same entity when it is fetched by id from the list', async ({
    api,
  }) => {
    const pageSize = 2;

    const first = await test.step(`GET /v1/entities?limit=${pageSize} returns valid entities`, async () => {
      const res = await api.call('GET', '/v1/entities', {
        schema: EntityListSchema,
        params: { limit: pageSize },
      });
      expect(res.status).toBe(200);
      // Entity shape (numeric id, slug, display_name, kind) is enforced by EntitySchema. Entities come from the
      // register graph (reference data no lane deletes), so "at least one" is stable.
      expect(res.body.items.length).toBeGreaterThanOrEqual(1);
      expect(res.body.limit).toBe(pageSize);
      expect(res.body.total).toBeGreaterThan(0);
      return EntitySchema.parse(res.body.items[0]);
    });

    await test.step('GET /v1/entities/{id} returns the same entity', async () => {
      const detail = await api.call('GET', `/v1/entities/${first.id}`, { schema: EntitySchema });
      expect(detail.status).toBe(200);
      expect(detail.body).toEqual(first);
    });
  });

  test('api 8 entity not found: should answer 404 or 422 when the id is unknown or malformed', async ({
    api,
  }) => {
    await test.step('unknown entity id answers 404 not_found', async () => {
      const missing = await api.call('GET', `/v1/entities/${UNKNOWN_ENTITY_ID}`);
      expect(missing.status).toBe(404);
      expect(ErrorEnvelopeSchema.parse(missing.body)).toEqual(NOT_FOUND);
    });

    await test.step('non-integer entity id answers 422 int_parsing on the path', async () => {
      const malformed = await api.call('GET', '/v1/entities/abc');
      expect(malformed.status).toBe(422);
      const err = ValidationErrorSchema.parse(malformed.body);
      expect(err.error.code).toBe('validation_failed');
      expect(err.detail[0]?.type).toBe('int_parsing');
      expect(err.detail[0]?.loc).toEqual(['path', 'entity_id']);
    });

    await test.step('unknown node id answers 404', async () => {
      const node = await api.call('GET', `/v1/nodes/${UNKNOWN_NODE_ID}`);
      expect(node.status).toBe(404);
      ErrorEnvelopeSchema.parse(node.body);
    });

    await test.step('the 404 route still answers 401 without a credential', async () => {
      api.setToken(undefined);
      const anonymous = await api.call('GET', `/v1/entities/${UNKNOWN_ENTITY_ID}`);
      expect(anonymous.status).toBe(401);
      expect(ErrorEnvelopeSchema.parse(anonymous.body)).toEqual(UNAUTHENTICATED);
    });
  });
});
