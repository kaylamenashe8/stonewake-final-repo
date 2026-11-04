# Software Test Plan (STP)

> Owner: Scribe. Sources: [BASELINE.md](BASELINE.md), [TEST_PLAN.md](TEST_PLAN.md), [FIXES.md](FIXES.md), [BUGS.md](BUGS.md), [DECISIONS.md](DECISIONS.md), gate runs. Every number links to its source.

## 1. Scope
| In scope | Out of scope |
|---|---|
| The 20 baseline tests (10 UI, 10 API, [BASELINE.md](BASELINE.md)); the judges' six flows F1-F6 (Deal Book, Screenings, Network/Institutions, Countries, Monitoring/Portfolio incl. Sentiment, API/MCP) as plan items T01-T34 ([TEST_PLAN.md](TEST_PLAN.md)); auth (login, terms, session, logout); REST `/v1` + `/health` + MCP contracts; security in our own workspace only (D17); a11y/visual on key pages (P3) | Cross-browser beyond Chromium (Firefox/WebKit projects exist, off by default); load testing and anything that degrades the shared service (D17); other finalists' or the judges' workspaces (D15); asserting live posts, counts or scores (D18, BASELINE "Dynamic content") |

## 2. Product profile (from Recon)
| Question | Answer | Plan impact |
|---|---|---|
| Product type | B2B SaaS dashboard for export/project/real-estate finance intelligence (Deal Book, Network, Institutions, Screenings, Countries, Portfolio, Monitoring, Tenders, Settings) | SaaS-dashboard template; the judges' six flows first |
| Authentication | Email + password + mandatory "I agree to the Evaluation Terms" checkbox (`button[role=checkbox]`); no captcha/MFA | One `auth.setup.ts` storageState; LoginPage ticks terms by role (F8, F12) |
| Test accounts | One account per finalist (Finalist 4), shared by every worker (D15) | No destructive writes; RUN_ID data + teardown; wrong-password test uses a non-existent RUN_ID email (F21) |
| Data reset | None known (J4 unanswered) | Read-only assertions by default; Monitoring tests add and remove their own RUN_ID name (D18) |
| Public API / XHR | REST `https://api.stonewake.ai/v1`, `Authorization: Bearer`, key role `viewer`; `/health` unversioned; read-only MCP server | API for contract checks and UI-vs-API parity, not seeding (viewer) |
| Bot protection / rate limits | No Cloudflare; `x-ratelimit-limit: 600` observed, docs say 120/min per key, 50,000/day per workspace; ToS 4(j) limits automated UI access | API tests lean, one request per header test (T20); rate limit never probed |
| Site stability (10 health requests) | app `/login` 10/10 200, p50 ~410 ms, p95 ~530 ms; api `/health` 200 | Stable; web-first waits, no readiness poll |
| Test IDs in DOM | Partial: `data-testid` on Portfolio tiles, `data-tour="module-*"` on sidebar links | Role + name locators first; `getByTestId` for tiles only |
| Dynamic content | Live deals, scores, status counts, dates, team-dependent Deal Book | Never assert exact counts or a given deal; pick data from the page/API; mask in visual |

