---
description: Start Stabilizer instance(s) on assigned spec folders
argument-hint: "<instance 1|2|3> <folders...>"
---
Use the **stabilizer** subagent as instance `stabilizer-$1` (worktree `../wt-stabilizer-$1`, branch `agent/stabilizer-$1`) owning only these folders: $ARGUMENTS (ignore the first word, it is the instance number).

Start from docs/BASELINE.md clusters for those folders, biggest cluster first. Every fix is tagged with its cause category and gets a docs/FIXES.md row. Existing tests are never removed; only a Spira-backed `knownBug` skip is allowed. Stop when each test in the folders passes `npm run test:10x` (10/10, and with --workers=4) or is Spira-skipped, then set status `review` and report the PR link.
