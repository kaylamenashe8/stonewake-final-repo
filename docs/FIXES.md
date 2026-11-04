# Automation faults fixed

> Owner: Stabilizer rows, Scribe summary. One row per issue fixed in the automation project (product faults go to BUGS.md).

## Summary by category
| Category | Count |
|---|---|
| hard wait | 0 |
| brittle selector | 0 |
| missing await | 0 |
| test interdependence | 0 |
| shared data | 0 |
| wrong assertion | 0 |
| outdated API | 0 |
| config | 0 |
| CI | 0 |
| secrets in code | 0 |
| **Total** | **0** |

<!-- One-line summary for the video and STP, e.g. "14 hard waits removed, 9 XPath selectors replaced". -->

## Fix log
| ID | Category | File | Problem | Fix | Commit |
|---|---|---|---|---|---|
| F1 | secrets in code | .env (committed) | Credentials (email, password, API key) committed to a public repo in .env | Untracked .env, added to .gitignore; values moved to GitHub secrets/variables | a983764 |
| F2 | secrets in code | tests/ui.spec.ts, tests/api.spec.ts | Email, password and API key hardcoded in the test files (they belong to Judge 2, the judges' shared workspace) | Open: read from env (TEST_USER, TEST_PASSWORD, STONEWAKE_API_KEY). API part done in FA6 | |
| F3 | config | node_modules/, test-results/, playwright-report/ | 399 generated files committed to git | Untracked and ignored | a983764 |
| F4 | wrong assertion | tests/api.spec.ts ('api 2 me' and others) | Sends `Authorization: Token <key>`; the API documents `Bearer` | Done in FA2: use `Bearer` | PR #32 |
| F5 | hard wait | tests/ui.spec.ts ('ui 1 login ok') | `page.waitForTimeout(2000)` | Open: wait on the URL or a visible element | |
| F6 | brittle selector | tests/ui.spec.ts | XPath (`//h1[text()=...]`, `//aside//button`) and CSS-class selectors | Open: role/label locators | |
| F7 | config | tests/*.spec.ts, playwright.config.ts | Absolute URLs hardcoded in every test; no baseURL | Open: baseURL / API_URL from env. API part done in FA7 | |
| F8 | config | src/pages/LoginPage.ts (kit) | Sign in stays disabled until the "I agree to the Evaluation Terms" checkbox is ticked | Login ticks the terms checkbox by role and name | a983764 |
| F9 | config | .env, tests/*.spec.ts | The suite ran against the judges' shared workspace (Judge 2 login and API key), not the finalist's own | .env and GitHub secrets switched to the Finalist 4 workspace; tests must read credentials from env | (local .env + secrets) |
| F10 | brittle selector | src/pages/LoginPage.ts (kit) | `Sign in` role locator also matched "Email me a link to sign in instead", so it healed to a CSS fallback | Exact name match `^(log in|sign in)$` | |
| FA1 | outdated API | tests/api.spec.ts -> tests/api/existing/health-auth.access.spec.ts ('api 1 health') | `GET /v1/health` is 404; health lives at `/health` (C3) | Request `/health` on the API_URL baseURL | PR #32 |
| FA2 | wrong assertion | tests/api/existing/health-auth.access.spec.ts ('api 2 me') | Sent `Authorization: Token <key>` -> 401; the API documents `Bearer` (C3, closes F4) | `ApiClient.setToken()` (the `api` fixture) sends `Bearer` | PR #32 |
| FA3 | wrong assertion | tests/api/existing/data.read.spec.ts ('api 5 portfolio list') | Expected the list under `data`; docs and API use `{items, limit, offset, total}` (C1) | Assert on `items` | PR #32 |
| FA4 | wrong assertion | tests/api/existing/data.read.spec.ts ('api 9 countries') | Expected Germany `iso2` = `GE` (that is Georgia); API returns `DE`, the ISO 3166-1 code (C1) | Expect `DE` | PR #32 |
| FA5 | wrong assertion | tests/api/existing/data.read.spec.ts ('api 10 search') | Expected search `limit` max 50; API docs say "caps at 25" and the API answers `<= 25` (C1) | Expect `Input should be less than or equal to 25` | PR #32 |
| FA6 | secrets in code | tests/api.spec.ts (all 10 API tests) | Judge 2 API key hardcoded (`var KEY = 'swk_live_...'`), so the suite ran in the judges' workspace (F2, F9) | Key read from `env.STONEWAKE_API_KEY` (zod-validated src/config/env; .env / GitHub secret) in `tests/api/existing/helpers.ts`; never logged | PR #32 |
| FA7 | config | tests/api.spec.ts (all 10 API tests) | 50 absolute `https://api.stonewake.ai` URLs; specs imported from `@playwright/test`; `console.log` of the /me body; untyped `any` (F7) | Relative paths on the `api` project baseURL (API_URL); `test`/`expect` from `src/fixtures`; requests through the `api` fixture (ApiClient), every body parsed by a zod schema (tests/api/existing/schemas.ts); `feature.action.spec.ts` names and "should ... when ..." titles keeping the "api N" prefix | PR #32 |
| FA8 | shared data | tests/api/existing/data.read.spec.ts ('api 6 portfolio summary') | Compared the summary's active_exposures with the portfolio list total across two requests on live data other lanes write to, so a write between them could flake it | Both reads re-run in `expect.poll` until one consistent pair is seen | PR #32 |
| FA9 | wrong assertion | tests/api/existing/* (api 1-10) | Response bodies were unchecked `as T` casts and team scope used a conditional assertion | zod schemas for every response (team-scope rule as `.refine`), requests through ApiClient, phases in `test.step` | PR #32 |
| F11 | brittle selector | tests/e2e/auth/login.signin.spec.ts ('ui 1 login ok') | `#email` does not exist (field is `input[type=email]`); timed out at 30 s (C2) | LoginPage: `getByLabel('Email', exact)` with CSS alternates | |
| F12 | brittle selector | tests/e2e/auth/login.signin.spec.ts ('ui 3 terms checkbox') | `page.check('input[type="checkbox"]')`: the terms box is a custom `button[role=checkbox]` (C2) | `getByRole('checkbox', /agree to the .*terms/i)` + `check()`/`uncheck()`; idempotent because the tick persists in localStorage | |
| F13 | test interdependence | tests/e2e/** (from tests/ui.spec.ts) | Login copy-pasted in 7 tests, 9 logins per run | Shared session via auth.setup storageState; only ui 1/ui 5 sign in, in their own context (sign out must not end the shared session) | |
| F14 | outdated API | tests/e2e/modules/dealbook.search.spec.ts ('ui 7') | Deal links are `/deals/<id>`, test looked for `/deal/` (C4) | First row link of the deals table by role; no id or count assumed | |
| F15 | brittle selector | tests/e2e/modules/portfolio.open.spec.ts ('ui 10') | Tile test id is `tile-not_assessed`, test used `tile-not-assessed` (C4; the tile renders at count 0, so not a data issue) | `PortfolioPage.tile(key)` over a typed tile list; asserts structure (numeric count), not today's values | |
| F16 | wrong assertion | tests/e2e/modules/portfolio.open.spec.ts ('ui 10') | Company page URL carries `?from=portfolio`; full-URL regex anchored on `$` | Assert on `url.pathname` | |
| F17 | shared data | tests/e2e/modules/sidebar.navigate.spec.ts ('ui 6') | Hardcoded module list incl. "EDD Dossier", absent in the itac-4 team workspace (C5) | Loop over the links the sidebar shows; heading must contain the link name | |
| F18 | hard wait | tests/e2e/modules/{dealbook,countries}.search.spec.ts, auth/login.signin.spec.ts | 3 `waitForTimeout` (2 s, 3 s, 1 s) | Removed; web-first assertions on the next visible state | |
| F19 | brittle selector | tests/e2e/** (from tests/ui.spec.ts) | 18 XPath, 27 structural CSS, `text=` selectors | Role/label locators in page objects (LoginPage, DealBookPage, PortfolioPage, CountriesPage, InstitutionsPage, Sidebar) | |
| F20 | config | tests/e2e/** (from tests/ui.spec.ts) | 67 absolute `https://app.stonewake.ai` URLs | Relative paths on `baseURL`; URL checks on `pathname` | |
| F21 | shared data | tests/e2e/auth/login.signin.spec.ts ('ui 2 wrong password') | Failed sign-ins for the real shared TEST_USER (20+ per pre-pr run) could lock the account auth.setup uses | Wrong password sent for a RUN_ID-prefixed DataFactory email with no account; the product shows the same "do not match" message | |
| F22 | brittle selector | src/pages/DealBookPage.ts, tests/generated/pages/DealBookPage.ts | Two Deal Book page objects; ui 7 built `a[href=…]` in the spec and its Deals-tab alternate `[aria-selected=true]` made the selected-tab assertion tautological | One DealBookPage (generated copy merged and deleted), `dealLink(href)`, Deals tab by role only | |
| F23 | test interdependence | tests/e2e/auth/session.logout.spec.ts ('ui 5 logout') | Suspected: Sign out might revoke every session of TEST_USER and break parallel tests on the shared storageState | Checked: logout x5 in parallel with ui 6/9/10 x5 (4 workers) all green, and .auth/user.json still opens /portfolio after a sign-out: sign-out is per session, no isolation needed | |
