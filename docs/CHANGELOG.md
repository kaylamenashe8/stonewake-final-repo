# Changelog

> Every agent appends one line per change: `- [agent] <what> — cause: <cause> — fix: <fix> (<files>)`.
> Shared-file change requests: `- [agent] REQUEST <file>: <change> — why: <reason>` (the Lead applies them).

## Unreleased
- [recon] Baseline measured on untouched b4f92c9 (20 tests: 10 pass 5/5, 10 fail 0/5, 0 flaky) and ranked plan (27 items) — cause: Phase 1 recon — fix: n/a, report only (docs/BASELINE.md, docs/TEST_PLAN.json)
- [architect] Env + lint baseline for the migration — cause: PR #32 REQUEST (STONEWAKE_API_KEY read raw from process.env); .env.example still pointed at saucedemo and lacked CLAUDE_CODE_OAUTH_TOKEN; legacy flat specs make `npm run lint` red (api.spec.ts 148 errors/3 warnings, ui.spec.ts 29/51) — fix: STONEWAKE_API_KEY optional in the zod schema and .env.example (placeholder); BASE_URL/API_URL examples set to app/api.stonewake.ai; ESLint ignores only the two legacy paths (D16); config/reporters/setup project checked against CLAUDE.md contracts, no gap (src/config/env.ts, .env.example, eslint.config.mjs, docs/DECISIONS.md)
- [architect] REQUEST .github/workflows/*.yml (CI/Infra): pass `STONEWAKE_API_KEY: ${{ secrets.STONEWAKE_API_KEY }}` to the test jobs — why: tests/api/existing/ (PR #32) throws without it; workflows pass only BASE_URL/API_URL today
- [lead] Pre-PR review gate — cause: agents opened PRs without a real self-review or E2E run (self-review was an honour rule) — fix: docs/REVIEW_CHECKLIST.md (R1-R20, TS + Playwright + general), `npm run pre-pr` (lint, typecheck, changed specs 10/10 on 1 and 4 workers, @smoke, migrated suite on shared changes) stamps .agents/review/<branch>.json on HEAD, PreToolUse hook pr-gate.mjs blocks git push / gh pr create / gh pr ready without it (scripts/pre-pr.mjs, .claude/hooks/pr-gate.mjs, .claude/settings.json, package.json, CLAUDE.md, .claude/agents/*.md)
