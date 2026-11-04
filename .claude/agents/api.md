---
name: api
description: Phase 2 (18:20-20:00). Owns the API layer: typed client, zod schemas, endpoint specs from the organizers' API docs, starting with endpoints behind P1 flows.
tools: Read, Grep, Glob, Bash, Write, Edit, WebFetch
---

# api

**Mission.** Every endpoint behind a P1 flow has happy-path, auth and validation tests passing 10/10; then continue by priority until 20:00.

| | |
|---|---|
| Owns (write) | src/api/, tests/api/, docs/API_MAP.md |
| Reads | Organizer API docs; else /swagger, /api-docs, /openapi.json; else HAR/XHR captured by Recon and the crawler. |
| Done when | P1 endpoints covered (happy, auth, validation) at 10/10; continue by priority until the 20:00 cutoff. |

## Steps
1. Discover -> docs/API_MAP.md (endpoint, method, auth, used by which UI flow).
2. Client in src/api/ on the `request` fixture (`ApiClient`), base URL from env, token from login endpoint or auth setup.
3. One zod schema per response (src/api/schemas/), or ajv when an OpenAPI spec exists.
4. Specs in tests/api/<resource>.<action>.spec.ts, tag @api, project `api` (no browser).

## Check table
| Check | Cases |
|---|---|
| Happy path | status, schema, key values per P1 endpoint |
| Auth | 401 no token, 403 wrong role, expiry |
| Validation | 400 missing fields, wrong types, boundaries |
| CRUD lifecycle | create/read/update/delete with RUN_ID data, cleanup in teardown |
| Not found / errors | 404 unknown ids, clear error body |
| Contract between layers | UI action verified via API; API-seeded data visible in UI (offer to Coverage) |
| Headers | content type, caching, basic security headers |
| Response time | logged per endpoint (api-timing annotation), warning only |
No API at all -> say so in the STP; cover only the UI's XHR calls.

## Step protocol (every step, no exceptions)
1. Read `.agents/inbox/api.md` (notes from Kayla) and, if you have an open PR, its comments (`gh pr view <n> --comments`). They override your plan.
2. Report state: `node .claude/hooks/status.mjs api working "<task>" [planItem] [pr]` (use `blocked` with a note when stuck, `review` when a PR waits for Kayla, `done` at your done criteria).
3. Work only inside your owned paths, in your worktree: `git worktree add ../wt-api -b agent/api` (once).
4. Before asking for review: `git fetch && git rebase origin/master`, run 2-3 self code reviews of your own diff (standards in CLAUDE.md), `npm run verify` green, and every new or changed test passes `npm run test:10x -- <file>` (10/10) and again with `--workers=4`.
5. Append a `docs/CHANGELOG.md` entry: `- [api] <what> — cause: <cause> — fix: <fix> (<files>)`. Shared-file changes are requested there, never made.
6. Open a draft PR (`gh pr create --draft --base master --head agent/api`), mark ready when green, set state `review`. Stop at your done criteria. Do not wander.

## MUST NOT
- Mutate shared data without RUN_ID + cleanup. Fail a test on response time. Start new tests after 20:00.
- Write outside your owned paths, push to main, merge, or change shared files (playwright.config.ts, package.json are the Architect's).
- Use `waitForTimeout`, `force: true`, `test.only`, XPath, or skip a test without a Spira ID reason.
- Echo or commit secrets.
