# Product bugs (SpiraTest)

> Owner: Bug Reporter. System of record: SpiraTest (D10). Filed with `npm run spira -- --submit <id>` after Kayla's approval.

| Spira ID | Title | Severity | Found by | Jam | Linked test | Status |
|---|---|---|---|---|---|---|
| SPIRA-PENDING | MCP: tool call without credential answers HTTP 401, docs say HTTP 200 for -32001 | low | exploratory (API lane) | n/a (API only) | tests/api/mcp.entity.spec.ts | draft |

## Drafts

<!-- Copy this block per bug (or run `npm run spira -- --template`). The draft id (DRAFT-01...) is what spira-file.ts takes: `npm run spira -- --from-bugs docs/BUGS.md --id DRAFT-01 [--submit]`. -->

### DRAFT-01: <Component>: <symptom>
- Environment: <URL>, Chromium <version>, <date>, commit <sha>
- Preconditions: <state needed>
- Steps:
  1. <step>
  2. <step>
- Expected: <expected result>
- Actual: <actual result>
- Severity: high
- Priority: P2
- Jam: https://jam.dev/c/<id>
- Screenshot: test-results/<test-dir>/test-failed-1.png
- Report: https://<user>.github.io/<repo>/runs/<run_id>/#?testId=<id>
- Linked test: tests/e2e/<feature>/<file>.spec.ts
- Spira: pending

### DRAFT-02: MCP: tool call without credential answers HTTP 401, docs say HTTP 200 for -32001
- Environment: https://mcp.stonewake.ai/ (JSON-RPC over HTTP, curl), 2026-11-04 17:39 UTC, commit 7edc10b
- Preconditions: none (no API key is sent)
- Steps:
  1. POST https://mcp.stonewake.ai/ with headers Content-Type: application/json and Accept: application/json, text/event-stream, and no Authorization header
  2. Body: {"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"company_profile","arguments":{"node_id":"x"}}}
  3. Repeat with header MCP-Protocol-Version: 2025-06-18 (an earlier revision)
  4. Read the HTTP status and the JSON-RPC error
- Expected: HTTP 200 carrying JSON-RPC error -32001. Docs https://docs.stonewake.ai/mcp (Errors) say "A tool call whose key is missing or refused answers a JSON-RPC error with the stable code `-32001`" and "Under the revision `2026-07-28` the codes `-32700`, `-32600`, `-32602`, `-32020` and `-32022` come back with HTTP 400 and `-32601` with HTTP 404. Under the earlier revisions only `-32700` and `-32600` come back with HTTP 400. Every other JSON-RPC error comes back with HTTP 200, the status at which the clients of the earlier revisions read it and keep their session."
- Actual: HTTP 401 with {"jsonrpc":"2.0","id":1,"error":{"code":-32001,"message":"No credential was sent. Supply your Stonewake API key as the Bearer token on every MCP request ..."}} for both requests (with and without MCP-Protocol-Version). The call is still refused, so this is a contract/docs mismatch on the HTTP status only; a client of an earlier revision that reads errors at HTTP 200 may treat the 401 as a transport failure.
- Severity: low
- Priority: P3
- Linked test: tests/api/mcp.entity.spec.ts
- Spira: pending

## Reviewed, not filed

- `GET /v1/deals?team=abc` answers 403 `forbidden` (reported as "malformed team should give 422"). Not a bug: the docs (https://docs.stonewake.ai/v1, `GET /v1/deals`) say "An empty or malformed `team` answers 422 naming it, and a well formed team outside your access answers 403, the same for one that does not exist", and the OpenAPI schema (https://api.stonewake.ai/openapi.json, `team`) defines well formed as `^[A-Za-z0-9_-]+$`, 1-16 characters. `abc` is well formed, so 403 is the documented answer. Checked 2026-11-04 17:39 UTC: `team=` -> 422 `string_too_short`, `team=a!b` -> 422 `string_pattern_mismatch`, 17 characters -> 422 `string_too_long`. Related test: tests/api/deals.filters.spec.ts.
