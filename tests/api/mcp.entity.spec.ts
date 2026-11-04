import { test, expect } from '../../src/fixtures';
import { knownBug, requirement } from '../../src/utils/annotations';
import { apiKey } from '../../src/api/auth';
import { firstInstitution } from '../../src/api/live-picks';
import { mcpRequest, mcpToolPayload } from '../../src/api/mcp';
import { InstitutionSchema, McpErrorSchema, McpToolListSchema } from '../../src/api/schemas';

// T21 (#21), REQ-API-06. MCP and REST share one data model: the same registry entity must read identically.
const MISSING_CREDENTIAL = -32001;
const ANY_ENTITY_ID = 1; // never read: the call is refused before the tool runs
const DOCUMENTED_KEYLESS_STATUS = 200; // docs.stonewake.ai/mcp Errors: -32001 is answered with HTTP 200

test.describe('MCP entity parity @api', () => {
  test('should return the same institution through MCP company_profile as through REST when both read one id', async ({
    api,
  }) => {
    requirement('REQ-API-06');
    api.setToken(apiKey());

    const rest = await test.step('read the first registry institution over REST', () =>
      firstInstitution(api));

    const res = await mcpRequest(api, 'tools/call', {
      name: 'company_profile',
      arguments: { entity_id: rest.id },
    });

    expect(res.status).toBe(200);
    const payload = mcpToolPayload(res.body);
    expect(payload.isError).toBe(false);
    expect(InstitutionSchema.parse(payload.data)).toEqual(rest);
  });

  test('should list company_profile among the tools when tools/list is called without a key', async ({
    api,
  }) => {
    requirement('REQ-API-06');
    const res = await mcpRequest(api, 'tools/list');

    expect(res.status).toBe(200);
    const names = McpToolListSchema.parse(res.body).result.tools.map((t) => t.name);
    expect(names).toEqual(expect.arrayContaining(['company_profile', 'search_stonewake_docs']));
  });

  test('should refuse a tool call with JSON-RPC error -32001 when no key is sent', async ({ api }) => {
    requirement('REQ-API-06');
    const res = await mcpRequest(api, 'tools/call', {
      name: 'company_profile',
      arguments: { entity_id: ANY_ENTITY_ID },
    });

    // HTTP status is not pinned: docs say 200 for -32001, live answers 401 (open question, docs/API_MAP.md).
    expect(McpErrorSchema.parse(res.body).error.code).toBe(MISSING_CREDENTIAL);
  });

  test(
    'should answer HTTP 200 with JSON-RPC -32001 when an MCP tool call sends no key',
    { tag: '@known-bug' },
    async ({ api }) => {
      knownBug(
        'SPIRA-89',
        'MCP: tool call without credential answers HTTP 401, docs say HTTP 200 for -32001',
        'https://itac.spiraservice.net/33/Incident/89.aspx',
      );
      requirement('REQ-API-06');
      const res = await mcpRequest(api, 'tools/call', {
        name: 'company_profile',
        arguments: { entity_id: ANY_ENTITY_ID },
      });

      expect(res.status).toBe(DOCUMENTED_KEYLESS_STATUS);
      expect(McpErrorSchema.parse(res.body).error.code).toBe(MISSING_CREDENTIAL);
    },
  );
});