Source: [BASELINE.md](BASELINE.md#product-profile).

## 3. Risk analysis
| ID | Area / flow | Business impact (1-5) | Likelihood (1-5) | Risk | Priority | Covered by |
|---|---|---|---|---|---|---|
| R1 | Login / session (all flows depend on it) | 5 | 3 | 15 | P1 | tests/e2e/auth/*, auth.setup.ts |
| R2 | F1 Deal Book: filter, open, export | 5 | 3 | 15 | P1 | T01, T02, T03 (merged) |
| R3 | F6 API/MCP contracts and auth scheme | 4 | 4 | 16 | P1 | T16-T18, T20, T21, tests/api/legacy-api/* |
| R4 | F2 Screenings: verdict cites sources, person never rated | 5 | 2 | 10 | P1 | T05, T06 (not started) |
| R5 | F5 Monitoring/Portfolio incl. Sentiment (new on the day) | 4 | 4 | 16 | P1 | T15 (merged); T13, T30, T31 (not started); ui 10 portfolio |
| R6 | F3 Network / F4 Countries: sourced data | 4 | 2 | 8 | P1 | T08, T10 (merged); ui 8, ui 9 |
| R7 | Security: XSS in inputs, key/role enforcement, cookies | 5 | 2 | 10 | P2 | T32-T34 (not started) |
| R8 | Shared live workspace: data changes under the tests | 3 | 4 | 12 | - | Design rule: no live values asserted (FA8, F15, F17) |

Risk = impact x likelihood. Impact from JUDGES_FOCUS (six flows); likelihood from BASELINE failure clusters and product changelog notes.

## 4. Test levels and types
| Level / type | Tool | Tag | Project | Runs in |
|---|---|---|---|---|
| E2E UI | Playwright | @smoke @regression | chromium | ci.yml, gate |
| API | Playwright request + zod | @api | api | ci.yml, gate |
| Accessibility | @axe-core/playwright (critical + serious) | @a11y | chromium | ci.yml, gate |
| Visual | toHaveScreenshot, Docker baselines | @visual | chromium | ci.yml (gate if stable) |
| Responsive | Pixel 7 | @mobile | mobile | ci.yml |

## 5. Environments and data strategy
- Environment: app https://app.stonewake.ai, API https://api.stonewake.ai (production, Finalist 4 workspace); Chromium from Playwright 1.64.1; image `mcr.microsoft.com/playwright:v1.64.1-noble` (Dockerfile, ci.yml, run-suite.yml, triage.yml).
- Every CI job runs in `mcr.microsoft.com/playwright:v<version>-noble` (D11).
- Data: DataFactory with RUN_ID prefix (`<run_id>-<n>-w<worker>`), cleanup in fixture teardown, read-only checks on shared data.
- Accounts: one shared Finalist 4 user (TEST_USER) and one `viewer` API key (STONEWAKE_API_KEY), both from `.env` / GitHub secrets; one login per run via storageState. Only ui 1 and ui 5 sign in themselves, in their own context (F13, F23).

## 6. Entry and exit criteria
| Entry | Exit |
|---|---|
| BASELINE committed, CI runs on master (D14), secrets set | Stability Gate 5/5 green, retries 0, 0 heals, every product failure filed in SpiraTest and skipped with its ID, lint 0 errors |

## 7. Traceability matrix
| Requirement | Description | Risk | Test files | Status | Known bugs |
|---|---|---|---|---|---|
| BASE-UI | Baseline ui 1-10 (login, terms, redirect, logout, sidebar, Deal Book, Countries, Institutions, Portfolio) | R1, R2, R6 | tests/e2e/auth/{login.signin,session.logout,session.redirect}.spec.ts, tests/e2e/modules/*.spec.ts | migrated, fixed (PR #37, #44) | none |
| BASE-API | Baseline api 1-10 (health, me, auth errors, portfolio, entities, countries, search) | R3 | tests/api/legacy-api/*.spec.ts | migrated, fixed (PR #32) | none |
| REQ-DEAL-01 | T01 sector filter narrows the Deal Book | R2 | tests/e2e/dealbook/dealbook.filter-sector.spec.ts | merged (PR #31) | none |
| REQ-DEAL-02 | T02 open a deal: brief, key facts, source | R2 | tests/e2e/dealbook/dealbook.open-deal.spec.ts | merged (PR #41) | none |
| REQ-DEAL-03 | T03 Export .xlsx | R2 | tests/e2e/dealbook/dealbook.export-xlsx.spec.ts | merged (PR #42); PDF part not promoted | none |
| REQ-API-01 | T16 /health and /v1/health 404 | R3 | tests/api/health.get.spec.ts | merged (PR #36) | none |
| REQ-API-02 | T17 deals list/detail/sort contract | R3 | tests/api/deals.{list,detail}.spec.ts | merged (PR #36) | none |
| REQ-API-03 | T18 screenings, network, ownership | R3 | tests/api/{screenings.list,network.get,ownership.get}.spec.ts | merged (PR #36) | none |
| REQ-API-05 | T20 422 envelope, rate-limit headers | R3 | tests/api/{deals.filters,ratelimit.headers}.spec.ts | merged (PR #36) | none |
| REQ-API-06 | T21 MCP entity equals REST | R3 | tests/api/mcp.entity.spec.ts | merged (PR #36); SPIRA-89 knownBug test merged (PR #51) | [SPIRA-89](https://itac.spiraservice.net/33/Incident/89.aspx) (PR #45) |
| REQ-CTY-01 | T10 country risk score and cited indicators | R6 | tests/e2e/countries/country-profile.risk-score.spec.ts | merged (PR #48) | none |
| REQ-POR-01 | T15 Portfolio tiles equal /v1/portfolio/summary | R5 | tests/e2e/portfolio/portfolio.status-tiles.spec.ts | merged (PR #49) | none |
| REQ-NET-01 | T08 company lookup: officers, cited relationships | R6 | tests/e2e/network/network.company-lookup.spec.ts | merged (PR #52) | none |
| REQ-SCR-01/02, REQ-MON-01/03/04, REQ-API-04 | Remaining P1 items | R4, R5 | none | not started | none |
| REQ-SEC-01..03 | T32-T34 security | R7 | none | not started | none |

All other P2/P3 requirements: not started; full list with issue links in [TEST_PLAN.md](TEST_PLAN.md).

Plan items and PRs: [TEST_PLAN.md](TEST_PLAN.md).

## 8. Tooling and CI
ci.yml (lint, typecheck, 4 shards, Pages, Slack, triage) · stability-gate.yml (5 parallel or sequential runs) · triage.yml (diagnosis ladder + Claude) · Docker · GitHub Pages history. Details: [ARCHITECTURE.md](ARCHITECTURE.md).

## 9. Flakiness policy and triage ladder
- A new test joins only after 10/10 (`--repeat-each=10 --retries=0`, 1 and 4 workers). Below 10/10 = not added.
- Existing tests are never removed; product-bug failures are skipped with the SpiraTest ID.
- Retries: 0 in the gate, 1 in regular CI (flagged flaky). Self-heals logged in CI, fail the gate.
- Ladder: isolated rerun -> rule classifier -> self-heal -> crawler diagnose -> Claude. Verdicts: flaky, automation, product, environment.

## 10. Known risks and limitations
| Risk | Mitigation | Status |
|---|---|---|
| CI runners: at recon every run since 17:54 was `queued` and `workflow_dispatch` returned 403 (BASELINE); runs executed later | Local gate worktree as backup; `stability-gate.yml` (D2) | Latest CI Stability Gate run [41877426539](https://github.com/kaylamenashe8/stonewake-final-repo/actions/runs/41877426539) completed: failure (4/5 jobs failed, 1 not concluded) |
| Shared production workspace, no data reset (J4) | Read-only by default; RUN_ID data + teardown; no exact counts | Applied in every merged test |
| ToS 4(j) limits automated UI access | Competition workspace is the agreed target; API/MCP used where possible | Open question to judges (BASELINE) |
| API key in traces (`Authorization` header) | REQUEST to the Architect: `trace: 'off'` for the `api` project (CHANGELOG) | Requested, not applied: README Next steps item 3 |
| GitHub Pages not configured until 20:15 | PR #46 publishes Pages from master | Closed: [report history](https://kaylamenashe8.github.io/stonewake-final-repo/) |
| Most P1 UI flows not automated (5 of 15 P1 items not started at 20:20) | Ranked plan; baseline suite stabilized first | Disclosed in TEST_PLAN.md; README [Next steps](../README.md#next-steps-planned-not-done-by-the-2020-freeze) |
| Triage job skipped on failed PR runs (fork guard in ci.yml); runs on master failures only | Guard fix drafted (same-repo check, keeps forks out); needs one forced-failure PR run to prove | Open, after freeze: README Next steps item 1 |

## 11. Schedule as executed
| Planned | Actual | Phase | Notes |
|---|---|---|---|
| 18:00-18:20 | 18:06-18:20 | Recon | BASELINE measured on `b4f92c9`; plan T01-T27 (PR #29) |
| 18:20-19:50 | 18:20-19:50 | Parallel lanes | Merged: #31 T01, #32 API migration, #35 env/lint, #36 API T16-T21, #37/#44 UI migration, #38 pre-PR gate; judge updates D17/D18 added T28-T34 (#30) |
| 19:50-20:20 | 19:50-20:20 | Integrate | Merged #41 T02, #42 T03, #45 SPIRA-89, #46 CI Pages + API key, #47 triage, #48 T10, #49 T15, #50 Spira env, #51 SPIRA-89 test, #52 T08 |
| 20:20-20:40 | | Freeze + final gate | |
| 20:40-20:55 | | Wrap-up | |
