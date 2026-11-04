> The plan this repo was built from: the PRD / tech spec written before the finals (Nov 3, 2026), exported from
> its Claude Doc. The kit it describes was prepared in advance and is disclosed in the README (D12).

# ITAC 2026 Finals — Agent-Driven Automation PRD

Nov 3, 2026 · @Kayla

## Setup reminders (do before Wednesday 17:25)

Final is Wednesday 4.11 at 18:00. Everything below must be green before you leave home. The first item is due today (Tuesday 3.11).

**Status, Tue 3.11 evening:** Node 26.13 LTS is the default, the VS Code extensions are installed and `code` now opens VS Code (`cursor` opens Cursor), Docker is running with `playwright:v1.64.1-noble` pulled, the kit's browsers are installed, and the Playwright test agents are added to the kit (not committed yet). No MDM or proxy. Jam CLI 1.34 is logged in to the personal workspace and can record; the Jam MCP needs a one-time browser login. Slack webhook for `#itac-runs` is in the kit's `.env` and a test message posted. Claude is removed from CI (D7), so no Anthropic key or token is needed. **Still open:** on Wednesday the GitHub repo, its settings and secrets, the Claude GitHub app and the dry run. GitHub note: `GITHUB_TOKEN` in `~/.zshrc` forces `gh` onto the Nanit account, so run personal `gh` commands as `GITHUB_TOKEN= gh …`.

**Accounts and access**

- [x] SpiraTest login works with the preliminary-stage details. If not, email ITAC today (deadline 3.11).
- [x] Jam.dev account active, Chrome extension installed, test recording made and shared via a public link.
- [ ] Personal GitHub (not Nanit) logged in: `gh auth status` shows the personal account, SSH key added, `git config --global user.name/user.email` set to personal identity.
- [x] Laptop check: if it is a Nanit-managed laptop, confirm no MDM, proxy or SSO blocks personal GitHub, Docker Hub, npm or the Anthropic API. Otherwise use a personal laptop.
- [x] Slack: create a workspace `itac-2026-kayla`, channel `#itac-runs`, an Incoming Webhook app pointed at it. Save the webhook URL.
- [x] Claude for CI: not needed. Claude was removed from CI (D7, decided 3.11), so there is no Anthropic API key or `claude setup-token` to set up.

**Local tooling**

- [x] Node.js current LTS (`nvm install --lts && nvm alias default lts/*`), `node -v` and `npm -v` work.
- [x] Git working, `gh` CLI installed and authenticated.
- [x] Install VS Code: `brew install --cask visual-studio-code` (or download from code.visualstudio.com), then run "Shell Command: Install 'code' command in PATH" from the command palette.
- [x] VS Code with extensions: Playwright Test for VS Code, ESLint, Prettier, GitHub Actions, Error Lens, Docker. One line: code --install-extension ms-playwright.playwright dbaeumer.vscode-eslint esbenp.prettier-vscode github.vscode-github-actions usernamehw.errorlens ms-azuretools.vscode-docker
- [x] Playwright and browsers pre-installed: `npm init playwright@latest` in a scratch folder, then `npx playwright install --with-deps`.
- [x] Docker Desktop installed, running, and `mcr.microsoft.com/playwright:<version>-noble` pulled in advance (venue Wi-Fi may be slow).
- [x] Claude Code installed and logged in (`claude` starts, `/status` shows the account).
- [ ] Claude Code add-ons: Playwright MCP (`claude mcp add playwright -- npx @playwright/mcp@latest`), Playwright test agents (`npx playwright init-agents --loop=claude` inside the kit repo), GitHub MCP or `gh` access, Claude GitHub app installed on the personal account (`/install-github-app`).
- [x] Screen recorder for the summary video (OBS, Loom or phone) tested with mic.

**GitHub repo settings (verify on the dry-run repo, repeat on the day)**

- [ ] Repo is public.
- [ ] Settings > Actions > General: workflow permissions = Read and write; allow Actions to create PRs.
- [ ] Settings > Pages: source = `gh-pages` branch, root.
- [ ] Secrets set with the kit script `scripts/setup-secrets.sh`: `SLACK_WEBHOOK_URL`, plus product credentials if given (`TEST_USER`, `TEST_PASSWORD`). Variable `BASE_URL`. No Anthropic secret (D7).

**Dry run (must pass end to end)**

- [ ] Kit applied to a dummy site (e.g. a public demo shop): push, CI green, report on GitHub Pages, Slack message received, triage job posts a verdict on a forced failure.
- [ ] All three links (repo, Actions run, Pages report) open in an incognito window.
- [ ] Stability gate: parallel mode and sequential mode both run 5/5 green.

**Bring**

- [ ] Laptop, charger, power strip, phone hotspot as Wi-Fi backup, headphones, printed copy of the timeline (section 7).

## Goal and success criteria

In 180 minutes, turn an unknown, flaky Playwright/TypeScript project into a stable, well-structured, well-reported suite, proven by 5 green runs, with every decision documented. The plan runs agent lanes in parallel. Kayla acts as lead and reviewer: she makes the judgment calls and does not write boilerplate.

| Judging criterion | What "excellent" looks like | Evidence the judges see |
| --- | --- | --- |
| Test stability | 5/5 green with retries = 0, zero self-heals in the final runs | Stability Gate run link, flakiness matrix before and after |
| Automation infrastructure | Layered POM + fixtures + typed config + data factories + Docker | Repo tree, `docs/ARCHITECTURE.md` |
| Code quality and readability | Strict TS, ESLint with the Playwright plugin, zero lint errors, no hard waits | CI lint job green, before/after lint counts |
| Maintainability | One locator per element, in one place; tags; clear naming; tests independent of each other | Tests run with `--shard` and in random order |
| Planning and documentation | STP, baseline, changelog, decision log, AI log | `docs/` folder linked from README |
| Quality of reporting | Public HTML report per run, history index, job summary, Slack | Pages link, Actions summary |
| Product faults | Real bugs in SpiraTest with Jam recordings, linked from known-failure tests | SpiraTest IDs in `docs/BUGS.md` and test annotations |
| Bonus | Docker, visual, Slack, self-healing, Claude triage, judge questions | Each item has a README section |

**Non-goals**

- Cross-browser coverage is not the goal. Chromium is the gate; Firefox and WebKit run only if time remains.
- Do not maximize test count. Add tests by risk, as many as stay stable. Organizers confirmed: a test joins the suite only after passing 10/10, and a flaky test is not added.
- No AI-generated code merges without Kayla's review. Kayla reviews only after the agent has run 2-3 self code reviews and passed its own e2e run.

## Key decisions

These are the team-lead calls. Each is final unless a judge's answer on the day overrides it.

