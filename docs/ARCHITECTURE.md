# Architecture

The given repo converges in place on this layout (no rewrite from scratch, so `baseline..main` stays readable).

```
.
├── .claude/
│   ├── agents/              # subagent definitions (Agent roster)
│   ├── commands/            # /recon /stabilize /gate /triage /scribe /review
│   └── settings.json        # hooks: prompt logger -> docs/AI_LOG.md, agent status
├── .github/workflows/
│   ├── ci.yml               # push/PR: lint, typecheck, test (sharded), report, Slack
│   ├── stability-gate.yml   # manual: 5 runs, mode = parallel | sequential
│   └── triage.yml           # on CI failure: diagnosis ladder + Claude
├── src/
│   ├── config/env.ts        # zod-validated env (BASE_URL, creds, RUN_ID)
│   ├── fixtures/            # test.extend: pages, auth, data, healer, api
│   ├── pages/               # BasePage + one class per page (ElementSpec locators)
│   ├── components/          # header, modal, table, toast: reused UI parts
│   ├── data/                # factories (faker, seeded by RUN_ID), static test data
│   ├── api/                 # typed API client + zod schemas
│   └── utils/               # healing locator, heal reporter, logger, annotations, a11y, visual
├── tests/
│   ├── auth.setup.ts        # storageState
│   ├── e2e/<feature>/       # @smoke @regression
│   ├── visual/              # @visual
│   ├── a11y/                # @a11y (axe-core)
│   ├── api/                 # @api
│   └── generated/           # crawler candidates, excluded from CI until promoted
├── triage/                  # classifier.ts, crawler-diagnose.ts, claude-diagnose.ts
├── crawler/                 # site-map crawler + generator pipeline
├── control-center/          # Kayla's local dashboard (http://localhost:4000)
├── docs/                    # STP, BASELINE, ARCHITECTURE, BUGS, FIXES, CHANGELOG, DECISIONS, AI_LOG
├── Dockerfile  docker-compose.yml
├── playwright.config.ts
└── README.md
```

## Layers
- **Config (`src/config/env.ts`).** One zod schema validates every env var at startup; a bad value fails fast with a list of issues. RUN_ID is fixed per run so all workers share it.
- **Fixtures (`src/fixtures`).** Tests import `test`/`expect` from here only. Fixtures give page objects, `data` (DataFactory), `healer`, `api` (typed client) and an auto `pageErrors` collector that attaches console/page errors to the report.
- **Pages and components.** Page objects extend `BasePage`, expose intent (`cart.addItem(name)`) and return locators or state; assertions live in tests. Each element is declared once as an `ElementSpec`: a primary locator plus ordered alternates (role -> label -> testid -> text -> scoped CSS).
- **Data (`src/data/factory.ts`).** Every value carries the RUN_ID + worker prefix, and faker is seeded from it, so 5 parallel gate jobs never collide and a failing run's data can be reproduced.
- **API (`src/api`).** `ApiClient` on Playwright's `request` validates responses with zod and logs response time as an annotation (warning, never a failure).
- **Tests.** One Playwright project per layer: `setup` (storageState), `chromium`, `api` (no browser), `mobile` (Pixel 7, `@mobile`). `tests/generated/` is ignored until a reviewed promotion PR moves a spec into `tests/e2e/`.

## Self-healing locator (D5)
`Healer.locate(spec)`: primary must resolve uniquely within 3 s; else alternates in order; else fuzzy accessible-name match (similarity >= 0.8). Exactly one visible match -> used, test annotated `healed`, written to `test-results/heal-report.json` by the heal reporter. Zero or several -> the original error. `HEAL_MODE=log` in CI, `strict` in the gate (a heal fails the test), `off` to disable. Every heal becomes a committed locator fix before the final gate.

## Triage ladder (D4)
In-run: auto-wait + web-first assertions, then self-heal. Post-run (`triage.yml`): isolated rerun x3 -> rule classifier -> crawler diagnose (<= 3 failures, 3 min each) -> Claude (last resort, strict JSON). Output: `triage/out/verdicts.json`, job summary, Slack, `ai-fix/*` PRs only for automation verdicts with confidence >= 0.8. Claude never pushes to main (D6).

## CI and the Stability Gate (D2, D3, D11)
All jobs run in the pinned Playwright image (tag == `@playwright/test` version, checked by `scripts/version-check.sh`). `ci.yml`: retries 1, 4 shards, blob reports merged, published to GitHub Pages (`runs/<id>/`, `latest/`, history index of the last 30). `stability-gate.yml`: 5 full-suite runs, retries 0, `HEAL_MODE=strict`, parallel matrix (default, final evidence) or sequential chain (backup); only gate-summary publishes, once.

## Agents
See `.claude/agents/` and CLAUDE.md: one worktree and branch per agent, owned paths, fixed merge order, Lead merges. Status per agent in `.agents/status/<agent>.json`, shown by the Control Center.
