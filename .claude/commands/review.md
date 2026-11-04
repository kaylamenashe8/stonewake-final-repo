---
description: Lead review checklist (60 s) for a PR, then approve+merge or request changes
argument-hint: "<pr number>"
---
Review PR #$1 against the Lead checklist. Gather: `gh pr view $1 --json title,headRefName,author,files,body,statusCheckRollup`, `gh pr diff $1`, the matching `docs/CHANGELOG.md` entry, and the agent's `.claude/agents/<agent>.md` owned paths (agent = branch `agent/<agent>`).

Report each line as PASS / FAIL with evidence:
1. **Owned paths**: every changed file is inside the agent's owned paths (list offenders). Shared files (playwright.config.ts, package.json, tsconfig.json, eslint.config.mjs) only from the architect.
2. **Banned patterns in added lines**: `waitForTimeout`, `force: true`, `test.only`, `.only(`, XPath (`//`, `xpath=`), `test.skip`/`test.fixme` without a `SPIRA-` reason, raised retries.
3. **CHANGELOG** entry states cause and fix.
4. **verify green**: required checks pass (statusCheckRollup), and for new tests the PR body shows the 10/10 result (both worker modes).
5. **Self-reviews**: PR body mentions 2-3 self-reviews and the agent's own e2e run.
6. **Merge order**: Architect -> Stabilizer -> CI/Infra -> Coverage -> Visual/Bonus -> Triage (Scribe, Bug Reporter any time). Warn if an earlier-order agent still has an open ready PR (`gh pr list --state open --json headRefName,isDraft`).

Then ask me: approve and merge (`gh pr review $1 --approve && gh pr merge $1 --squash`) or request changes (`gh pr comment $1 --body "<my words>"`). Never merge without my answer.
