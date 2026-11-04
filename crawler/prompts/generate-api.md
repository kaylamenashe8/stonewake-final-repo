# API generator prompt (captured XHR → API spec)

Use with Claude Code. Owner: the API agent (`src/api`, `tests/api`). Candidates land in `tests/generated/api/`.

---

Generate **one** API spec for endpoint `<METHOD> <pattern>` from the captured calls in
`crawler/out/site-map.json` (`pages[].xhr[]` and `endpoints[]`) and `docs/API_MAP.md` (official docs win).

Must:
- File `tests/generated/api/<resource>.<action>.api.spec.ts`; `import { test, expect } from '../../../src/fixtures';`.
- Use the `api` fixture (`ApiClient` from `src/api/client.ts`): `await api.call('GET', '/path', { schema })`.
  Token from the login endpoint or auth setup via `api.setToken(...)`; never hard-code secrets.
- One zod schema per response in `src/api/schemas/<resource>.ts` (or `tests/generated/api/schemas/` until
  promotion), **inferred from the real captured response bodies**: required vs optional from what was always
  present, `z.string()`, `z.number()`, `z.iso.datetime()`, enums only when the captured values are a closed set.
  Prefer `ajv` against an OpenAPI spec when one exists.
- Cover, as separate tests: happy path (status + schema + key values); 401 without token; 403 with wrong role
  (if roles exist); 400 on missing field / wrong type / boundary; 404 on unknown id with a clear error body.
- CRUD: create with RUN_ID data (`data` fixture), read, update, delete, and always clean up in teardown.
- Response time is logged by the client (annotation), never asserted.
- No conditionals in tests; titles `should <behaviour> when <condition>`; describe title tagged `@api`.

Then: lint + typecheck, 2-3 self-reviews, `npm run promote -- <file>`, PR with `Closes #<plan issue>` only on Keep.

Captured calls:
<paste the endpoint's xhr records: method, url, status, requestBody, responseBody>
