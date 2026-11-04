# Stonewake Test Automation

This is the test automation project for **Stonewake**, our product. It contains API and UI tests written with [Playwright](https://playwright.dev).

- **App:** https://app.stonewake.ai
- **API:** https://api.stonewake.ai
- **Documentation:** https://docs.stonewake.ai (quickstart, API reference and OpenAPI spec)

## ITAC 2026 Finals submission (Finalist 4)

> Built with a tooling kit (agents, hooks, CI workflows, triage) that was **prepared before the competition** and is
> disclosed here (D12 in [DECISIONS.md](docs/DECISIONS.md)). Starting point: tag `baseline` = commit `b4f92c9`.

### Before -> after
| Metric | Before (`b4f92c9`, [BASELINE.md](docs/BASELINE.md)) | After |
|---|---|---|
| Tests | 20 (10 UI, 10 API) | The 20 baseline tests (moved, none removed) + plan items T01, T02, T03, T08, T10, T15, T16, T17, T18, T19, T20, T21 ([TEST_PLAN.md](docs/TEST_PLAN.md)); 87 tests in the gate |
| Passing, 5 runs, retries 0 | 10/20 pass 5/5; 10 fail 0/5; 0 flaky | **87/87 pass 5/5; 0 failed; 0 flaky; 0 heals** (final gate) |
| Lint | 177 errors, 54 warnings | 0 errors, `--max-warnings=0` (D16, enforced by `npm run pre-pr` on every PR) |
| Hard waits | 3 `waitForTimeout` | 0 (F5, F18) |
| XPath selectors | 18 | 0 (F6, F19) |
| Hardcoded absolute URLs | 67 | 0, `baseURL` / `API_URL` from env (F7, F20, FA7) |
| Secrets in code | 3 literals + committed `.env` | 0 (F1, F2, FA6) |
| Automation faults fixed | n/a | 32, by category in [FIXES.md](docs/FIXES.md) |
| Suite time | ~33 s per pass (166.6 s for 100 runs, 4 workers) | ~43 s per gate run for 87 tests (run-1: 42.5 s) |

### Stability Gate
- Rules: 5 independent full-suite runs of one commit, retries 0, `HEAL_MODE=strict` (any self-heal fails the run) (D2, D3, D5).
- **Final gate: [41886884031](https://github.com/kaylamenashe8/stonewake-final-repo/actions/runs/41886884031), 5/5 green** on `0278066` (master at code freeze, with T19): 87 passed per run, 0 failed, 0 flaky, retries 0, 0 heals.
- Earlier gate: [41877426539](https://github.com/kaylamenashe8/stonewake-final-repo/actions/runs/41877426539) (19:25) failed 5/5 on the 5 legacy API tests, before the API migration (#32) and the key in CI (#46) were merged.
- The plan this was built from: [PRD.md](docs/PRD.md).
- HTML report: [latest run](https://kaylamenashe8.github.io/stonewake-final-repo/latest/) · history of every run and gate: [Pages index](https://kaylamenashe8.github.io/stonewake-final-repo/) (GitHub Pages, published by ci.yml).

### Slack notifications
- CI (`ci.yml`) and the triage ladder (`triage.yml`) post each run's result and the triage verdicts to a Slack channel through an Incoming Webhook (D10).
- Judges who want to see the channel: email Kayla at [kaylamenashe@gmail.com](mailto:kaylamenashe@gmail.com) and she will add you to the Slack workspace.

### Known product bugs
Recorded in [BUGS.md](docs/BUGS.md) (system of record: SpiraTest, D10).

| Spira | Bug | Severity | Test |
|---|---|---|---|
| [SPIRA-89](https://itac.spiraservice.net/33/Incident/89.aspx) | MCP: tool call without credential answers HTTP 401, docs say HTTP 200 for -32001 | low | tests/api/mcp.entity.spec.ts (`knownBug('SPIRA-89')` test, PR #51) |

None of the 10 baseline failures was a product bug: all were automation faults ([FIXES.md](docs/FIXES.md)).

### Next steps (planned, not done by the 20:20 freeze)
Ordered by value. Item status is in [TEST_PLAN.md](docs/TEST_PLAN.md).

1. **Triage on pull requests.** Today the `triage` job in `ci.yml` runs on failed master pushes but is skipped on failed PR runs.
   The suspected cause is the fork guard `github.event.pull_request.head.repo.fork != true`. The fix is ready but not applied:
   `if: ${{ failure() && needs.test.result == 'failure' && (github.event_name != 'pull_request' || github.event.pull_request.head.repo.full_name == github.repository) }}`.
   This still keeps fork PRs away from secrets. It was skipped because it is a CI change after the freeze and can only be proven
   by a PR run with a failing test. To finish: merge the guard, open one PR with a forced failure, check the verdict in the job
   summary, in Slack and in the `triage-verdicts` artifact, then drop the failure (about 25-45 min).
2. **Claude step of the triage ladder.** It is skipped because no `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` secret is set.
   Add one.
3. **API key in traces.** The `Authorization` header can land in `retain-on-failure` traces. Set `trace: 'off'` for the `api` project
   (requested, not applied).
4. **Remaining P1 items:** T05 and T06 (Screenings), T13 (Monitoring add/remove, deferred because its remove step is a destructive
   click that was not approved), T30 and T31 (Monitoring Sentiment). Also the PDF half of T03, parked on HTTP 429 in `tests/generated/`.
5. **P2 items:** T04, T07, T09, T11, T12, T14, T22, T23, plus the security items T32, T33 and T34.
6. **P3 items:** T24, T25, T28, T29, plus T26 (axe) and T27 (visual), which extend the kit's home-page checks to the key pages.
   Visual baselines must be generated in Docker.
7. **Plan hygiene:** create GitHub issues for T28-T34 (`npm run plan:issues`).
8. **Wider checks:** a reversed-order run of the suite to prove test independence (not done in [BASELINE.md](docs/BASELINE.md)),
   and Firefox and WebKit projects (Chromium only today).

### Documents
- [Software Test Plan (STP)](docs/STP.md): scope, risks, traceability, entry/exit criteria
- [Test plan export](docs/TEST_PLAN.md): items T01-T34, status, files, PRs
- [Baseline](docs/BASELINE.md) · [Fixes](docs/FIXES.md) · [Bugs](docs/BUGS.md) · [Decisions](docs/DECISIONS.md)
- [Architecture](docs/ARCHITECTURE.md) · [API map](docs/API_MAP.md) · [Review checklist](docs/REVIEW_CHECKLIST.md)
- AI use: [AI_LOG.md](docs/AI_LOG.md) · every prompt: [PROMPTS.md](docs/PROMPTS.md)

### Run it
```bash
npm ci && npx playwright install chromium
cp .env.example .env   # fill BASE_URL, API_URL, TEST_USER, TEST_PASSWORD, STONEWAKE_API_KEY
npm run verify         # lint + typecheck + @smoke
npm run test:gate      # retries 0, HEAL_MODE=strict
```

## Getting started

### Fork this repository

Don't work in this repository directly. First, **fork** it to your own GitHub account and do all your work in your fork.

Not sure what a fork is? Read GitHub's guides:
- [About forks](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/about-forks)
- [Fork a repository](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/working-with-forks/fork-a-repo)
