# Software Test Plan (STP)

> Owner: Scribe. Sources: BASELINE.md, TEST_PLAN.md, FIXES.md, BUGS.md, gate runs. Every number links to its source.

## 1. Scope
| In scope | Out of scope |
|---|---|
| <!-- FILL: P1 flows, auth, API endpoints behind P1, a11y/visual on key pages --> | Cross-browser beyond Chromium (Firefox/WebKit only if time remains); real payments; load testing |

## 2. Product profile (from Recon)
| Question | Answer | Plan impact |
|---|---|---|
| Product type | <!-- FILL --> | |
| Authentication | | |
| Test accounts | | |
| Data reset | | |
| Public API / XHR | | |
| Bot protection / rate limits | | |
| Site stability (10 health requests) | | |
| Test IDs in DOM | | |
| Dynamic content | | |

## 3. Risk analysis
| ID | Area / flow | Business impact (1-5) | Likelihood (1-5) | Risk | Priority | Covered by |
|---|---|---|---|---|---|---|
| R1 | <!-- FILL --> | | | | P1 | |

## 4. Test levels and types
| Level / type | Tool | Tag | Project | Runs in |
|---|---|---|---|---|
| E2E UI | Playwright | @smoke @regression | chromium | ci.yml, gate |
| API | Playwright request + zod | @api | api | ci.yml, gate |
| Accessibility | @axe-core/playwright (critical + serious) | @a11y | chromium | ci.yml, gate |
| Visual | toHaveScreenshot, Docker baselines | @visual | chromium | ci.yml (gate if stable) |
| Responsive | Pixel 7 | @mobile | mobile | ci.yml |

## 5. Environments and data strategy
- Environment: <!-- FILL: URL, browser + version, Playwright image tag -->
- Every CI job runs in `mcr.microsoft.com/playwright:v<version>-noble` (D11).
- Data: DataFactory with RUN_ID prefix (`<run_id>-<n>-w<worker>`), cleanup in fixture teardown, read-only checks on shared data.
- Accounts: <!-- FILL: shared / per-worker users -->

## 6. Entry and exit criteria
| Entry | Exit |
|---|---|
| BASELINE committed, CI runs on main, secrets set | Stability Gate 5/5 green, retries 0, 0 heals, every product failure filed in SpiraTest and skipped with its ID, lint 0 errors |

## 7. Traceability matrix
| Requirement | Description | Risk | Test files | Status | Known bugs |
|---|---|---|---|---|---|
| REQ-AUTH-01 | <!-- FILL --> | | | | |

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
| <!-- FILL --> | | |

## 11. Schedule as executed
| Planned | Actual | Phase | Notes |
|---|---|---|---|
| 18:00-18:20 | | Recon | |
| 18:20-19:50 | | Parallel lanes | |
| 19:50-20:20 | | Integrate | |
| 20:20-20:40 | | Freeze + final gate | |
| 20:40-20:55 | | Wrap-up | |
