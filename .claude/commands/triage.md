---
description: Run the diagnosis ladder on the latest failed CI run (or a given run id / test)
argument-hint: "[run-id | test title]"
---
Use the **triage** subagent. Target: "$ARGUMENTS" (empty = the latest failed ci.yml run).

Ladder, stop at the first rung that decides: isolated rerun x3 (retries 0) -> rule classifier (`npm run triage:classify`) -> crawler diagnose (`npm run diagnose -- "<test>"`, max 3) -> Claude (`npm run triage:claude`, max 3, only if still undecided).

Report a table: test, verdict (flaky/automation/product/environment), confidence, rung, root cause, proposed action. Product verdicts: hand the bug draft to the **bug-reporter** (draft only, never --submit). Automation with confidence >= 0.8: propose the fix as an `ai-fix/<test>` PR for my review. Never push to main.
