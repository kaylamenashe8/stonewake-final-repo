# Crawler test generator (D8)

Runs locally on Kayla's laptop, out of band, 18:20-20:00. Never in CI or the gate: `tests/generated/` is
ignored by `playwright.config.ts` until a reviewed PR promotes a spec into `tests/e2e/<feature>/`.

| Step | Command | Output |
| --- | --- | --- |
| Log in once | `npx playwright test --project=setup` | `.auth/user.json` (crawler reuses it) |
| Crawl | `npm run crawl -- [--base URL] [--start /path] [--max-pages 150] [--max-depth 3] [--no-axe] [--no-click]` | `crawler/out/site-map.json`, `site-map.md`, `signals.md` |
| Plan | planner agent with `prompts/plan.md` | items in `docs/TEST_PLAN.json` → `npm run plan:issues` |
| Generate | generator agent with `prompts/generate-ui.md` / `generate-api.md`, one test at a time | `tests/generated/*.spec.ts` |
| Filter | `npm run promote -- tests/generated/<file> [--apply]` | verdict + `crawler/out/promotion-report.md` |

## What the crawl does
- BFS from `--start`, same origin, depth ≤ 3, ≤ 150 pages, ~1 page/s (`--delay` ms).
- URL patterns: `/product/123` → `/product/:id`, UUIDs → `:uuid`, hashes → `:hash`; query dropped except
  `page, q, search, query, sort, category, tab, type, view`. Each pattern is visited once.
- Read-only. Forms are recorded, never submitted. Links and actions matching the deny-list (logout, delete,
  remove, cancel, pay, confirm/place order, purchase, admin, unsubscribe, reset app) are never followed.
- SPA routes without `href`: click discovery clicks up to `--click-limit` (8) new, non-mutating actions per page,
  each in a **throwaway browser context** (state changes discarded), and enqueues the URL it lands on.
  Names that look like writes (add, save, submit, checkout, continue...) are skipped.
- Per page: pattern, title, status, load time, aria snapshot, forms, actions, links, console errors, failed
  requests, app-origin XHR/fetch (method, pattern, status, request and response bodies up to 2 KB), axe
  critical/serious violations.

## Signals (free bug leads → Bug Reporter)
`signals.md`: 4xx pages, 5xx pages and XHRs, console and page errors, failed requests, pages slower than 3 s,
axe critical/serious. Reproduce manually with Jam before drafting a bug in `docs/BUGS.md`.

## Promotion filter
Static checks first (lint, imports `src/fixtures`, at least one non-visibility assertion, no hard waits),
then `--repeat-each=10 --retries=0 HEAL_MODE=strict` with 1 worker and, if clean, with 4 workers.

| Result | Verdict | Action |
| --- | --- | --- |
| 10/10 in both modes | Keep | `git mv` to `tests/e2e/<feature>/`, promotion PR, AI_LOG entry |
| 1-9 of 10 | Flaky | delete; signatures logged in the report |
| 0/10, triage says product | Product bug | keep, `knownBug('SPIRA-<id>', ...)` once filed |
| 0/10, triage says automation | Bad test | one regeneration attempt, then delete |
| 0/10, triage says environment | Parked | retry next cycle |
| 0/10, classifier undecided | Needs triage | `npm run diagnose`, then re-run promote |

Without `--apply`, moves and deletes are printed, not done.
