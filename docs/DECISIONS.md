# Decision log

> Owner: Lead. Each decision is final unless a judge's answer on the day overrides it (record the override below).

| # | Decision | Rationale |
|---|---|---|
| D1 | Fork/import the given project into a public personal repo with full history; tag the starting commit `baseline`. | `baseline..main` is the before/after proof. |
| D2 | The Stability Gate has two modes. Parallel: one run, 5 matrix jobs at once, each a full suite run (final evidence). Sequential: 5 chained jobs, backup only. | Parallel proves 5 independent green runs of one commit in ~6 min; sequential is ready if "consecutive" means one after another. |
| D3 | Retries 0 in the gate, 1 in regular CI (report flags "flaky"). | Retries hide flakiness; a gate with retries proves nothing. |
| D4 | Diagnosis climbs a fixed ladder: isolated rerun -> rule classifier -> self-heal -> crawler -> Claude; each rung only if the one below gave no answer. | Cheap and deterministic first; slow and costly last. |
| D5 | Self-healing runs in regular CI and logs every heal; each heal becomes a committed locator fix before the final gate. Final evidence has 0 heals. | Silent red-to-green looks like masking. |
| D6 | Claude in CI only diagnoses and proposes (job summary, PR comment, `ai-fix/*` PR). It never pushes to main. | Engineering judgment: a human merges. |
| D7 | CI auth = Anthropic API key with a $20 cap (`ANTHROPIC_API_KEY`); `CLAUDE_CODE_OAUTH_TOKEN` fallback. | CI bursts must not throttle the interactive session's quota. |
| D8 | The crawler generator runs locally, out of band, 18:20-20:00; never in the gate. Generated tests sit in `tests/generated/` until promoted. | Generation is noisy; the gate holds reviewed tests only. |
| D9 | A test failing on a confirmed product bug is skipped with its SpiraTest ID + bug annotation. A flaky automation test (< 10/10) is not added. | Confirmed by the organizers; the report shows each skip with its Spira link. |
| D10 | Bug tracking = SpiraTest (required). Notifications = Slack Incoming Webhook. No personal Jira. | Spira is mandatory; a webhook is one secret with the fewest failure points. |
| D11 | Every CI job runs in the pinned Playwright Docker image; visual baselines are generated in the same image. | Same environment locally and in CI; macOS screenshots never match Linux. |
| D12 | The kit is built in advance and disclosed in the README as prepared before the competition. | Transparency; preparation is not an unfair advantage. |
| D14 | Keep the given default branch `master`; the kit's workflows, scripts and agents point at `master`. | Kayla's preference; no surprise for the judges comparing with the original repo. |
| D15 | Test only in our own workspace (Finalist 4, kaylamenashe@gmail.com); never the judges' or other finalists' accounts. API key role is `viewer`. | Each finalist has a workspace with the same starting data; writes in shared workspaces would affect others. |
| D13 | Every agent works in its own git worktree and branch and owns specific directories; merge order is fixed. | Parallel agents on one tree create conflicts and lost work. |
| D16 | Lint stays at `error` with `--max-warnings=0`; the two legacy baseline specs (`tests/api.spec.ts`, `tests/ui.spec.ts`, 177 errors + 54 warnings) are in the ESLint ignore list until the Stabilizers move them. Moved files are linted in full. | Every non-legacy file is already clean at `error`, so `LINT_LEVEL=warn` would only hide new problems (and `--max-warnings=0` fails on warnings anyway). The ignore matches only the old paths, so it lapses on its own when the files move; remove it then. |

## Judge answers (17:50-18:00 — write answers here immediately)
| # | Question | Answer | Changes decision |
|---|---|---|---|
| J1 | Do "5 consecutive green runs" mean 5 separate workflow runs, or does one run with 5 jobs count? Is a parallel matrix acceptable? | | D2 |
| J2 | Are retries allowed in the runs that count? (we plan 0) | | D3 |
| J3 | (Answered) A test failing on a confirmed product bug may be skipped with its SpiraTest ID; a flaky automation test (< 10/10) is not added. | Confirmed | D9 |
| J4 | Is there a dedicated test environment and test accounts? Can we create data, and is there a reset? | | |
| J5 | Rate limits, captcha or bot protection? Can GitHub runner IPs reach the product? | | |
| J6 | Which browsers and viewports matter to the product owner? | | |
| J7 | Severity threshold for filing in SpiraTest? Required fields or project? | | |
| J8 | May we change the product's test IDs or ask for new ones, or is the DOM fixed? | | |
| J9 | Is the summary video due at 21:00 with the rest; any length limit? | | |
| J10 | Is a pre-prepared tooling kit acceptable if disclosed in the README? | | D12 |
| J11 | Is API testing expected in the final; is there API documentation or a Swagger page? | | |
| J12 | (Luca, 18:18, WhatsApp) Is security testing allowed? | Yes: "feel free to do everything you want". | D17 |
| J13 | (Luca, 19:02, WhatsApp) Product update: social monitoring | Monitoring now has two tabs, **Research** and **Sentiment**. "Monitor a name" (top right) adds a company, person, brand or topic; Sentiment shows what public posts say per name; each row can be paused or removed in place; posts for a new name appear after its next reading; refresh once to see it. | D18 |
| J14 | (Organizers, 19:22) Deliverable: a Markdown file in the repo with the prompts used during the competition | `docs/PROMPTS.md`: key prompts + full log, exported from the session transcripts by `scripts/export-prompts.mjs` (secrets redacted); regenerate before submitting. | |

## Decisions made on the day
| Time | Decision | Why | By |
|---|---|---|---|
| 19:05 | D17 Security testing is in scope (J12). We run it **in our own workspace only (D15)** and keep out what Stonewake's disclosure policy excludes even with permission: other customers' or finalists' workspaces, denial of service or anything that degrades the shared service, social engineering, third-party services (notes-C §1). Ideas: notes-C §2.2. | Luca allowed it; the environment is shared with the other finalists, so a DoS or cross-workspace probe would hurt them and the judges' run. | Kayla |
| 19:05 | D18 Social monitoring (J13) joins flow F5 Monitoring/Portfolio as P1 (T30-T31). Tests assert the name's row and its controls, never posts: posts arrive only after the next reading, so asserting them would be flaky. Each test adds its own RUN_ID-prefixed name and removes it. | New feature announced on the day = likely judged; live post data is not deterministic. | Kayla |
