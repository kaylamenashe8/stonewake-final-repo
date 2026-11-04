import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { heldCompanyNodeId } from '../../src/api/held-company';
import { NOT_FOUND, OwnershipChainSchema, ValidationErrorEnvelope } from '../../src/api/schemas';

// T18 (#12), REQ-API-03. Ownership chain of a held company; threshold (0,100], max_depth 1-8.
test.describe('API ownership chain @api', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('should return the chain rooted at the company with default params when no params are sent', async ({ api }) => {
    requirement('REQ-API-03');
    const nodeId = await heldCompanyNodeId(api);
    const res = await api.call('GET', `/v1/nodes/${nodeId}/ownership-chain`, { schema: OwnershipChainSchema });

    expect(res.status).toBe(200);
    expect(res.body.root_id).toBe(nodeId);
    expect(res.body.params).toMatchObject({ threshold: 25, max_depth: 8 });
    expect(res.body.nodes.map((n) => n.node_id)).toContain(nodeId);
    expect(res.body.paths.length).toBeGreaterThan(0);
  });

  test('should echo the requested threshold and depth when threshold=50&max_depth=1', async ({ api }) => {
    requirement('REQ-API-03');
    const nodeId = await heldCompanyNodeId(api);
    const res = await api.call('GET', `/v1/nodes/${nodeId}/ownership-chain`, { schema: OwnershipChainSchema, params: { threshold: 50, max_depth: 1 } });

    expect(res.status).toBe(200);
    expect(res.body.params).toMatchObject({ threshold: 50, max_depth: 1 });
  });

  for (const [param, value, type] of [
    ['threshold', '0', 'greater_than'],
    ['threshold', '100.5', 'less_than_equal'],
    ['max_depth', '9', 'less_than_equal'],
  ] as const) {
    test(`should refuse ${param}=${value} with a 422 naming ${param}`, async ({ api }) => {
      requirement('REQ-API-03');
      const nodeId = await heldCompanyNodeId(api);
      const res = await api.call('GET', `/v1/nodes/${nodeId}/ownership-chain`, { params: { [param]: value } });

      expect(res.status).toBe(422);
      expect(ValidationErrorEnvelope.parse(res.body).detail[0]).toMatchObject({ loc: ['query', param], type });
    });
  }

  test('should return the canonical 404 envelope when the node id is unknown', async ({ api }) => {
    requirement('REQ-API-03');
    const res = await api.call('GET', '/v1/nodes/999999999999/ownership-chain');

    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });
});
