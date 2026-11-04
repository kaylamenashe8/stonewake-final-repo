---
description: Bring all docs up to date from CHANGELOG, BASELINE, BUGS, FIXES and the latest gate
argument-hint: "[focus: stp|readme|video|plan|all]"
---
Use the **scribe** subagent. Focus: "$ARGUMENTS" (empty = all).

Inputs: every docs/CHANGELOG.md entry, docs/BASELINE.md, docs/BUGS.md, docs/FIXES.md, the latest stability-gate run (`gh run list --workflow stability-gate.yml --limit 1`), the Pages report URL.
Outputs: STP.md, README.md numbers and links, FIXES.md summary line, AI_LOG.md "Key prompts" + "Reviewed and rejected", VIDEO_SCRIPT.md, TEST_PLAN.md export (at 20:10).
Rules: every number comes from a file or a run; list remaining `<!-- FILL -->` markers at the end of your report.