| # | Decision | Rationale |
| --- | --- | --- |
| D1 | Fork or import the given project into a public personal repo and keep its full history. Tag the starting commit `baseline`. | The diff `baseline..main` is the before/after proof. |
| D2 | The Stability Gate has two modes. **Parallel:** one workflow run with 5 matrix jobs running at the same time, each a full suite run. This is the final evidence. **Sequential:** 5 chained jobs, kept as a backup only if judges require runs consecutive in time. | The brief says "consecutive". Parallel proves 5 independent green runs of the same commit in about 6 minutes. Sequential stays ready in case a judge reads "consecutive" as one after another. |
| D3 | Retries are 0 in the gate and 1 in regular CI, and the report flags "flaky" there. | Retries hide flakiness. A gate with retries proves nothing. |
| D4 | When a test fails, diagnosis climbs a fixed ladder: isolated rerun, then rule classifier, then self-heal, then crawler, then Claude. Each rung runs only if the one below gave no answer. | Cheap and deterministic first; slow and costly last. This matches Kayla's direction. |
| D5 | Self-healing runs in regular CI and logs every heal. Any heal must become a committed locator fix before the final gate. Final evidence has 0 heals. | Healing that silently turns red into green looks like masking to judges. |
| D6 | Claude in CI only diagnoses and proposes. Its output goes to the job summary, a PR comment, or an `ai-fix/*` PR. It never pushes to `main`. | The brief stresses engineering judgment. A human merges. |
| D7 | No Claude in CI. CI triage stops at rung 3 (rerun, classifier, crawler); anything still undecided is marked tentative and diagnosed locally by the Triage agent from the `triage-verdicts` artifact. No Anthropic key or token is needed in GitHub. | The subscription token shares quota with Kayla's interactive Claude Code session. CI bursts during the 3 hours must not throttle her main tool. |
| D8 | The crawler test generator runs locally, out of band, in parallel with the other agents from 18:20 to 20:00: it adds tests and checks their stability while they fix the existing code. It never runs in the gate. Generated tests sit in `tests/generated/` until promoted. | Generation is noisy and slow. The gate must contain reviewed tests only. |
| D9 | A test that fails on a confirmed product bug is skipped: `test.skip` with the SpiraTest ID in its reason, plus a `bug` annotation. A flaky automation test (below 10/10) is not added at all. | Confirmed by the organizers. The report shows each skip with its Spira link, so the gate stays honest. |
| D10 | Bug tracking is SpiraTest (required). Notifications go to Slack through an Incoming Webhook. No personal Jira. | Spira is mandatory. A second tracker duplicates work. A webhook is one secret and has the fewest failure points. A bot token adds threads and files, which we do not need. |
| D11 | Every CI job runs inside the pinned Playwright Docker image, and visual baselines are generated in the same image. | Same environment locally and in CI. Screenshots made on macOS never match Linux CI. |
| D12 | The kit is built in advance and disclosed in the README as prepared before the competition. | Transparency is required. Bringing tooling is preparation, not an unfair advantage. |
| D13 | Every agent works in its own git worktree and branch and owns specific directories. Merge order is fixed (see the Agent roster). | Parallel agents on one tree create conflicts and lost work. |

## Recon: classify the unknown product and repo

The first 20 minutes produce `docs/BASELINE.md`, the single source every other agent reads. The Recon agent fills the matrix below; each answer switches parts of the plan on or off.

**Product profile**

| Question | Options | Plan impact |
| --- | --- | --- |
| Product type | E-commerce, SaaS dashboard, form or booking flow, content or CMS, social, banking demo | Picks the coverage template (see Coverage strategy) |
| Authentication | None, form login, SSO or OAuth, MFA, captcha | Login works: `storageState` setup project. Captcha or MFA: ask judges for a bypass or test account. |
| Test accounts | One shared, several, self-registration | One shared: tests must not mutate shared state, and the parallel gate needs per-run data. Self-registration: a factory creates a user per test. |
| Data reset | API, UI only, none | API: seed and clean up through `request`. None: unique data per run (`runId` prefix) and read-only checks where possible. |
| Public API or XHR backend | Yes, no | Yes: API seeding, `waitForResponse`, contract checks, network mocking for error states |
| Bot protection or rate limits | Cloudflare challenge, 429s, none | Present: lower workers, reduce parallel gate to 2-3 jobs, raise with judges |
| Stability of the site itself | Measured by 10 quick health requests | Unstable: flag it in the STP and use `expect.poll` on readiness |
| Test IDs in the DOM | `data-testid` present, partial, none | None: role + accessible name locators are the default |
| Dynamic content | Ads, carousels, timestamps, randomness | Mask these in visual tests; avoid asserting on them |

**Repo health audit**

| Check | Tool or method |
| --- | --- |
| Playwright version, deprecated APIs (`page.$`, `elementHandle`, `waitForSelector` misuse, `waitForTimeout`) | `npm outdated`, grep, ESLint Playwright plugin |
| TypeScript strictness, missing `await` | `tsc --noEmit --strict`, `@typescript-eslint/no-floating-promises` |
| Selector quality | Count XPath, nth-child, long CSS chains, text with regex |
| Test independence | Run with `--workers=4 --fully-parallel`, then in reverse order |
| Flakiness | `--repeat-each=5 --retries=0`, then a pass-rate table per test |
| CI state | Does a workflow exist? Does it run? Does it publish anything? |
| Secrets in code | grep for passwords and tokens, move them to env |

**BASELINE.md output**

- Product profile table, filled.
- Test inventory: file, test, tag, pass rate over 5, failure signature.
- Counts: tests, passing, failing, flaky, lint errors, hard waits, brittle selectors.
- Top 10 issues ranked by impact on stability.
- Link to the first CI run on the untouched code (the "before" evidence).

**Automation test plan (Recon output, editable, checked off automatically)**

Recon also produces a ranked automation test plan from the product profile, the crawler site map and the coverage templates. It lives on GitHub, where Kayla can edit it from phone or laptop, agents can update it, and judges can see it.

