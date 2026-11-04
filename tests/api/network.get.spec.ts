import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { heldCompanyNodeId } from '../../src/api/live-picks';
import { UNKNOWN_NODE_ID } from '../../src/api/ids';
import { currentBeforeClosedViolations, danglingEdges } from '../../src/api/ordering';
import { NetworkSchema, NOT_FOUND, UNAUTHENTICATED, ValidationErrorEnvelope } from '../../src/api/schemas';

// T18 (#12), REQ-API-03. Network read on a company the team holds (picked from the live book).
const NEIGHBOUR_LIMIT = 50; // `limit` caps neighbour nodes (max 200); 50 keeps the payload small

test.describe('API company network @api', () => {
  test.beforeEach(({ api }) => {
    api.setToken(apiKey());
  });

  test('should return a cited, self-consistent graph when GET /v1/nodes/{id}/network is called', async ({
    api,
  }) => {
    requirement('REQ-API-03');
    const nodeId = await heldCompanyNodeId(api);
    const res = await api.call('GET', `/v1/nodes/${nodeId}/network`, {
      schema: NetworkSchema,
      params: { limit: NEIGHBOUR_LIMIT },
    });

    expect(res.status).toBe(200);
    expect(res.body.center_id).toBe(nodeId);
    expect(res.body.nodes.map((n) => n.node_id)).toContain(nodeId);
    // `limit` caps the neighbour nodes (observed: limit=20 -> 21 nodes incl. the centre, 22 edges).
    expect(res.body.nodes.filter((n) => n.node_id !== nodeId).length).toBeLessThanOrEqual(NEIGHBOUR_LIMIT);
    // Every edge points at served nodes and carries its source (schema requires citation.source_url).
    expect(danglingEdges(res.body.nodes, res.body.edges)).toEqual([]);
    expect(currentBeforeClosedViolations(res.body.edges.map((e) => e.current))).toEqual([]);
  });

  test('should keep only the requested relationship type when edge_types=officer_of', async ({ api }) => {
    requirement('REQ-API-03');
    const nodeId = await heldCompanyNodeId(api);
    const res = await api.call('GET', `/v1/nodes/${nodeId}/network`, {
      schema: NetworkSchema,
      params: { edge_types: 'officer_of', limit: NEIGHBOUR_LIMIT },
    });

    expect(res.status).toBe(200);
    expect(res.body.edges.filter((e) => e.edge_type !== 'officer_of')).toEqual([]);
  });

  for (const [param, value, type] of [
    ['edge_types', 'bogus', 'literal_error'],
    ['limit', '201', 'less_than_equal'],
  ] as const) {
    test(`should return a 422 naming ${param} when ${param}=${value}`, async ({ api }) => {
      requirement('REQ-API-03');
      const nodeId = await heldCompanyNodeId(api);
      const res = await api.call('GET', `/v1/nodes/${nodeId}/network`, { params: { [param]: value } });

      expect(res.status).toBe(422);
      expect(ValidationErrorEnvelope.parse(res.body).detail[0]).toMatchObject({
        loc: ['query', param],
        type,
      });
    });
  }

  test('should return the canonical 404 envelope when the node id is unknown', async ({ api }) => {
    requirement('REQ-API-03');
    const res = await api.call('GET', `/v1/nodes/${UNKNOWN_NODE_ID}/network`);

    expect(res.status).toBe(404);
    expect(res.body).toEqual(NOT_FOUND);
  });

  test('should return 401 when the network is read without a key', async ({ api }) => {
    requirement('REQ-API-03');
    api.setToken(undefined);
    const res = await api.call('GET', `/v1/nodes/${UNKNOWN_NODE_ID}/network`);

    expect(res.status).toBe(401);
    expect(res.body).toEqual(UNAUTHENTICATED);
  });
});
