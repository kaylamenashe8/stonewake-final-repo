# Changelog

> Every agent appends one line per change: `- [agent] <what> — cause: <cause> — fix: <fix> (<files>)`.
> Shared-file change requests: `- [agent] REQUEST <file>: <change> — why: <reason>` (the Lead applies them).

## Unreleased
- [recon] Baseline measured on untouched b4f92c9 (20 tests: 10 pass 5/5, 10 fail 0/5, 0 flaky) and ranked plan (27 items) — cause: Phase 1 recon — fix: n/a, report only (docs/BASELINE.md, docs/TEST_PLAN.json)
- [api] ApiClient key helper + zod schemas (health, me, deals, error envelopes) and specs for T16 (#10) and T17 (#11), 15 tests, 10/10 at workers 1 and 4 — cause: no API coverage for /health and the Deal Book API — fix: env-driven Bearer key (`STONEWAKE_API_KEY`), schema per response, sort-order helper (src/api/auth.ts, src/api/ordering.ts, src/api/schemas/*, tests/api/health.get.spec.ts, tests/api/deals.list.spec.ts, tests/api/deals.detail.spec.ts, docs/API_MAP.md)
- [api] REQUEST playwright.config.ts: set `trace: 'off'` (or `retain-on-failure` without request headers) for the `api` project — why: API traces record the `Authorization: Bearer` header, so a failed run's trace artifact would leak the API key
- [api] REQUEST .env.example: add `STONEWAKE_API_KEY=` — why: API specs read the Finalist 4 key from it (contract var not listed yet)
