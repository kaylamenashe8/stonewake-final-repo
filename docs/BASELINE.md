# Baseline (before)

> Owner: Recon. Measured 2026-11-04 18:06-18:20 on the untouched code. Every other agent reads this first.

- Repo: https://github.com/kaylamenashe8/stonewake-final-repo · starting commit: `b4f92c9` (tag `baseline`, = original `origin/main`; tag already existed, not moved) · Playwright: 1.64.1 · Node: v26.13.0 locally (original workflow pins Node 22)
- Untouched suite = `tests/ui.spec.ts` (10 UI tests) + `tests/api.spec.ts` (10 API tests) as of `b4f92c9`. Kit tests added later (`tests/e2e/smoke`, `tests/api/health.api.spec.ts`, a11y, visual, seed) are not part of the baseline.
- First CI run on untouched code: **not created**. `gh workflow run playwright.yml --ref baseline` failed with
  `HTTP 403: Must have admin rights to Repository` (workflow id 407104485). No run exists for `b4f92c9`.
  Every run since 17:54 is stuck `queued` (12 runs, none started). Oldest, on the first kit commit `a983764`:
  https://github.com/kaylamenashe8/stonewake-final-repo/actions/runs/41862461011 (Playwright Tests, queued) and
  https://github.com/kaylamenashe8/stonewake-final-repo/actions/runs/41862461244 (CI, queued).
  The original author's own failed run is committed in `b4f92c9:test-results/` (10 failure folders: api 1, 2, 5, 9, 10; ui 1, 3, 6, 7, 10), the same 10 tests that fail below.
