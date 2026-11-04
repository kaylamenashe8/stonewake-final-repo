# Changelog

> Every agent appends one line per change: `- [agent] <what> — cause: <cause> — fix: <fix> (<files>)`.
> Shared-file change requests: `- [agent] REQUEST <file>: <change> — why: <reason>` (the Lead applies them).

## Unreleased
- [recon] Baseline measured on untouched b4f92c9 (20 tests: 10 pass 5/5, 10 fail 0/5, 0 flaky) and ranked plan (27 items) — cause: Phase 1 recon — fix: n/a, report only (docs/BASELINE.md, docs/TEST_PLAN.json)
- [stabilizer-ui] Moved the 10 ui.spec.ts tests to tests/e2e/auth (ui 1-5) and tests/e2e/modules (ui 6-10) on page objects + storageState; fixed ui 1, 3 (C2), 7, 10 (C4), 6 (C5) — cause: brittle selector, outdated route, wrong testid, hardcoded module list, hard waits, hardcoded Judge 2 credentials — fix: role/label ElementSpecs, data picked from the page, env credentials (src/pages/*, src/components/Sidebar.ts, tests/e2e/auth/*, tests/e2e/modules/*; F11-F20)
- [stabilizer-ui] REQUEST src/fixtures/index.ts: add dealBook/portfolio/countries/institutions page-object fixtures — why: specs construct them with `new` today
