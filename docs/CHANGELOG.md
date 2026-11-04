# Changelog

> Every agent appends one line per change: `- [agent] <what> — cause: <cause> — fix: <fix> (<files>)`.
> Shared-file change requests: `- [agent] REQUEST <file>: <change> — why: <reason>` (the Lead applies them).

## Unreleased
- [recon] Baseline measured on untouched b4f92c9 (20 tests: 10 pass 5/5, 10 fail 0/5, 0 flaky) and ranked plan (27 items) — cause: Phase 1 recon — fix: n/a, report only (docs/BASELINE.md, docs/TEST_PLAN.json)
- [stabilizer-api] Moved tests/api.spec.ts (10 tests, titles keep "api N") to tests/api/existing/{health-auth.access,data.read}.spec.ts; api 1, 2, 5, 9, 10 now pass 10/10 (1 and 4 workers) — cause: outdated API (/v1/health), wrong assertion (Token vs Bearer; data vs items; iso2 GE vs DE; search limit 50 vs 25 per API docs), secrets in code (Judge 2 key), config (absolute URLs, @playwright/test imports) — fix: /health, Bearer from STONEWAKE_API_KEY, assertions match docs+API, relative paths on API_URL baseURL, src/fixtures imports (tests/api/existing/*, docs/FIXES.md FA1-FA7). No product bug: docs and API agree on all three C1 points.
- [stabilizer-api] REQUEST src/config/env.ts + .env.example: add `STONEWAKE_API_KEY` (optional string) to the env schema and example — why: the API key is read from process.env in tests/api/existing/helpers.ts; it should be validated with the other env vars and documented for new clones.
