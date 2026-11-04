# itac-kit — rules for every agent

Pre-built kit for the ITAC 2026 Finals (prepared before the competition, disclosed in README, D12).
Goal on the day: turn an unknown flaky Playwright/TS repo into a stable suite proven by a 5/5 green
Stability Gate (retries 0, zero heals), with every decision documented.

## Hard rules
- Read `docs/product/README.md` (and the files it lists) before testing.
- Work only in your owned paths (see `.claude/agents/<you>.md`). Shared files (`playwright.config.ts`,
  `package.json`, `tsconfig.json`, `eslint.config.mjs`) belong to the Architect: request changes in your
  `docs/CHANGELOG.md` entry; the Lead applies them.
- One worktree per agent: `git worktree add ../wt-<agent> -b agent/<agent>`. Never push to main. Lead merges.
- Merge order: Architect → Stabilizer → CI/Infra → Coverage → Visual/Bonus → Triage. Scribe, Bug Reporter any time.
- **Nothing is pushed to a PR until it is reviewed and passes E2E** (enforced by `.claude/hooks/pr-gate.mjs`).
  Before every push: rebase on master; review your own diff against `docs/REVIEW_CHECKLIST.md` (TS, Playwright and
  general best practice) in 2+ full passes as a strict senior reviewer, fix everything found, tick R1-R19 in
  `.agents/review/<branch>.md`; then `npm run pre-pr` (lint, typecheck, changed specs 10/10 on 1 and 4 workers,
  @smoke, migrated suite when shared code changed) must pass on HEAD. Paste its Self-review/E2E blocks into the PR.
- Existing tests are never removed. A product-bug failure is skipped with `knownBug('SPIRA-<id>', title, url)`.
  A new test that cannot reach 10/10 is not added.
- No test starts after 20:00. Code freeze 20:20.
- Write a CHANGELOG entry (cause + fix) and update `.agents/status/<agent>.json` at each step; stop at your
  done criteria. Read PR comments before resuming a PR.
- Secrets live only in `.env` and GitHub secrets. Never echo them, never commit them.

## Coding standards (lint enforces them)
- Locators: `getByRole`+name > `getByLabel` > `getByTestId` > `getByText`; CSS only scoped inside a component.
  No XPath, no `nth()` without a comment. Declare each element once as an `ElementSpec` (`src/pages/spec.ts`)
  so the healer has alternates.
- Waiting: web-first assertions, `waitForResponse` for network-bound actions, `expect.poll` for eventual state.
  `waitForTimeout`, `force: true`, `networkidle`, `page.$`, `waitForSelector` are banned.
- Page objects expose intent and return locators/state; assertions live in tests.
- Each test owns its state (fixture/API); data from `DataFactory` (RUN_ID prefixed); tests are independent
  and pass with `--fully-parallel` and in any order.
- Naming: name files and folders after what they cover, the feature or endpoint (`countries.spec.ts`,
  `dealbook-sector-filter.spec.ts`, `response-schemas.ts`). No generic names (`helpers`, `utils`, `data`, `existing`).
  Test titles: "should <behaviour> when <condition>".
- Tags: @smoke (<2 min total), @regression, @visual, @a11y, @api, @known-bug, @mobile.
- Import `test`/`expect` from `src/fixtures`, never straight from `@playwright/test`, in specs.

## Contracts between lanes (do not change without the Lead)
- Env vars: see `.env.example` (`BASE_URL`, `API_URL`, `TEST_USER`, `TEST_PASSWORD`, `TEST_ID_ATTRIBUTE`,
  `HEAL_MODE`=off|log|strict, `RUN_ID`, `ANTHROPIC_API_KEY`, `CLAUDE_CODE_OAUTH_TOKEN`, `SLACK_WEBHOOK_URL`,
  `SPIRA_URL`, `SPIRA_USER`, `SPIRA_API_KEY`, `SPIRA_PROJECT_ID`).
- Run outputs: `test-results/results.json` (Playwright JSON reporter), `test-results/heal-report.json`
  (`{count, heals:[{test,element,old,new,strategy}]}`), `blob-report/` in CI, `playwright-report/` html.
- Triage verdicts: `triage/out/verdicts.json` = `Verdict[]` from `triage/types.ts`.
- Agent status: `.agents/status/<agent>.json` = `{agent, state: "working"|"blocked"|"review"|"done"|"paused",
  task, planItem?, pr?, updatedAt (ISO), note?}`. Notes to an agent: `.agents/inbox/<agent>.md` (read before each step).
- Crawler: `crawler/out/site-map.json`, `site-map.md`, `signals.md`, `promotion-report.md`.

## Commands
`npm run verify` (lint + typecheck + @smoke) · `npm run test:10x -- <file>` · `npm run test:gate` ·
`npm run diagnose -- <test title or file>` · `npm run crawl` · `npm run spira -- --draft|--submit`
