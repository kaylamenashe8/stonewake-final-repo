# Triage ladder

Every failure gets one verdict: **flaky**, **automation**, **product** or **environment** (D4).
Cheap, deterministic rungs run first; each rung only sees what the rung below left undecided.

| Rung | File | Decides when | Cost |
| --- | --- | --- | --- |
| In-run: auto-wait, self-heal | `src/utils/healing.ts` | a locator drifted (logged; strict in the gate) | 0 |
| 1. Isolated rerun ×3, retries 0, trace on | `rerun.ts` | passes ≥1 of 3 → flaky | ~1 min |
| 2. Rule classifier | `classifier.ts` | signature match with confidence ≥ 0.8 | ms |
| 3. Crawler diagnose (≤3 failures, 3 min each) | `crawler-diagnose.ts` | element found elsewhere → automation; missing everywhere / page errors → product; page down → environment | ~1-3 min |
| 4. Claude (≤3 failures, 5 min) | `claude-diagnose.ts` / claude-code-action | strict JSON verdict via a forced tool | API |

Classifier signatures: `net::ERR_*`, DNS, navigation timeout, 502/503/504 on load, 429/challenge →
environment (stop) · import/syntax/TS/fixture/hook errors → automation (stop) · app-origin 5xx or uncaught
page error → product (final when the rerun failed 3/3, else crawler) · locator timeout, strict-mode
violation, detached element, blocked heal → selector suspect → crawler · console errors only → crawler ·
value mismatch with all responses 2xx → crawler, then Claude. Third-party origins are ignored (only
`BASE_URL` / `API_URL` count as the app).

## Commands

```bash
npx tsx triage/ladder.ts                      # whole ladder on test-results/results.json
npx tsx triage/ladder.ts --reports <dir> --no-claude   # what CI's ladder job runs
npx tsx triage/ladder.ts --merge-claude       # fold claude-verdicts.json in, rewrite summary
npm run triage:classify -- <report>           # rung 2 only
npm run diagnose -- "<test title>"            # rung 3 locally; runs the test once if needed
npm run triage:claude                          # rung 4 direct API (needs ANTHROPIC_API_KEY)
npx tsx --test triage/classifier.test.ts      # classifier unit tests
```

## Outputs (`triage/out/`)

| File | Used by |
| --- | --- |
| `verdicts.json` (`Verdict[]`, `types.ts`) | Slack, Control Center, Scribe |
| `summary.md` | job summary (`$GITHUB_STEP_SUMMARY`) |
| `stabilizer-queue.md` | Stabilizer: flaky + automation items with cause |
| `bug-drafts.json` | Bug Reporter → `scripts/spira-file.ts` (draft only; Kayla approves `--submit`) |
| `actions.json` | automation ≥ 0.8 with a fix → `ai-fix/<slug>` PR candidates |
| `undecided.json`, `context/*.md` | rung 4 input (context packs) |
| `crawl-evidence.json`, `crawl/*.png` | crawler evidence |

## CI (`.github/workflows/triage.yml`)

Called by `ci.yml` (`workflow_call`, `run_id`, `secrets: inherit`) when the test job fails.
Jobs: **ladder** (Playwright container: downloads `results-*` + `test-results-*`, rungs 1-3) →
**claude** (only when something is undecided and a credential exists: claude-code-action with
max 10 turns and limited tools; falls back to the direct Messages API script) → **publish**
(merge, job summary, `triage-verdicts` artifact, Slack). The Claude step is skipped, not failed,
without `ANTHROPIC_API_KEY` / `CLAUDE_CODE_OAUTH_TOKEN`. Secrets are never echoed. Claude opens only
draft `ai-fix/*` PRs for automation verdicts; it never pushes to main and a human merges (D6).