1. **Items.** `scripts/plan-to-issues.ts` creates one GitHub issue per planned test or group (title, layer `ui`/`api`/`auth`/`visual`, risk, acceptance = passes 10/10), labelled `P1`, `P2` or `P3`.
2. **Ranked list.** A pinned issue, "Automation Test Plan", holds a task list of those issues in suggested order. Kayla reorders lines or changes labels to re-rank; that is the only edit needed.
3. **Pick-up rule.** The two Coverage agents always take the highest unchecked item and open a draft PR whose description says `Closes #<n>`.
4. **Check-off.** When the PR merges (after self-reviews, the 10/10 run and Kayla's review), GitHub closes the issue and ticks its line in the pinned list. No one ticks boxes by hand.
5. **Skipped or dropped.** A product-bug item is closed with label `skipped-bug` and the Spira ID; a flaky item that cannot reach 10/10 is closed as `not-added`.
6. **Report.** At 20:10 the Scribe exports the list into `docs/TEST_PLAN.md` (item, priority, status, test file, PR) and links it from the STP traceability matrix.

A public GitHub Project board over the same issues gives a drag-and-drop view if preferred; it is optional.

## Target architecture and coding standards

Whatever shape the given repo has, it converges on this layout. The Architect agent migrates in place and does not rewrite from scratch, so history stays readable.

```
.
├── .claude/
│   ├── agents/              # subagent definitions (Agent roster)
│   ├── commands/            # /recon /stabilize /gate /triage /scribe
│   └── settings.json        # hooks: prompt logger → docs/AI_LOG.md
├── .github/workflows/
│   ├── ci.yml               # push/PR: lint, typecheck, test (sharded), report, Slack
│   ├── stability-gate.yml   # manual: 5 runs, mode = parallel | sequential
│   └── triage.yml           # on CI failure: diagnosis ladder + Claude
├── src/
│   ├── config/env.ts        # zod-validated env (BASE_URL, creds, RUN_ID)
│   ├── fixtures/            # test.extend: pages, auth, data, healer, apiClient
│   ├── pages/               # BasePage + one class per page
│   ├── components/          # header, modal, table, toast: reused UI parts
│   ├── data/                # factories (faker, seeded by RUN_ID), static test data
│   ├── api/                 # API client for seeding and cleanup (if the product has one)
│   └── utils/               # healing locator, logger, waits, annotations
├── tests/
│   ├── auth.setup.ts        # storageState
│   ├── e2e/<feature>/       # @smoke @regression
│   ├── visual/              # @visual
│   ├── a11y/                # @a11y (axe-core)
│   ├── api/                 # @api
│   └── generated/           # crawler candidates, excluded from CI until promoted
├── triage/                  # classifier.ts, crawler-diagnose.ts, claude-diagnose.ts
├── crawler/                 # site-map crawler + generator pipeline
├── docs/                    # STP, BASELINE, ARCHITECTURE, BUGS, CHANGELOG, DECISIONS, AI_LOG
├── Dockerfile  docker-compose.yml
├── playwright.config.ts
└── README.md
```

**Coding standards (enforced by lint and CI, not by memory)**

- Locators: `getByRole` with name, then `getByLabel`, then `getByTestId`, then `getByText`. CSS only when scoped inside a component. No XPath, no `nth()` without a comment.
- Waiting: web-first assertions (`await expect(locator).toBeVisible()`), `waitForResponse` for network-bound actions, `expect.poll` for eventual state. `waitForTimeout` is banned by lint.
- Page objects expose intent (`cart.addItem(name)`), not clicks. Assertions live in tests; page objects only return locators or state.
- Each test sets up its own state (fixture or API) and never depends on another test's order or leftovers.
- Test data comes from factories with a `RUN_ID` prefix, so 5 parallel gate jobs never collide.
- Naming: `feature.action.spec.ts`; test titles say "should \<behaviour> when \<condition>".
- Tags: `@smoke` (under 2 minutes, runs on every push), `@regression`, `@visual`, `@a11y`, `@api`, `@known-bug`.
- Config: `fullyParallel: true`, `forbidOnly` in CI, trace `retain-on-failure`, screenshot and video `retain-on-failure`, fixed `locale`, `timezoneId` and viewport, `testIdAttribute` set to whatever the product uses.
- Reporters: `list` locally; `blob` + `html` + `json` + `github` in CI.
- Tooling: strict `tsconfig`, `typescript-eslint` strict, `eslint-plugin-playwright` (recommended + `no-wait-for-timeout`, `no-force-option`, `prefer-web-first-assertions`, `no-conditional-in-test`), `@typescript-eslint/no-floating-promises`, Prettier. CI runs `lint`, `typecheck`, then tests.

## Agent roster

There are 11 subagents (including the API agent described under API testing) plus the Lead session, Kayla's main Claude Code window, which runs in the background as orchestrator. Kayla works from the Control Center dashboard (below), not from terminals.

&#32;Each subagent has its own `.claude/agents/<name>.md` with mission, owned paths, inputs, outputs, done criteria and "must not" rules. Every agent writes a short entry to `docs/CHANGELOG.md` and stops at its done criteria. It does not wander.

| Agent | Mission | Owns (write access) | Reads | Output | Done when |
| --- | --- | --- | --- | --- | --- |
| Lead (Kayla + main session) | Orchestrate, review, merge, judge questions | `main` branch, merges | Everything | Merge decisions, `docs/DECISIONS.md` | 21:00 |
| Recon | Audit repo and product, measure flakiness | `docs/BASELINE.md` | Repo, product | Baseline, top-10 issues, ranked test plan, first CI run | Baseline committed and tagged |
| Architect | Install the target structure: config, fixtures, BasePage, lint, tsconfig | `src/config`, `src/fixtures`, `src/utils`, root configs | Baseline | Skeleton that compiles, lint rules on (warn first, then error) | `tsc` and lint run green on the skeleton |
| Stabilizer | Fix root causes of flakiness in existing tests and move them onto the new structure | `tests/e2e` (existing), `src/pages`, `src/components` | Baseline, skeleton | Each fix tagged with its cause category | Every existing test passes 10/10 locally, is skipped with a Spira ID (product bug). Existing tests are never removed |
| CI/Infra | Workflows, Docker, Pages history, Slack, stability gate | `.github/`, `Dockerfile`, `docker-compose.yml`, `scripts/` | Skeleton | All 3 workflows running | CI green on `main`, report live on Pages |
| Coverage | Add risk-based tests for critical flows not yet covered | `tests/e2e/<new features>`, `tests/a``11y` | Baseline, coverage plan | New specs with tags | Each new test 10/10 locally |
| Crawler-Generator | Crawl the site, propose UI and API tests, run the promotion filter; on request, crawl the flow of a failing existing test, find where it breaks and hand the Stabilizer a fix proposal | `crawler/`, `tests/generated/` | Product | Site map, promotion report | Out of band, continuous until 20:00 |
| Triage | Build and run the diagnosis ladder | `triage/`, healer in `src/utils/healing.ts` | CI failures | Verdict JSON per failure | The ladder runs in CI on a forced failure |
| Bug Reporter | Reproduce product faults, draft SpiraTest bugs, attach Jam | `docs/BUGS.md` | Triage verdicts, exploratory runs | Draft bugs for Kayla to file in Spira | Every product-classified failure has a Spira ID |
| Scribe | STP, README, ARCHITECTURE, AI log tidy-up, video script | `docs/` (except BASELINE and BUGS), `README.md` | All CHANGELOG entries | Submission-ready docs | All docs final by 20:40 |
| Visual/Bonus | Visual tests on 3-5 stable pages, axe checks | `tests/visual`, `tests/a11y`, snapshots | Skeleton | Baselines generated in Docker | Visual suite stable 5/5 |

**API agent** (added after the table): owns `src/api`, `tests/api` and `docs/API_MAP.md`; reads the provided API documentation; outputs API specs by endpoint; done when every endpoint behind a P1 flow has happy-path, auth and validation tests passing 10/10, then continues by priority until the 20:00 cutoff.

**Large broken suite (the expected case)**

- Recon groups failures by signature (error type + locator or helper + page) into clusters, ranked by how many tests each affects.
- The Stabilizer fixes clusters, not tests: one shared helper or page-object fix often clears dozens of tests at once.
- Up to 3 Stabilizer instances run in parallel, each owning a disjoint set of spec folders.
- Existing tests are never removed. Fixing them is the top priority and comes before any new test; only a confirmed product bug allows a skip with its Spira ID. The pass-10/10-or-drop rule applies to new tests only.
- If the full suite takes over about 5 minutes, CI and gate runs shard as described under CI/CD.

**Conflict rules**

- One worktree per agent: `git worktree add ../wt-<agent> -b agent/<agent>`.
- Merge order into `main`: Architect, then Stabilizer, then CI/Infra, then Coverage, then Visual/Bonus, then Triage. Scribe and Bug Reporter touch only `docs/` and merge any time.
- Shared files (`playwright.config.ts`, `package.json`) belong to the Architect. Other agents request changes in their CHANGELOG entry, and the Lead applies them.
- Before merging, an agent rebases on `main` and runs `npm run verify` (lint + typecheck + `@smoke`).
- The Stabilizer starts on in-place fixes (waits, selectors, awaits) in the first 30 minutes while the Architect builds the skeleton, then moves to migrating tests.

**Lead review checklist (60 seconds per merge)**

- The diff touches only owned paths.
- No `waitForTimeout`, `force: true`, `test.only` or skipped tests without a reason.
- The CHANGELOG entry states the cause and the fix.
- `verify` is green.

**Control Center (Kayla's single screen)**

A local web dashboard at `http://localhost:4000`, built into the kit (`control-center/`, P1, Wednesday morning). It runs on Kayla's laptop, not as a claude.ai artifact, because it must reach the agents' local files and GitHub, which a hosted page cannot do. Build gate: a clickable mockup with sample data comes first; Kayla approves or edits it, and only then is the real dashboard built to match.

| Panel | Shows | Actions |
| --- | --- | --- |
| Agents | One card per agent: state (working, blocked, ready for review, done), current task, last update, plan item | Pause, resume, send a note to the agent |
| Review queue | Items ready for review, sorted P1 to P3 and by merge order; each card shows the diff, CHANGELOG cause and fix, self-review notes, the 10/10 result and files touched | Approve and merge, request changes with a comment, open the PR in the browser |
| Test plan | The ranked plan from GitHub with checkboxes and owners | Open the issue to re-rank |
| CI and gate | Latest CI and gate runs, pass/fail, flaky and heal counts, triage verdicts | Open run, open Pages report, start the stability gate |
| Bugs | Spira drafts awaiting approval, filed bugs with IDs | Approve and file (runs `spira-file.ts --submit`), open Jam link |
| Clock | Time to the next phase gate and to 20:55 | None |

**How it works**

- Each agent writes its state to `.agents/status/<agent>.json` through a Claude Code hook (`Stop` and `SubagentStop`) and at each step of its definition.
- PR data comes from `gh pr list` and `gh pr diff`. Approve runs `gh pr review --approve` then `gh pr merge --squash`, and warns when the merge order would be broken.
- Request changes posts a PR comment; the agent's instructions make it read PR comments before resuming.
- Links open in a new browser tab, so any review happens in GitHub's normal UI when the inline diff is not enough.
- Fallback if the dashboard fails on the day: the GitHub PR list with P1/P2/P3 labels and the pinned test plan issue.

## Competition-day timeline

Code freezes at 20:20 and the final gate runs 5 jobs in parallel in one workflow run, done by about 20:30.

&#91;embedded content: competition-day timeline · 12 lanes, 4 milestones\]

Parallel gates at 19:15 and 20:00 give early signal; the final parallel gate at 20:20 is the evidence. Scribe and Bug Reporter are light lanes; at most 6 heavy agents run at once.

| Time | Phase | Kayla does | Agents active | Exit gate |
| --- | --- | --- | --- | --- |
| 17:25-18:00 | 0 Brief | Read materials, fork repo, run `apply-kit.sh` and `setup-secrets.sh`, ask judges | None | Repo public, secrets set, judge answers in DECISIONS |
| 18:00-18:20 | 1 Recon | Watch baseline, confirm Pages and repo are public | Recon | `BASELINE.md` committed, tag `baseline`, first CI run linked |
| 18:20-19:50 | 2 Parallel lanes | Merge every \~15 minutes using the review checklist, file Spira bugs | Architect, Stabilizer, CI/Infra, Triage, Coverage, Crawler, Bug Reporter, Scribe | First parallel gate at 19:15 shows which tests still fail |
| 19:50-20:20 | 3 Integrate | Final merges, fix gate failures, fix the remaining flaky existing tests, drop flaky new ones | Stabilizer, Visual/Bonus, Scribe | Second parallel gate at 20:00 is 5/5 |
| 20:20-20:40 | 4 Freeze + final gate | No code changes. Fill README numbers, rehearse the video script | Scribe, Bug Reporter | Gate 5/5 green |
| 20:40-20:55 | 5 Wrap-up | Record video, incognito link check, submit form | None | Form submitted by 20:55 |

**If the final gate goes red:** fix only the failing test (skip it with a Spira ID only if it is a product bug; drop it only if it is a new test), then rerun. If it is still red at 20:35, submit the latest green gate run as the link and state this plainly in the README.

## CI/CD and the stability gate

Three workflows share one reusable job, `run-suite.yml`. Running 5 at once is possible and is the default while iterating. Sequential mode exists because the brief says "consecutive".

**Workflows**

| Workflow | Trigger | Jobs | Retries | Healing |
| --- | --- | --- | --- | --- |
| `ci.yml` | push, PR, manual | quality (lint, typecheck), then test (4 shards, blob), then merge-report, then publish to Pages, then Slack, then triage if failed | 1 | On, logged |
| `stability-gate.yml` | manual, input `mode` = parallel or sequential | 5 × `run-suite.yml` (full suite each), then gate-summary, then publish, then Slack | 0 | Strict: a heal fails the test |
| `triage.yml` | `workflow_run` on CI failure, or called from ci.yml | Download results, run the diagnosis ladder, post verdicts | n/a | n/a |
| `run-suite.yml` | `workflow_call` (reusable) | Checkout, `npm ci` (cached), test in the Playwright container, upload blob + JSON | input | input |

**Gate mechanics**

- Parallel: `strategy.matrix.run: [1,2,3,4,5]`, `fail-fast: false`. Each job runs the full suite with its own `RUN_ID=${run_id}-${n}`. Wall time is about one suite run.
- Sequential: jobs `run-1` to `run-5`, each `uses: ./.github/workflows/run-suite.yml` with `needs` on the previous job. The chain stops at the first red. Wall time is about 5 suite runs. Backup only.
- Backup evidence: `scripts/gate-5x.sh` triggers `ci.yml` 5 times back to back (`gh workflow run`, then `gh run watch`), giving 5 separate run links if judges want that.
- gate-summary reads the 5 JSON reports and writes a job summary table (run, passed, failed, flaky, healed, duration). It prints `GATE: 5/5 GREEN` or the failing run. That table is what goes in the README and the video.
- Budget: each gate run is the whole suite, not one test. A job costs about 1-1.5 minutes of setup (container start, npm ci) plus the suite, which must finish in under 5 minutes, so the parallel gate completes in about 6 minutes (the sequential backup in under 30). If judges require the sequential mode, the code freeze moves back to 20:10. If it is slower, the Stabilizer and Coverage agents cut or shard.

**Constraints on running 5 in parallel, with mitigations**

| Constraint | Detect | Mitigation |
| --- | --- | --- |
| Shared test account or data collisions (cart, profile, created records) | Recon: data reset = none; gate failures only in parallel mode | `RUN_ID`-prefixed data, one user per worker created in auth setup (test\_user+\<RUN\_ID>-\<workerIndex>@x.com, own storageState each; needs sign-up without email verification), read-only assertions on shared data, `test.describe.configure({ mode: 'serial' })` only for the few mutating flows |
| Product rate limits or bot protection on GitHub runner IPs | 429 or challenge pages in traces | Lower `workers`, run gate with 3 parallel + 2 sequential, raise with judges |
| Pages deploy race | Two publishes at once | Only gate-summary publishes, once, with all 5 reports; `concurrency: gh-pages`, `cancel-in-progress: false` |
| GitHub runner limits | Queued jobs | One workflow run starts all 5 matrix jobs at the same time (the free plan allows 20 concurrent jobs). Each job runs the full suite; parallelism inside a job comes from Playwright workers in the config (fullyParallel), not from sharding. If the suite is large, each run can also shard into up to 4 jobs, using the same matrix with a second dimension (run: 1-5 × shard: 1-4, each job running --shard=\<n>/4, merged back into one report per run) (5 runs × 4 shards = 20 concurrent jobs, the free-plan limit). |
| Product state drift between runs | Later runs fail on leftovers | Cleanup in fixture teardown, plus an API reset step before the gate if one is available |

**Docker**

- CI jobs run with `container: mcr.microsoft.com/playwright:v<pinned>-noble` and `options: --ipc=host`. Browsers are pre-installed, saving about 1 minute per job.
- The `Dockerfile` (same base, `npm ci`, default `npx playwright test`) and `docker-compose.yml` (services `test`, `update-snapshots`, `codegen-report`) give identical local runs.
- The image tag must equal the `@playwright/test` version in `package.json`. A CI check fails the build if they differ.

**Reporting on GitHub Pages**

- Branch `gh-pages` keeps history: `runs/<run_id>/`, `gate/<run_id>/run-1..5/`, `latest/`, plus an `index.html` listing every run (date, branch, commit, pass/fail, link). Keep the last 30.
- Published with `peaceiris/actions-gh-pages` using `keep_files: true` and `destination_dir`.
- Every run also writes a job summary: totals, flaky list, heals, triage verdicts, report link.
- Slack message per run: status, counts, gate verdict, report link, and the top 3 failures with triage classification.

## Failure triage ladder

Every failure gets one verdict: **flaky**, **automation**, **product** or **environment**. Cheap, deterministic rungs run first. The crawler and Claude run only when everything below them failed to decide. The ladder has an in-run layer, inside the test, and a post-run layer, in `triage.yml`.

**In-run layer (inside the test process)**

1. Playwright auto-wait and web-first assertions. These are the baseline, not a fallback.
2. Self-heal (`src/utils/healing.ts`, exposed as a `healer` fixture). A page object declares a primary locator plus ordered alternates (role + name, label, test ID, text, scoped CSS). If the primary does not resolve within a short timeout (3 s), the alternates are tried, then a fuzzy accessible-name match (similarity of at least 0.8). Exactly one visible match: use it, annotate the test `healed`, and append `{test, element, old, new, strategy}` to `heal-report.json`. Zero or several matches: throw the original error. In CI the heal is allowed and logged. In the gate (`HEAL_MODE=strict`) a heal fails the test.

**Post-run layer (`triage.yml`, on CI failure)**

1. **Isolated rerun.** Each failed test reruns alone 3 times with retries 0 and full trace. Passes at least once: verdict **flaky**, stop. Fails 3/3: deterministic, continue. Cost: about 1 minute.
2. **Rule classifier** (`triage/classifier.ts`). It reads the error, the trace network log and console errors, and matches signatures. A high-confidence match is final.

   | Signature | Suspect | Next |
   | --- | --- | --- |
   | Navigation timeout, `net::ERR_*`, DNS, 502/503 on page load | environment | Stop; rerun later; note in the STP |
   | App request returned 5xx, uncaught page error, console error at the failing step | product | Stop if consistent across 3 reruns; else crawler |
   | Locator timeout, strict-mode violation, element detached | automation (selector) | Crawler |
   | Assertion value mismatch with all responses 2xx | product or test data | Crawler, then Claude |
   | Fixture, setup, TypeScript or import error | automation | Stop; fix |
3. **Crawler diagnose** (`triage/crawler-diagnose.ts`). Budget: 3 minutes per failure, at most 3 failures per run. It opens the last URL from the trace (or replays steps up to the failing one), takes an accessibility snapshot, and searches for the target by role and name on that page and on same-origin pages within depth 2.
   - Found under a new name, position or page: **automation**. It proposes the new locator or navigation.
   - Page errors, the feature returns an error, or the element is missing everywhere: **product**.
   - Page does not load: **environment**.
   - It writes `crawl-evidence.json` plus screenshots. The same tool runs locally on demand (npm run diagnose -- \<test>), so the Stabilizer uses it on the original suite's failures too, not only on CI ones. It proposes the fix (new locator, missing step, changed navigation); the Stabilizer applies it, keeping one owner per file.
4. **Claude diagnose** (last resort). It receives a context pack: test source, page object, error, the last 50 trace actions, failed network calls, console errors, the aria snapshot at failure, a screenshot, crawler evidence, and the git diff since the last green run. It must answer in strict JSON: `classification`, `confidence` (0-1), `root_cause`, `evidence[]`, `proposed_fix` (diff), and `bug_draft` (title, steps, expected, actual, severity) when the classification is product.

**What happens with each verdict**

| Verdict | Action |
| --- | --- |
| flaky | Added to the Stabilizer queue with the cause category. Never a bug. |
| automation | Fix proposal in the job summary. If confidence is at least 0.8, Claude opens an `ai-fix/<test>` PR for Lead review. |
| product | Bug draft goes to the Bug Reporter, then SpiraTest, then the test is skipped with the Spira ID in its reason and a `bug` annotation. |
| environment | Rerun. Noted in the STP risk section. No code change. |

**Running Claude in GitHub Actions**

- `triage.yml` triggers on `workflow_run` (CI, completed, conclusion failure) and on `workflow_call` from ci.yml. Permissions: `contents: write`, `pull-requests: write`, `actions: read`.
- It downloads the triggering run's artifacts (actions/download-artifact with run-id and github-token), runs rungs 1-3 in the Playwright container, then publishes the verdicts (job summary, `triage-verdicts` artifact, Slack). Rung 4 is not run in CI (D7).
- Rung 4 runs locally: `gh run download <id> -n triage-verdicts` gives `undecided.json` and the context packs; the Triage agent writes `triage/out/claude-verdicts.json`, then `npx tsx triage/ladder.ts --merge-claude` folds it in.
- Optional local alternative: `triage/claude-diagnose.ts` calls the Messages API directly with a local `ANTHROPIC_API_KEY` and only produces the JSON verdict.
- Guards: the step is skipped, not failed, when the secret is missing. At most 3 failures are sent per run, with a 5-minute timeout. Secrets are never echoed. Fork PRs do not get secrets.
- Output: the verdict table goes to the job summary and a Slack thread; JSON is uploaded as `triage-verdicts` artifact; fix PRs are opened only for automation verdicts.

## Crawler test generator (UI and API, in parallel)

The Crawler-Generator agent works on Kayla's laptop in parallel with everything else. It maps the site, proposes tests, and keeps only those that prove themselves. It never touches the gate directly; promotion goes through a PR the Lead reviews.

**Pipeline (one cycle is about 30-40 minutes; no new tests after the 20:00 cutoff)**

1. **Crawl** (`crawler/crawl.ts`, Playwright, logged in via `storageState`).
   - Breadth-first, same origin, max depth 3, max 150 pages, about 1 request per second.
   - URLs are normalized to patterns (`/product/123` becomes `/product/:id`) and each pattern is visited once.
   - Deny-list for clicks and submits: logout, delete, remove, cancel, pay, confirm order, admin, unsubscribe. No real payments, ever.
   - Per page it captures: URL pattern, title, aria snapshot, forms (fields, types, required), primary actions, links, console errors, failed requests, load time, and every XHR or fetch call (method, URL pattern, status, request and response bodies) for API test generation.
   - Output: `crawler/out/site-map.json` and `site-map.md`. Recon, Coverage and the STP also use these.
2. **Free bug signals from the crawl.** Broken links (4xx), 5xx responses, console errors, slow pages (over 3 s), and axe violations per page go to `crawler/out/signals.md` for the Bug Reporter.
3. **Plan.** The Playwright planner agent (from `npx playwright init-agents --loop=claude`) or a Claude prompt turns the site map into flows ranked by risk, and drops flows that existing tests already cover.
4. **Generate.** The Playwright generator agent writes UI specs, and a Claude prompt over the captured XHR calls writes API specs (using the src/api client and zod schemas inferred from real responses), both into `tests/generated/`. It must use the project's fixtures and page objects; new page objects go into `tests/generated/pages/` until promotion. One test at a time, never a batch: generate, run 10/10, 2-3 self code reviews, the agent's own e2e run, then a PR into Kayla's review queue, then merge. The next test may start generating while the previous one waits for review, so the queue never holds more than one or two crawler PRs.
5. **Filter** (`crawler/promote.ts`). Each candidate runs `--repeat-each=10 --retries=0`, first with 1 worker, then with 4 workers to catch interference.

| Result | Verdict | Action |
| --- | --- | --- |
| 10/10 pass, both modes | Keep | Must also pass lint, use page objects, and assert a business outcome (not just visibility). Then a promotion PR moves it to `tests/e2e/<feature>/`. |
| 1-9 of 10 pass | Flaky | Delete. Log the failure signatures in the promotion report. |
| 0/10 pass, triage says product | Product bug | Keep, skipped with `test.skip` and the Spira ID once filed, plus a `bug` annotation. The bug draft goes to the Bug Reporter. |
| 0/10 pass, triage says automation | Bad test | One regeneration attempt, then delete if it still fails. |
| 0/10 pass, triage says environment | Parked | Retry next cycle. |

6. **Report.** `crawler/out/promotion-report.md` lists every candidate: flow, results of the 10 runs, verdict, action. The Scribe links it from the STP as coverage evidence.

**Guards**

- Promoted tests are marked as AI-generated, human-reviewed in `docs/AI_LOG.md`, with the reviewing commit.
- `tests/generated/` is excluded from `ci.yml` and the gate via `testIgnore` until promotion.
- Skipped product-bug tests show as skipped, not passed, in the gate. Every one must be listed under "Known product bugs" in the README so the 5/5 green claim stays honest.

## Coverage strategy

Coverage is chosen by risk: business impact × likelihood of failure. Critical paths come first, then negative and edge cases. The Coverage agent picks the template matching the Recon product type, then adds the universal layer.

**Priority order**

1. P1: the 1-3 flows the product exists for (buy, book, submit, create). Happy path, end to end.
2. P1: authentication, mandatory on any product with login (checklist below).
3. P2: validation and negative cases on every P1 form (required fields, formats, boundaries).
4. P2: error states, using `page.route` to mock 500 and empty responses.
5. P3: universal layer (below).
6. P3: secondary features found by the crawler.

**P0, above everything: fix the existing tests.** They cannot be removed. New coverage only uses agents not needed on existing failures, and stops whenever an existing test needs help.

**Test creation cutoff: 20:00.** No agent starts a new test after 20:00, one hour before the close, unless Kayla overrides it in her instructions. Tests already in the review queue may still merge until the 20:20 code freeze; after that the time goes to stabilizing, docs and the final gate.

**Authentication checklist (`tests/e2e/auth/`, tag `@smoke` for the first three)**

| Flow | Cases | Applies when |
| --- | --- | --- |
| Login | Valid credentials land on the expected page; wrong password; unknown user; empty fields; password field masked | Always |
| Logout | Session cleared; back button does not restore the session; protected page redirects after logout | Always |
| Protected routes | Direct URL while logged out redirects to login, then returns to the original page after login | Always |
| Session | Session survives reload and a new tab; expired or cleared cookie forces re-login | Always |
| Sign-up | Happy path with a `RUN_ID` email; validation; duplicate email rejected | Self-registration exists |
| Password reset | Request flow up to the confirmation message; invalid email handled | Reset link exists |
| Remember me | Persists across a new context with saved state | Option exists |
| Lockout or rate limit | Message shown after repeated failures | Product has one; use a throwaway user only |
| SSO or OAuth | Redirect to the provider starts correctly; no login on the real provider | SSO button exists |
| Security basics | No credentials in URL or console; login served over HTTPS | Always |

Rules: login tests run in a fresh context (`test.use({ storageState: { cookies: [], origins: [] } })`); every other test logs in once through the `auth.setup.ts` project. Negative tests use a non-existent user, never the shared test account, so 5 parallel gate jobs cannot lock it out.

**API testing (required layer, as in the first round)**

API tests run in their own Playwright project `api` (no browser), first in CI and inside the gate. A dedicated API agent (the 11th subagent, 18:20-20:00) owns src/api and tests/api and works straight from the API documentation, endpoint by endpoint, independent of the UI. It starts with the endpoints behind P1 flows. The Coverage agents focus on UI; when a UI flow needs an API check they reuse the API agent's client and schemas rather than writing their own.

1. **Discover.** Start from the API documentation the organizers provide (the first round had a full API doc). If there is none, look for OpenAPI or Swagger (`/swagger`, `/api-docs`, `/openapi.json`). Without docs, record the UI's XHR and fetch calls as a HAR during Recon and the crawl. Output: `docs/API_MAP.md` (endpoint, method, auth, used by which UI flow).
2. **Client.** A typed client in `src/api/` built on Playwright's `request` fixture, base URL from env, token from the login endpoint or the auth setup.
3. **Schemas.** One zod schema per response, or ajv against the OpenAPI spec when one exists.

| Check | Cases |
| --- | --- |
| Happy path | Status code, schema, key values for each endpoint the P1 flows use |
| Auth | 401 without a token, 403 with the wrong role, token expiry |
| Validation | 400 on missing fields, wrong types, boundary values |
| CRUD lifecycle | Create, read, update, delete with `RUN_ID` data and cleanup in teardown |
| Not found and errors | 404 on unknown IDs; error body has a clear message |
| Contract between layers | A UI action is verified through the API, and API-seeded data shows in the UI |
| Headers | Content type, caching, basic security headers |
| Response time | Logged per endpoint; a warning, not a failure, so it cannot flake the gate |

If the product exposes no API at all, the STP says so and API coverage is limited to the XHR calls the UI makes.

**Templates by product type**

| Product type | Core flows to cover |
| --- | --- |
| E-commerce | Search, filter, sort, product details, add/remove from cart, quantity update, cart total math, checkout up to (not including) real payment, empty cart |
| SaaS dashboard | Login, create/read/update/delete an entity, list search and pagination, permissions per role, settings save |
| Form or booking flow | Multi-step wizard, back/next state, validation per step, date pickers, summary page, confirmation |
| Content or CMS | Navigation, search, article rendering, pagination, filters, share links |
| Social | Sign up, profile edit, post create/delete, feed, follow, notifications |
| Banking demo | Login, balance, transfer between accounts with balance math, transaction history, statement filter |

**Universal layer (any site)**

- `@smoke`: home page loads, main navigation links resolve, no console errors on key pages.
- `@a11y`: `@axe-core/playwright` on 3-5 key pages, failing only on critical and serious violations.
- `@visual`: `toHaveScreenshot` on 3-5 stable pages or components, with dynamic regions masked, animations disabled, and `maxDiffPixelRatio` of 0.01. Baselines are generated in Docker.
- `@api`: a required layer, see API testing below.
- Responsive: one P1 flow on a mobile viewport project (`devices['Pixel 7']`).

**Traceability**

- Each spec has a title prefix or annotation linking it to an STP requirement ID (`REQ-AUTH-01`).
- `docs/STP.md` holds the matrix: requirement, risk, test files, status, known bugs.

**Rule:** a new test is merged only after it passes 10/10 locally with `--repeat-each=10 --retries=0`.

## Reporting, faults and notifications

The brief asks for two kinds of fault records. Product faults go to SpiraTest. Faults in the automation project, and the changes made, go to a fix log. Both are linked from the README. Pages publishing is described in the CI/CD section.

**Product faults (SpiraTest + Jam)**

- Sources: triage product verdicts, crawler signals, exploratory testing by the Bug Reporter, failures in the original suite that turn out to be real.
- Each bug has two pieces of evidence: a public Jam recording of a manual repro (console and network), and the failure screenshot the automation captured (`screenshot: 'only-on-failure'`), attached to the Spira incident.
- The Bug Reporter drafts each bug in `docs/BUGS.md` using the template below. `scripts/spira-file.ts` then files it through the Spira REST API (see Automated filing). Manual filing in the Spira UI is the fallback.
- Template: title (component: symptom), environment (URL, browser, date, commit), preconditions, steps, expected, actual, severity and priority, evidence (Jam link, screenshot, Pages report link to the failing test), linked test file.
- Linked test: `test.skip(true, 'SPIRA-<id>: <title>')` plus `test.info().annotations.push({ type: 'bug', description: 'SPIRA-<id> <url>' })`, so the HTML report shows the link.

**Automated filing (SpiraTest REST API)**

- SpiraTest has a REST API: `POST projects/{project_id}/incidents` creates an incident, and `POST projects/{project_id}/documents/file` uploads a base64 attachment and links it to an artifact (artifact type 3 = incident). Auth is username + API key from the Spira user profile. [Docs](https://api.inflectra.com/spira/services/v4_0/RestService.aspx), [attachment example](https://inflectra.com/Support/Forum/spiraplan/issues-questions/2176.aspx).
- `scripts/spira-file.ts` input: the bug draft from `docs/BUGS.md` or a triage product verdict. Steps: check for a duplicate by name, create the incident (name, steps, expected, actual, priority, severity, Jam link, Pages report link), upload the failure screenshot from `test-results/`, write the Spira ID back to `docs/BUGS.md`, and print the `test.skip` line to paste into the test.
- Draft mode by default (prints the payload). `--submit` files it after Kayla's one-line approval. CI triage only drafts; it never files on its own, so no false bug reaches Spira.
- Secrets: `SPIRA_URL`, `SPIRA_USER`, `SPIRA_API_KEY`, `SPIRA_PROJECT_ID`.
- Status: API access is on and a key is issued. The key lives only in GitHub secrets and a local .env, never in docs or the repo. Test it Tuesday with one `GET projects` call; if blocked, file manually and keep the screenshot step.

`docs/BUGS.md` table: Spira ID, title, severity, found by (test, crawler, exploratory, triage), Jam link, linked test, status.

**Automation faults and changes (`docs/FIXES.md`)**

One row per issue fixed: ID, category, file, problem, fix, commit. Categories: hard wait, brittle selector, missing await, test interdependence, shared data, wrong assertion, outdated API, config, CI, secrets in code. A category summary at the top (for example "14 hard waits removed") feeds the video and the STP.

**Slack (`#itac-runs`, Incoming Webhook)**

- Per CI run: status, passed/failed/flaky/healed counts, duration, branch, commit, report link.
- Per gate: `5/5 GREEN` or the failing run, with the gate summary link.
- Per triage: top 3 failures with verdict and confidence; product verdicts are highlighted.
- Slack is private to judges, so the README includes 2-3 screenshots of these messages as evidence of the integration.
- No personal Jira (see D10). If a judge asks, say that Spira is the system of record and Slack is the notification layer.

## Deliverables and submission

Submit through the form by 20:55, five minutes before the 21:00 hard close. No email, no late entries.

**Submission checklist (20:40-20:55)**

- [ ] Link 1: public GitHub repo.
- [ ] Link 2: GitHub Actions run, the parallel Stability Gate run (5 jobs in one workflow run) showing 5/5 green.
- [ ] Link 3: the Pages report for that run (with the history index one click away).
- [ ] STP link (`docs/STP.md` in the repo).
- [ ] Fault documentation: `docs/BUGS.md` with Spira IDs, and `docs/FIXES.md`.
- [ ] All Spira bugs filed and Jam links public.
- [ ] Summary video uploaded with a public, unlisted link (YouTube unlisted or Loom).
- [ ] Every link opened in an incognito window.
- [ ] Form submitted, confirmation screenshot saved.

**README structure**

1. One-line summary + badges (CI status, gate status, report link).
2. Results at a glance: before/after table (tests, passing, flaky, lint errors, hard waits, run time, 5/5 gate).
3. Links: gate run, report, history index, STP, BUGS, FIXES.
4. How to run: local, Docker, CI, gate.
5. Architecture: tree + one paragraph per layer, link to `docs/ARCHITECTURE.md`.
6. Stability approach: root causes found, triage ladder, self-healing, gate.
7. Known product bugs: each skipped test with its Spira ID.
8. Bonus features: Docker, visual, Slack (screenshots), self-healing, Claude triage, crawler generator.
9. AI usage: tools used (Claude Code with subagents, Playwright MCP and test agents; no Claude in CI), what AI created or changed (per folder), key prompts (from docs/AI\_LOG.md), what Kayla reviewed and rejected, and the note that the kit was prepared before the competition.
10. Decision log link (`docs/DECISIONS.md`).

**STP outline (`docs/STP.md`)**

Scope and out of scope; product profile from Recon; risk analysis table; test levels and types (E2E, API, visual, a11y); environments and data strategy; entry and exit criteria (exit = gate 5/5, retries 0, 0 heals, all product failures filed); traceability matrix; tooling and CI; flakiness policy and triage ladder; known risks and limitations; schedule as executed.

**Summary video (3-4 minutes, script drafted by the Scribe by 20:10)**

1. Starting state: numbers from BASELINE, and a screenshot of the red first run.
2. Problems found: the top root causes, with counts from FIXES.
3. What changed: architecture, lint, Docker, CI, triage ladder.
4. How stability improved: before/after flakiness matrix and the gate table.
5. Why it is credible now: retries 0, 0 heals, 5/5 parallel, known bugs disclosed, everything reproducible from the README.

Record with screen capture plus voice-over at 20:40. If time is short, record the voice-over on top of the README scroll.

## Risks and mitigations

The biggest risk is not reaching 5/5 green in time. The timeline therefore runs a parallel gate at 20:00 and freezes code at 20:20 for the final parallel gate.

| Risk | Likelihood | Impact | Mitigation |
| --- | --- | --- | --- |
| Gate not 5/5 by 20:40 | Medium | Critical | First parallel gate at 19:15 for early signal; a still-flaky new test is dropped at 20:00; a still-flaky existing test gets every free agent (Stabilizer instances, crawler diagnose, Claude triage); never raise retries to fake green |
| The product itself is unstable | Medium | High | Measure in Recon; readiness polling; classify as environment; disclose in STP; ask judges |
| Parallel agents create merge conflicts | High | Medium | Worktrees, owned paths, fixed merge order, Lead merges only |
| Suite too slow for a sequential gate | Medium | High | Budget under 5 minutes per run; sharding in ci.yml; `@smoke` subset for iteration |
| Claude in CI fails to authenticate | Medium | Low | Dry run tonight; direct API fallback script; the step skips without the secret |
| Interactive Claude quota exhausted | Low | Critical | CI uses no Claude credential (D7); at most 6 heavy agents at once |
| Venue Wi-Fi slow or blocked | Medium | High | Docker image and npm cache pulled in advance; phone hotspot |
| Captcha, MFA or no test account | Low | High | Ask judges at 17:50; mock or API login if allowed |
| Visual tests flaky | Medium | Medium | Masks, disabled animations, Docker baselines; drop visual from the gate if unstable by 20:00 and keep it in ci.yml |
| AI output merged without understanding | Medium | High | Lead review checklist; every change has a CHANGELOG cause and fix; Kayla must be able to explain it on video |
| Links not public | Low | Critical | Incognito check is a checklist item; Pages and repo visibility checked at 18:20 |
| Accidental destructive actions on the product | Low | High | Crawler deny-list; no real payments; read-only where data reset is unavailable |

## Questions for the judges

Ask these in the 17:50-18:00 question slot; good questions earn bonus points. Write the answers into `docs/DECISIONS.md` straight away.

- [ ] Do "5 consecutive green runs" mean 5 separate workflow runs, or does one run with 5 jobs count? Is a parallel matrix acceptable? (decides D2's headline)
- [ ] Are retries allowed in the runs that count? (we plan 0)
- [ ] Answered by the organizers: a test failing on a confirmed product bug may be skipped with its SpiraTest ID; a flaky automation test (below 10/10) is not added.
- [ ] Is there a dedicated test environment and test accounts? Can we create data, and is there a reset?
- [ ] Are there rate limits, captcha or bot protection we should know about? Can GitHub runner IPs reach the product?
- [ ] Which browsers and viewports matter to the product owner?
- [ ] What severity threshold should product bugs meet to be filed in SpiraTest? Any required fields or project in Spira?
- [ ] May we change the product's existing test IDs or ask for new ones (in real life we would), or is the DOM fixed?
- [ ] Should the summary video be submitted at 21:00 with the rest, and is there a length limit?
- [ ] Is a pre-prepared tooling kit acceptable if it is disclosed in the README?

* [ ] Is API testing expected in the final, and is there API documentation or a Swagger page for the product?

## Pre-built kit: what to build before Wednesday

The kit is a private repo `itac-kit` that is copied into the competition repo with one script (`scripts/apply-kit.sh`). It is built Tuesday night and dry-run Wednesday morning; Wednesday from 14:00 there are no new features, only fixes.

| Priority | Item | Contents | When |
| --- | --- | --- | --- |
| P0 | Agent definitions | `.claude/agents/*.md` for all roster agents, root `CLAUDE.md` (standards, ownership, merge rules), slash commands `/recon` `/stabilize` `/gate` `/triage` `/scribe` | Tue |
| P0 | AI prompt logger | Claude Code `UserPromptSubmit` hook appending timestamp + prompt to `docs/AI_LOG.md` | Tue |
| P0 | Workflows | `ci.yml`, `run-suite.yml`, `stability-gate.yml` (both modes), Pages history publisher, job summary script, Slack step | Tue |
| P0 | Config and lint baseline | `playwright.config.ts` template, strict `tsconfig`, ESLint + Playwright plugin + Prettier configs, `npm run verify` | Tue |
| P0 | Docs templates | README, STP, BASELINE, BUGS, FIXES, CHANGELOG, DECISIONS, ARCHITECTURE, video script | Tue |
| P0 | Scripts | `apply-kit.sh`, `setup-secrets.sh` (`gh secret set` for all secrets), `gate-5x.sh`, `version-check.sh` (Docker tag vs Playwright) | Tue |
| P1 | Framework core | `env.ts` (zod), fixtures skeleton, `BasePage`, data factory with `RUN_ID`, logger, annotation helpers | Tue |
| P1 | Self-healing locator | `healing.ts` + `healer` fixture + `heal-report.json` + strict mode | Tue |
| P1 | Docker | `Dockerfile`, `docker-compose.yml` (test, update-snapshots) | Tue |
| P1 | Triage ladder | `classifier.ts`, isolated rerun step, `triage.yml`, Claude step + direct API fallback | Wed morning |
| P2 | Crawler | `crawl.ts`, `promote.ts`, signal extraction, promotion report | Wed morning |
| P2 | Visual + a11y helpers | Screenshot fixture with default masks, axe fixture | Wed morning |
| P2 | Spira API script | spira-file.ts: create incident, upload failure screenshot, draft mode by default | Wed morning |

**Dry run on a public demo site (Wednesday by 13:00)**

Pick one site that matches a likely product type (for example a demo e-commerce site). Then:

1. Create a fresh repo with a deliberately broken suite: hard waits, an XPath, a missing await, a shared-data test.
2. Run the full competition flow with agents: apply the kit, Recon, Stabilize, CI, gate parallel, gate sequential, triage on a forced failure, Slack, Pages, incognito check.
3. Time each phase and adjust the timeline if any phase overruns by more than 25%.
4. Fix kit issues, tag `itac-kit` as `v1.0`, and stop.
