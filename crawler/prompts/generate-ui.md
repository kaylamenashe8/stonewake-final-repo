# UI generator prompt (one flow → one candidate spec)

Use with the Playwright generator agent (it drives a real browser via Playwright MCP) or Claude Code.

---

Generate **one** test for plan item `<ID>: <title>` (flow notes below). One test at a time, never a batch.

Write to `tests/generated/<feature>.<action>.spec.ts`. New page objects go to `tests/generated/pages/`
until promotion; reuse existing ones in `src/pages/` and components in `src/components/` first.

Must:
- `import { test, expect } from '../../src/fixtures';` (never straight from `@playwright/test`).
- Locators in page objects only, declared as `ElementSpec`s with `element(name, primary, ...alternates)` from
  `src/pages/spec.ts`; order getByRole+name > getByLabel > getByTestId > getByText > scoped CSS. No XPath.
- Web-first assertions; `waitForResponse` for network-bound actions; `expect.poll` for eventual state.
  No `waitForTimeout`, `force: true`, `networkidle`, conditionals in the test.
- Own its state: data from the `data` fixture (RUN_ID prefix), API seeding via the `api` fixture when
  possible, cleanup in a fixture or `afterEach`. Must pass with 4 workers and in any order.
- Title: `should <behaviour> when <condition>`; tags in the describe title (`@regression`, `@smoke` only if
  under ~10 s); `requirement('<REQ-ID>')` as the first line.
- Assert the **business outcome** (value, state, redirect, API-confirmed change), not only visibility.
- Never click deny-listed actions; never pay.

Then, yourself, before handing over:
1. `npx eslint <file>` clean, `npx tsc --noEmit` clean.
2. 2-3 self code reviews against the rules above; fix what they find.
3. `npm run promote -- <file>` (10/10 with 1 worker, then 4 workers, retries 0, HEAL_MODE=strict).
4. Only on **Keep**: open a PR with `Closes #<plan issue>` into Kayla's review queue. The next flow may start
   while this one waits; never more than two crawler PRs open.

Flow notes:
<paste the plan item notes, the site-map entries for the pages involved, and their aria snapshots>
