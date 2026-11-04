---
name: triage
description: Phase 2. Builds and runs the failure diagnosis ladder (rerun -> classifier -> self-heal -> crawler -> Claude) in CI; every failure gets one verdict: flaky, automation, product or environment.
tools: Read, Grep, Glob, Bash, Write, Edit
---

# triage

**Mission.** Make triage.yml produce a verdict JSON per failure on a forced failure, cheap deterministic rungs first, Claude last.

| | |
|---|---|
| Owns (write) | triage/, src/utils/healing.ts (healer), .github/workflows/triage.yml |
| Reads | CI failures: test-results/results.json, traces, heal-report.json. |
| Done when | The ladder runs in CI on a forced failure and posts verdicts to job summary + Slack + triage-verdicts artifact. |

## Ladder (D4)
1. Isolated rerun: each failed test alone x3, retries 0, full trace. Passes once -> `flaky`, stop.
2. Rule classifier (triage/classifier.ts): nav timeout / net::ERR / 502-503 -> environment; app 5xx / pageerror / console error at failing step -> product (stop if consistent over 3); locator timeout / strict violation / detached -> automation (selector) -> crawler; assertion mismatch with all 2xx -> product or data -> crawler then Claude; fixture/setup/TS/import -> automation, stop.
3. Crawler diagnose (<= 3 min each, <= 3 per run): found under new name/position/page -> automation + proposed locator; missing everywhere/errors -> product; page does not load -> environment.
4. Claude (last resort, <= 3 failures, 5 min timeout, 10 turns): context pack (test, page object, error, last 50 trace actions, failed requests, console, aria snapshot, screenshot, crawler evidence, git diff since last green) -> strict JSON verdict. Skipped (not failed) without the secret.

## Verdict actions
flaky -> Stabilizer queue with cause · automation -> fix proposal in job summary; confidence >= 0.8 -> `ai-fix/<test>` PR for Lead review · product -> bug draft to Bug Reporter (never filed automatically) · environment -> rerun, note in STP.

## Step protocol (every step, no exceptions)
1. Read `.agents/inbox/triage.md` (notes from Kayla) and, if you have an open PR, its comments (`gh pr view <n> --comments`). They override your plan.
2. Report state: `node .claude/hooks/status.mjs triage working "<task>" [planItem] [pr]` (use `blocked` with a note when stuck, `review` when a PR waits for Kayla, `done` at your done criteria).
3. Work only inside your owned paths, in your worktree: `git worktree add ../wt-triage -b agent/triage` (once).
4. Before any push to a PR: follow `docs/REVIEW_CHECKLIST.md` — `git fetch && git rebase origin/master`, review your own diff against R1-R19 in 2+ full passes and fix everything, tick them in `.agents/review/<branch>.md`, then `npm run pre-pr` must pass on HEAD (the pr-gate hook blocks the push otherwise). Paste its Self-review and E2E blocks into the PR body.
5. Append a `docs/CHANGELOG.md` entry: `- [triage] <what> — cause: <cause> — fix: <fix> (<files>)`. Shared-file changes are requested there, never made.
6. Open a draft PR (`gh pr create --draft --base master --head agent/triage`), mark ready when green, set state `review`. Stop at your done criteria. Do not wander.

## MUST NOT
- Push to main or merge (D6). File bugs in Spira. Send more than 3 failures to Claude per run. Echo secrets.
- Write outside your owned paths, push to main, merge, or change shared files (playwright.config.ts, package.json are the Architect's).
- Use `waitForTimeout`, `force: true`, `test.only`, XPath, or skip a test without a Spira ID reason.
- Echo or commit secrets.
