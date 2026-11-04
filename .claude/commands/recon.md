---
description: Phase 1 — run the Recon agent on the given repo and product (18:00-18:20)
argument-hint: "[product notes from the brief]"
---
Use the **recon** subagent. Context from Kayla: $ARGUMENTS

1. Confirm `.env` has BASE_URL (and TEST_USER/TEST_PASSWORD if given). Do not print secret values.
2. The recon agent fills docs/BASELINE.md (product profile, health audit, 5x flakiness, failure clusters, counts, top 10) and docs/TEST_PLAN.json, triggers the first CI run on the untouched code, and tags `baseline`.
3. When it reports done, show me: the counts table, the top 5 clusters (tests affected), the proposed Stabilizer folder split for up to 3 instances, and the first CI run link.
4. Then run `npm run plan:issues -- --dry-run` and show the issue list for my approval before creating issues.
