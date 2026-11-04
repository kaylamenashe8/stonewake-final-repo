# Pre-PR review checklist (mandatory, every agent, every push to a PR)

Nothing reaches Kayla's review queue until the code is reviewed to this standard **and** passes E2E.
This is enforced: `.claude/hooks/pr-gate.mjs` blocks `git push`, `gh pr create` and `gh pr ready` unless
`npm run pre-pr` passed **on the exact commit being pushed**.

## How
1. Finish the change, commit it.
2. Review your own diff (`git diff origin/master...HEAD`) against every item below, **at least 2 full passes**,
   reading it as a strict senior reviewer would. Fix what you find, commit, review again. When there is nothing
   left to fix, write `.agents/review/<branch>.md` (branch with `/` replaced by `-`): one line per item,
   `- [x] R<n> <note>` (what you checked / why it is fine) or `- [x] R<n> n/a <why>`. Unticked = not done.
3. `npm run pre-pr` — lint, typecheck, E2E (see below), checklist complete. It writes
   `.agents/review/<branch>.json` stamped with HEAD. Any new commit after that needs a new run.
4. Push / open the PR. Paste the `## Self-review` and `## E2E` blocks pre-pr prints into the PR body.

E2E that pre-pr runs: every added/changed spec `--repeat-each=10 --retries=0` on 1 worker **and** on 4 workers;
`@smoke`; and, when shared code changed (`src/`, `playwright.config.ts`, `tests/*.setup.ts`, `package.json`),
every migrated spec once with `--retries=0` so a shared change cannot break another lane's tests.

## General
- R1 Diff is small and does one thing; only files in your owned paths (shared files go through a CHANGELOG REQUEST).
- R2 No dead code, commented-out code, debug output (`console.log`), `test.only`, stray TODOs.
- R3 Names say what things are; comments explain *why*, never restate the code. No magic numbers or strings.
- R4 Reuses what exists (BasePage, ElementSpec, fixtures, DataFactory, ApiClient) instead of a parallel helper.
- R5 No secrets, tokens, real emails or workspace ids in code, logs, attachments or the PR; data from `env`.
- R6 CHANGELOG entry with cause + fix; status file updated.

## TypeScript
- R7 Strict types: no `any`, no unchecked `as` casts, no non-null `!` (narrow instead); `unknown` + zod at boundaries.
- R8 Every promise is awaited or returned (no floating promises); no `async` without `await`.
- R9 Public page-object / client methods have explicit return types; fields `readonly` where they never change.
- R10 API responses are parsed with a zod schema before use; errors are not swallowed (no empty `catch`).
- R11 Imports: `test`/`expect` from `src/fixtures` in specs, never `@playwright/test`; no unused imports.

## Playwright
- R12 Locators: `getByRole`+name > `getByLabel` > `getByTestId` > `getByText`; CSS only scoped in a component; no XPath; `nth()` only with a comment; each element declared once as an `ElementSpec`.
- R13 Waiting: web-first assertions only; `waitForResponse` for network-bound actions; `expect.poll` for eventual state. No `waitForTimeout`, `force: true`, `networkidle`, `page.$`, `waitForSelector`, fixed sleeps.
- R14 Assertions live in tests, page objects return locators/state; each test asserts the behaviour in its title, not just that a page loaded; no conditionals in tests.
- R15 Isolation: the test creates and cleans up its own state (fixture/API, `DataFactory` RUN_ID names); no order dependency, no shared mutable state, passes with `--fully-parallel`; no `describe.serial` unless justified in a comment.
- R16 Test data does not assume live values that change (counts, scores, dates); dynamic content is matched by pattern or masked.
- R17 Naming `feature.action.spec.ts`; title "should <behaviour> when <condition>"; correct tags (@smoke/@regression/@api/…); `test.step` for multi-step flows.
- R18 Product-bug failures use `knownBug('SPIRA-<id>', …)`, never a silent `skip`/`fixme`; existing tests are never deleted.
- R19 Setup goes through the API or storage state where possible, not through the UI, unless the UI is what is tested.

## E2E (filled by `npm run pre-pr`)
- R20 pre-pr passed on HEAD (10/10 on 1 and 4 workers for every changed spec, smoke green, migrated suite green when shared code changed).