- How the "before" run was made (D15): the untouched specs were copied to an uncommitted harness, and only the three credential literals (judges' Judge 2 email, password, API key) were swapped for `TEST_USER`, `TEST_PASSWORD`, `STONEWAKE_API_KEY` from `.env` (Finalist 4). Nothing else changed. `--repeat-each=5 --retries=0 --workers=4`, fully parallel, chromium. Raw: `test-results/recon-5x.json` (not committed).

## Product profile
| Question | Answer | Evidence | Plan impact |
|---|---|---|---|
| Product type | B2B SaaS dashboard (export/project/real-estate finance intelligence): Deal Book, Network, Institutions, Screenings, Countries, Portfolio, Monitoring, Tenders, Settings | AT_A_GLANCE.md, JUDGES_FOCUS.md | SaaS-dashboard template; judges' six flows first |
| Authentication | Form: email + password + mandatory "I agree to the Evaluation Terms" checkbox (custom `button[role=checkbox]`); "Email me a link" alternative. No captcha or MFA seen | ui 2/4/5 pass; F8, F10 | One `storageState` setup project; login page object ticks terms by role |
| Test accounts | One account per finalist (Finalist 4, D15), shared by every test and worker | D15 | No destructive mutation; any write uses RUN_ID data + teardown; never touch other workspaces |
| Data reset | None known (J4 unanswered) | DECISIONS J4 empty | Read-only assertions by default; Monitoring add/remove must clean up itself |
| Public API / XHR | Yes. REST `https://api.stonewake.ai/v1`, `Authorization: Bearer <key>`, key role `viewer`; MCP server (read-only). Health is at `/health`, not `/v1/health` | curl: `/health` 200, `/v1/health` 404; `Token` scheme 401, `Bearer` 200 | API seeding not possible (viewer); use API for contract checks and UI-vs-API parity |
| Bot protection / rate limits | No Cloudflare headers. API: `x-ratelimit-limit: 600`, documented 429 `rate_limited` / `daily_quota_exceeded`. **ToS 4(j) forbids automated UI access except API/MCP** (notes-C) | curl -I; notes-C section 0 | Workers 4 is safe for the API; ask judges to confirm UI automation is permitted for the competition (risk, see Blockers) |
| Site stability (10 health requests: codes, p50/p95 ms) | app `/login`: 10/10 200, p50 ~410 ms, p95 ~530 ms. api `/health`: 200; `/v1/health`: 10/10 404 at ~290-420 ms | curl loop 18:12 | Stable; no STP flag. Keep web-first waits, no readiness poll needed |
| Test IDs in DOM (attribute) | Partial: `data-testid` on Portfolio tiles, `data-tour="module-*"` on sidebar links; most elements have none. `TEST_ID_ATTRIBUTE` unset (default `data-testid`) | ui.spec.ts selectors | Role + name locators first; `getByTestId` only for the tiles |
| Dynamic content | Live deals and scores, counts per status (e.g. not_assessed = 0 today), dates (rate dates, review dates), team-dependent Deal Book, partial data per company | API summary `{green:13, amber:1, red:0, insufficient:11, not_assessed:0, sole_trader:0}` | Never assert exact counts or that a given tile/deal exists; mask in visual; pin the team |

## Counts
| Metric | Value | How measured |
|---|---|---|
| Tests | 20 (10 UI, 10 API) | `b4f92c9` specs, `--list` |
| Passing (5/5) | 10 (api 3, 4, 6, 7, 8; ui 2, 4, 5, 8, 9) | `--repeat-each=5 --retries=0 --workers=4` |
| Failing (0/5) | 10 (api 1, 2, 5, 9, 10; ui 1, 3, 6, 7, 10) | same run: 50 passed, 50 failed |
| Flaky (1-4/5) | 0 (every failure is deterministic) | same run |
| Lint errors | 177 errors, 54 warnings (ui 29+51, api 148+3) | `eslint --stdin` with the kit config on the original files |
| Hard waits | 3 `waitForTimeout` (ui 1: 2000, ui 7: 3000, ui 8: 1000) | grep |
| Brittle selectors (XPath, nth-child, long CSS) | 18 XPath, 27 CSS id/attribute/structural (`#app-sidebar a[data-tour=...]`, `main a[href^=...]`, `tbody a...`), 3 `text=`, 2 `.first()` | grep |
| Missing awaits | 0 (`no-floating-promises` not hit) | eslint |
| Hardcoded absolute URLs | 67 | grep `https://(app|api).stonewake.ai` |
| Secrets in code | 3 literals (email, password, API key of the judges' Judge 2 account) + committed `.env` | F1, F2 |
| Suite duration | 166.6 s for 100 runs at 4 workers (~33 s per pass); the 3 timeouts cost 30 s each | JSON stats |

## Test inventory
| File | Test | Tag | Pass rate /5 | Failure signature |
|---|---|---|---|---|
| tests/api.spec.ts | api 1 health | none | 0/5 | `status 404 != 200` on `GET /v1/health` (health lives at `/health`) |
| tests/api.spec.ts | api 2 me | none | 0/5 | `status 401 != 200` on `GET /v1/me`: sends `Authorization: Token` (F4) |
| tests/api.spec.ts | api 3 no token | none | 5/5 | |
| tests/api.spec.ts | api 4 bad keys | none | 5/5 | |
| tests/api.spec.ts | api 5 portfolio list | none | 0/5 | `Array.isArray(b.data)` false (line 73): API returns `items`, not `data` |
| tests/api.spec.ts | api 6 portfolio summary | none | 5/5 | |
| tests/api.spec.ts | api 7 entities | none | 5/5 | |
| tests/api.spec.ts | api 8 entity not found | none | 5/5 | |
| tests/api.spec.ts | api 9 countries | none | 0/5 | `iso2 "DE" != "GE"` (line 168): wrong expected value |
| tests/api.spec.ts | api 10 search | none | 0/5 | `"<= 25" != "<= 50"` (line 199): limit ceiling expectation differs from the API |
| tests/ui.spec.ts | ui 1 login ok | none | 0/5 | timeout 30 s, `page.fill('#email')` (line 12) on /login: no element with id `email` (ui 2 passes with `input[type=email]`) |
| tests/ui.spec.ts | ui 2 wrong password | none | 5/5 | |
| tests/ui.spec.ts | ui 3 terms checkbox | none | 0/5 | timeout 30 s, `page.check('input[type="checkbox"]')` on /login: terms box is a `button[role=checkbox]` |
| tests/ui.spec.ts | ui 4 not logged in redirect | none | 5/5 | |
| tests/ui.spec.ts | ui 5 logout | none | 5/5 | |
| tests/ui.spec.ts | ui 6 sidebar | none | 0/5 | timeout 30 s, `click('//aside//a[...="EDD Dossier"]')` (line 105): no such sidebar item in the Finalist 4 workspace |
| tests/ui.spec.ts | ui 7 deal book search | none | 0/5 | `toBeVisible` failed, `main a[href^='/deal/']` .first() (line 124) on Deal Book: no deal link matches |
| tests/ui.spec.ts | ui 8 countries | none | 5/5 | (passes but carries `waitForTimeout(1000)` and XPath) |
| tests/ui.spec.ts | ui 9 institutions | none | 5/5 | (depends on fixed data: `/entities/4` = UK Export Finance, exactly 1 match) |
| tests/ui.spec.ts | ui 10 portfolio | none | 0/5 | `toBeVisible` failed, `[data-testid="tile-not-assessed"]` (line 191) on /portfolio: not_assessed count is 0 today |

## Failure clusters
| Cluster | Signature (error + locator/helper + page) | Tests affected | Suspected cause | Stabilizer instance |
|---|---|---|---|---|
| C1 | `toBe` mismatch on response body fields, API `/v1/portfolio`, `/v1/countries/DEU`, `/v1/search` | api 5 portfolio list, api 9 countries, api 10 search (tests/api.spec.ts) | Wrong assertions / contract drift: `data` vs `items`, iso2 `GE` vs `DE`, limit max 50 vs 25. Verify each against API docs: wrong test -> fix; doc says otherwise -> product bug (Spira) | S2 |
| C2 | Test timeout 30 s on a login-form locator (`#email`, `input[type="checkbox"]`) on /login | ui 1 login ok, ui 3 terms checkbox (tests/ui.spec.ts) | Brittle CSS against the real DOM; terms box is a custom checkbox. One login page object (role/label) fixes both and the 7 copy-pasted login blocks | S1 |
| C3 | Status mismatch on API auth/routing (`404 != 200`, `401 != 200`) | api 1 health, api 2 me (tests/api.spec.ts) | `/v1/health` vs `/health`; `Token` vs `Bearer` (F4). Shared API client with base URL + Bearer header | S1 |
| C4 | `toBeVisible` on data-dependent element in authenticated page (Deal Book list, Portfolio tile) | ui 7 deal book search, ui 10 portfolio (tests/ui.spec.ts) | Assumes data that the Finalist 4 workspace does not have today (deal links `/deal/`, a not-assessed tile); also hard wait 3 s. Assert structure, pick data via API, check team | S3 |
| C5 | Timeout on XPath sidebar link (`EDD Dossier`) after login | ui 6 sidebar (tests/ui.spec.ts) | Workspace shows only its team's modules (AT_A_GLANCE); test hardcodes a module list. Drive from visible nav items or confirm with judges whether EDD Dossier should exist | S3 |

## Proposed Stabilizer split (disjoint spec folders, balanced by failing tests)
The baseline has two flat files, so the Architect (or S1 first) moves tests into folders; each instance then owns one set of folders only.
| Instance | Folders (owns) | Tests moved there | Failing | Clusters |
|---|---|---|---|---|
| S1 | `tests/e2e/auth/`, `tests/api/auth/` | ui 1-5; api 1-4 | 4 (ui 1, ui 3, api 1, api 2) | C2, C3 (+ shared LoginPage, API client) |
| S2 | `tests/api/data/` | api 5-10 | 3 (api 5, 9, 10) | C1 |
| S3 | `tests/e2e/modules/` (dealbook, navigation, countries, institutions, portfolio) | ui 6-10 | 3 (ui 6, 7, 10) | C4, C5 |
S1 merges first: S3 depends on its login page object / storageState.

## Top 10 issues by stability impact
1. Login form locators do not match the DOM (`#email`, `input[type=checkbox]`): 2 tests time out at 30 s; login copy-pasted in 7 tests instead of a setup project/storageState.
2. API contract assertions wrong or out of date (`data`/`items`, iso2, search limit ceiling): 3 tests.
3. API auth and routing: `Token` instead of `Bearer`, `/v1/health` instead of `/health`: 2 tests.
4. Data-dependent assertions on a live workspace (first deal link, not-assessed tile, `/entities/4` = UKEF with exactly 1 match): 2 failing now, 1 passing by luck.
5. Hardcoded module list in the sidebar test (EDD Dossier missing in this workspace): 1 test.
6. Secrets in code: judges' email, password and API key in both spec files, plus committed `.env` (F1, F2, F9). Running the original suite as-is would act in the judges' workspace (D15).
7. 3 hard waits (`waitForTimeout` 1-3 s) and page-level `page.click/fill` (52 calls, deprecated style).
8. 18 XPath and 27 structural CSS selectors; no role/label locators.
9. 67 hardcoded absolute URLs, no `baseURL`/`API_URL`; original `playwright.config.ts` is minimal (timeout 30 s, 2 workers, list+html reporters, no baseURL, no projects/setup, no retries policy).
10. Lint: 177 errors (52 `no-var`, 93 unsafe-any accesses on untyped JSON, 18 restricted syntax); no schemas for API bodies.

## Repo health notes
- Deprecated APIs: page-level `page.click/fill/check/uncheck` (52), `waitForTimeout` (3), XPath (18), `text=` (3). No `page.$`, `elementHandle`, `waitForSelector`.
- TS strictness: `tsc --strict` 0 errors on the originals (JSON bodies are `any`, so strict mode catches nothing; lint catches 93 unsafe-any uses). `npm outdated`: only `@types/node` 22 -> 26 and `typescript` 5.9 -> 7.0 (majors, leave).
- Independence: the 5x run was fully parallel at 4 workers with repeat-each; results were identical across all 5 repeats (no order or concurrency effect seen). Reversed-order run not done (time box).
- CI state: original `.github/workflows/playwright.yml` runs on push/PR/dispatch, Node 22, chromium, uploads the HTML report as an artifact; no Pages, no secrets used (credentials hardcoded). Kit workflows (`ci.yml`, `run-suite.yml`, `stability-gate.yml`, `triage.yml`) exist on master; all 12 runs since 17:54 are `queued`. Dispatch is refused (403, admin rights).
- Secrets in code: `tests/ui.spec.ts` lines 3-4 (email, password), `tests/api.spec.ts` line 3 (API key), `.env` committed in `b4f92c9` (values not reproduced here).

## Blockers and risks for the Lead
- CI: runners never pick up jobs (all queued); `workflow_dispatch` returns 403 "Must have admin rights". Check Actions settings / billing / runner availability and the token's scope (`gh auth refresh -s workflow` or admin). No baseline CI run link exists yet.
- ToS 4(j) (notes-C) forbids automated reading of the dashboard UI except through API/MCP. The competition brief implies permission; get it confirmed in writing by the judges and record it in DECISIONS.
- J4 (data reset) unanswered: Monitoring add/remove (T13) needs a clean-up plan or judge confirmation.
