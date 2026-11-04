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
| F2 | secrets in code | tests/ui.spec.ts, tests/api.spec.ts | Email, password and API key hardcoded in the test files (they belong to Judge 2, the judges' shared workspace) | UI half fixed: tests/e2e read TEST_USER/TEST_PASSWORD from env (tests/e2e/auth/credentials.ts); API half open (S-api) | |
| F3 | config | node_modules/, test-results/, playwright-report/ | 399 generated files committed to git | Untracked and ignored | a983764 |
| F4 | wrong assertion | tests/api.spec.ts ('api 2 me' and others) | Sends `Authorization: Token <key>`; the API documents `Bearer` | Open: use `Bearer` | |
| F5 | hard wait | tests/ui.spec.ts ('ui 1 login ok') | `page.waitForTimeout(2000)` | Open: wait on the URL or a visible element | |
| F6 | brittle selector | tests/ui.spec.ts | XPath (`//h1[text()=...]`, `//aside//button`) and CSS-class selectors | Open: role/label locators | |
| F7 | config | tests/*.spec.ts, playwright.config.ts | Absolute URLs hardcoded in every test; no baseURL | Open: baseURL / API_URL from env | |
| F8 | config | src/pages/LoginPage.ts (kit) | Sign in stays disabled until the "I agree to the Evaluation Terms" checkbox is ticked | Login ticks the terms checkbox by role and name | a983764 |
| F9 | config | .env, tests/*.spec.ts | The suite ran against the judges' shared workspace (Judge 2 login and API key), not the finalist's own | .env and GitHub secrets switched to the Finalist 4 workspace; tests must read credentials from env | (local .env + secrets) |
| F10 | brittle selector | src/pages/LoginPage.ts (kit) | `Sign in` role locator also matched "Email me a link to sign in instead", so it healed to a CSS fallback | Exact name match `^(log in|sign in)$` | |
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
