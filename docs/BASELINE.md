# Baseline (before)

> Owner: Recon. Commit tagged `baseline`. Every other agent reads this first.

- Repo: <!-- FILL --> · starting commit: <!-- FILL sha --> · Playwright: <!-- FILL --> · Node: <!-- FILL -->
- First CI run on untouched code: <!-- FILL link -->

## Product profile
| Question | Answer | Evidence | Plan impact |
|---|---|---|---|
| Product type | | | |
| Authentication | | | |
| Test accounts | | | |
| Data reset | | | |
| Public API / XHR | | | |
| Bot protection / rate limits | | | |
| Site stability (10 health requests: codes, p50/p95 ms) | | | |
| Test IDs in DOM (attribute) | | | |
| Dynamic content | | | |

## Counts
| Metric | Value | How measured |
|---|---|---|
| Tests | | `npx playwright test --list` |
| Passing (5/5) | | `--repeat-each=5 --retries=0` |
| Failing (0/5) | | |
| Flaky (1-4/5) | | |
| Lint errors | | `npx eslint . -f json` |
| Hard waits | | `grep -rn waitForTimeout` |
| Brittle selectors (XPath, nth-child, long CSS) | | grep |
| Missing awaits | | no-floating-promises |
| Suite duration | | |

## Test inventory
| File | Test | Tag | Pass rate /5 | Failure signature |
|---|---|---|---|---|
| | | | | |

## Failure clusters
| Cluster | Signature (error + locator/helper + page) | Tests affected | Suspected cause | Stabilizer instance |
|---|---|---|---|---|
| C1 | | | | |

## Top 10 issues by stability impact
1. <!-- FILL -->

## Repo health notes
- Deprecated APIs: · TS strictness: · Independence (parallel / reversed): · CI state: · Secrets in code:
