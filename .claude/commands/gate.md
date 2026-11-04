---
description: Run the Stability Gate (5 full-suite runs, retries 0, strict healing) and report the table
argument-hint: "[parallel|sequential] (default parallel)"
---
Mode: "$ARGUMENTS" — use `parallel` unless it says `sequential`.

1. Check the working tree is clean and master is pushed: `git status --short`, `git log origin/master -1 --oneline`.
2. Trigger: `gh workflow run stability-gate.yml -f mode=<mode> --ref master`.
3. Find the run: `gh run list --workflow stability-gate.yml --limit 1 --json databaseId,url,status`, then `gh run watch <id> --exit-status`.
4. Report: the run URL, the gate-summary table (run, passed, failed, flaky, healed, duration) from `gh run view <id> --log | grep -A12 'GATE:'` or the job summary, the verdict line `GATE: 5/5 GREEN` or the failing run, and the Pages link.
5. If red: list failing tests per run with their triage verdicts. Do NOT change code or retries; suggest the PRD fallback (fix only the failing test; Spira-skip only a product bug; drop only a new test; rerun).
