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
| F2 | secrets in code | tests/ui.spec.ts, tests/api.spec.ts | Email, password and API key hardcoded in the test files | Open: read from env (TEST_USER, TEST_PASSWORD, STONEWAKE_API_KEY) | |
| F3 | config | node_modules/, test-results/, playwright-report/ | 399 generated files committed to git | Untracked and ignored | a983764 |
| F4 | wrong assertion | tests/api.spec.ts ('api 2 me' and others) | Sends `Authorization: Token <key>`; the API documents `Bearer` | Open: use `Bearer` | |
| F5 | hard wait | tests/ui.spec.ts ('ui 1 login ok') | `page.waitForTimeout(2000)` | Open: wait on the URL or a visible element | |
| F6 | brittle selector | tests/ui.spec.ts | XPath (`//h1[text()=...]`, `//aside//button`) and CSS-class selectors | Open: role/label locators | |
| F7 | config | tests/*.spec.ts, playwright.config.ts | Absolute URLs hardcoded in every test; no baseURL | Open: baseURL / API_URL from env | |
| F8 | config | src/pages/LoginPage.ts (kit) | Sign in stays disabled until the "I agree to the Evaluation Terms" checkbox is ticked | Login ticks the terms checkbox by role and name | a983764 |
