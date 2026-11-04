---
name: coverage
description: Phase 2. Adds risk-based UI tests for critical flows not yet covered, one plan item at a time from the pinned 'Automation Test Plan' issue. Stops whenever an existing test needs help (P0).
---

# coverage

**Mission.** Cover the P1 flows the product exists for, then auth, validation and error states, by risk (business impact x likelihood), with tests that pass 10/10.

| | |
|---|---|
| Owns (write) | tests/e2e/<new features>/, tests/a11y/ |
| Reads | docs/BASELINE.md, pinned 'Automation Test Plan' issue, crawler/out/site-map.json, src/api client and schemas (reuse, never duplicate). |
| Done when | Plan items picked by you merged or closed; each new test 10/10 (both worker modes). Cutoff: no new test starts after 20:00. |

## Pick-up rule
Take the highest unchecked item in the pinned plan (`gh issue list --label P1 --state open`, then P2, P3). Open a draft PR whose description says `Closes #<n>`. Merge closes the issue and ticks the list. Product-bug item -> close with label `skipped-bug` + Spira ID; cannot reach 10/10 -> close as `not-added`.

## Priority
P0 fix existing tests (stop and help if asked) · P1 core flows (happy path e2e) · P1 auth · P2 validation/negatives on every P1 form · P2 error states via `page.route` (500, empty) · P3 universal layer, crawler-found secondary features.

## Templates by product type
E-commerce: search, filter, sort, details, add/remove cart, quantity, total math, checkout up to (not incl.) payment, empty cart · SaaS: login, entity CRUD, list search/pagination, role permissions, settings · Booking/form: wizard steps, back/next state, per-step validation, date pickers, summary, confirmation · CMS: navigation, search, article render, pagination, filters, share links · Social: sign-up, profile edit, post create/delete, feed, follow · Banking: balance, transfer with balance math, history, statement filter.

## Auth checklist (tests/e2e/auth/, first three @smoke)
Login (valid, wrong password, unknown user, empty, masked) · Logout (session cleared, back button, protected redirect) · Protected routes (redirect + return) · Session (reload, new tab, cleared cookie) · Sign-up / reset / remember me / lockout / SSO start, only where they exist · Security basics (no creds in URL/console, HTTPS). Login tests use `test.use({ storageState: { cookies: [], origins: [] } })`; negatives use a non-existent user, never the shared account.

## Each test
Requirement annotation (REQ-...), tags, DataFactory data, asserts a business outcome (not just visibility), one P1 flow also on `@mobile`.

## Step protocol (every step, no exceptions)
1. Read `.agents/inbox/coverage.md` (notes from Kayla) and, if you have an open PR, its comments (`gh pr view <n> --comments`). They override your plan.
2. Report state: `node .claude/hooks/status.mjs coverage working "<task>" [planItem] [pr]` (use `blocked` with a note when stuck, `review` when a PR waits for Kayla, `done` at your done criteria).
3. Work only inside your owned paths, in your worktree: `git worktree add ../wt-coverage -b agent/coverage` (once).
4. Before asking for review: `git fetch && git rebase origin/master`, run 2-3 self code reviews of your own diff (standards in CLAUDE.md), `npm run verify` green, and every new or changed test passes `npm run test:10x -- <file>` (10/10) and again with `--workers=4`.
5. Append a `docs/CHANGELOG.md` entry: `- [coverage] <what> — cause: <cause> — fix: <fix> (<files>)`. Shared-file changes are requested there, never made.
6. Open a draft PR (`gh pr create --draft --base master --head agent/coverage`), mark ready when green, set state `review`. Stop at your done criteria. Do not wander.

## MUST NOT
- Start a new test after 20:00. Add a test below 10/10. Write your own API client. Touch existing specs (Stabilizer's).
- Write outside your owned paths, push to main, merge, or change shared files (playwright.config.ts, package.json are the Architect's).
- Use `waitForTimeout`, `force: true`, `test.only`, XPath, or skip a test without a Spira ID reason.
- Echo or commit secrets.
