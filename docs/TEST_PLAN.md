# Automation test plan

> Live plan: one GitHub issue per item, labels P1/P2/P3, created by `npm run plan:issues` from [TEST_PLAN.json](TEST_PLAN.json).
> This file is the Scribe's export (2026-11-04 19:55 IST), made with
> `gh issue list --label P1|P2|P3 --state all --json number,title,labels,state,closedByPullRequestsReferences`.
> Linked from the STP traceability matrix ([STP.md](STP.md#7-traceability-matrix)).
> T28-T34 were added to TEST_PLAN.json on the day (PR #30, D17/D18) and have no issue yet.

Status values: **merged** = test on `master` · **open PR** = in review, not on master · **not started** = no test written.
No test starts after 20:00 (TIMELINE), so every item still "not started" at 20:00 stays out of this submission.

| # | Item | Layer | Priority | Issue | Status | Test file | PR |
|---|---|---|---|---|---|---|---|
| T01 | Deal Book: filter by sector narrows the list | ui | P1 | [#1](https://github.com/kaylamenashe8/stonewake-final-repo/issues/1) | merged | tests/e2e/dealbook/dealbook.filter-sector.spec.ts | [#31](https://github.com/kaylamenashe8/stonewake-final-repo/pull/31) |
| T02 | Deal Book: open a deal shows brief, key facts, view at source | ui | P1 | [#2](https://github.com/kaylamenashe8/stonewake-final-repo/issues/2) | open PR | (in PR) | [#41](https://github.com/kaylamenashe8/stonewake-final-repo/pull/41) (re-open of #34) |
| T03 | Deal Book: Export downloads .xlsx (PDF parked, 429) | ui | P1 | [#3](https://github.com/kaylamenashe8/stonewake-final-repo/issues/3) | open PR | (in PR) | [#42](https://github.com/kaylamenashe8/stonewake-final-repo/pull/42) |
| T04 | Deal Book: sort order | ui | P2 | [#14](https://github.com/kaylamenashe8/stonewake-final-repo/issues/14) | not started | | |
| T05 | Screenings: company screening verdict cites sources | ui | P1 | [#4](https://github.com/kaylamenashe8/stonewake-final-repo/issues/4) | not started | | |
| T06 | Screenings: person screening never shows a rating | ui | P1 | [#5](https://github.com/kaylamenashe8/stonewake-final-repo/issues/5) | not started | | |
| T07 | Screenings: PDF report download | ui | P2 | [#15](https://github.com/kaylamenashe8/stonewake-final-repo/issues/15) | not started | | |
| T08 | Network: owners, officers, ownership chain with sources | ui | P1 | [#6](https://github.com/kaylamenashe8/stonewake-final-repo/issues/6) | not started | | |
| T09 | Institutions: Kind and Country filters | ui | P2 | [#16](https://github.com/kaylamenashe8/stonewake-final-repo/issues/16) | not started | | |
| T10 | Countries: risk score and cited indicators | ui | P1 | [#7](https://github.com/kaylamenashe8/stonewake-final-repo/issues/7) | not started | | |
| T11 | Countries: risk tile counts match table and API | ui | P2 | [#17](https://github.com/kaylamenashe8/stonewake-final-repo/issues/17) | not started | | |
| T12 | Countries: Export downloads .xlsx | ui | P2 | [#18](https://github.com/kaylamenashe8/stonewake-final-repo/issues/18) | not started | | |
| T13 | Monitoring: add a company, appears in Portfolio, remove | ui | P1 | [#8](https://github.com/kaylamenashe8/stonewake-final-repo/issues/8) | not started | | |
| T14 | Monitoring: pause, resume, change frequency | ui | P2 | [#19](https://github.com/kaylamenashe8/stonewake-final-repo/issues/19) | not started | | |
| T15 | Portfolio: tile counts equal /v1/portfolio/summary | ui | P1 | [#9](https://github.com/kaylamenashe8/stonewake-final-repo/issues/9) | not started | | |
| T16 | API: /health ok, /v1/health 404 envelope | api | P1 | [#10](https://github.com/kaylamenashe8/stonewake-final-repo/issues/10) | merged | tests/api/health.get.spec.ts | [#36](https://github.com/kaylamenashe8/stonewake-final-repo/pull/36) |
| T17 | API: deals list, detail, sort contract (zod) | api | P1 | [#11](https://github.com/kaylamenashe8/stonewake-final-repo/issues/11) | merged | tests/api/deals.list.spec.ts, tests/api/deals.detail.spec.ts | [#36](https://github.com/kaylamenashe8/stonewake-final-repo/pull/36) |
| T18 | API: screenings, network, ownership contracts | api | P1 | [#12](https://github.com/kaylamenashe8/stonewake-final-repo/issues/12) | merged | tests/api/screenings.list.spec.ts, tests/api/network.get.spec.ts, tests/api/ownership.get.spec.ts | [#36](https://github.com/kaylamenashe8/stonewake-final-repo/pull/36) |
| T19 | API: viewer key is read-only (403 on writes) | api | P1 | [#13](https://github.com/kaylamenashe8/stonewake-final-repo/issues/13) | not started | | |
| T20 | API: 422 envelope on bad filters; rate-limit headers | api | P2 | [#20](https://github.com/kaylamenashe8/stonewake-final-repo/issues/20) | merged | tests/api/deals.filters.spec.ts, tests/api/ratelimit.headers.spec.ts | [#36](https://github.com/kaylamenashe8/stonewake-final-repo/pull/36) |
| T21 | MCP: same entity as REST | api | P2 | [#21](https://github.com/kaylamenashe8/stonewake-final-repo/issues/21) | merged | tests/api/mcp.entity.spec.ts | [#36](https://github.com/kaylamenashe8/stonewake-final-repo/pull/36) |
| T22 | Auth: session persists, deep link after login | auth | P2 | [#22](https://github.com/kaylamenashe8/stonewake-final-repo/issues/22) | not started | | |
| T23 | Team selector switches Deal Book without leaking | ui | P2 | [#23](https://github.com/kaylamenashe8/stonewake-final-repo/issues/23) | not started | | |
| T24 | Tenders: open notice, Add / Dismiss | ui | P3 | [#24](https://github.com/kaylamenashe8/stonewake-final-repo/issues/24) | not started | | |
| T25 | Settings: connected assistants read-only | ui | P3 | [#25](https://github.com/kaylamenashe8/stonewake-final-repo/issues/25) | not started | | |
| T26 | a11y: no critical/serious axe violations on key pages | a11y | P3 | [#26](https://github.com/kaylamenashe8/stonewake-final-repo/issues/26) | not started (kit has tests/a11y/home.a11y.spec.ts) | | |
| T27 | Visual baseline of login and Countries | visual | P3 | [#27](https://github.com/kaylamenashe8/stonewake-final-repo/issues/27) | not started (kit has tests/visual/home.visual.spec.ts) | | |
| T28 | Deal/company PowerPoint download | ui | P3 | none | not started | | |
| T29 | Deal Book: follow / unfollow a deal | ui | P3 | none | not started | | |
| T30 | Monitoring Sentiment: Monitor a name adds a RUN_ID row | ui | P1 | none | not started | | |
| T31 | Monitoring Sentiment: pause / resume a name | ui | P1 | none | not started | | |
| T32 | Security: script/HTML in inputs is rendered inert | ui | P2 | none | not started | | |
| T33 | Security: API refuses missing/malformed/viewer keys on writes | api | P2 | none | not started | | |
| T34 | Security: session cookie flags, sign-out invalidates | auth | P2 | none | not started | | |

## Baseline suite (not plan items)
The 20 original tests (10 UI, 10 API, [BASELINE.md](BASELINE.md)) were moved, not removed:
UI to `tests/e2e/auth/` and `tests/e2e/modules/` ([#37](https://github.com/kaylamenashe8/stonewake-final-repo/pull/37), [#44](https://github.com/kaylamenashe8/stonewake-final-repo/pull/44)),
API to `tests/api/legacy-api/` ([#32](https://github.com/kaylamenashe8/stonewake-final-repo/pull/32)). Fixes: [FIXES.md](FIXES.md).

## Totals at export
| Priority | Items | Merged | Open PR | Not started |
|---|---|---|---|---|
| P1 | 15 | 4 (T01, T16, T17, T18) | 2 (T02, T03) | 9 |
| P2 | 13 | 2 (T20, T21) | 0 | 11 |
| P3 | 6 | 0 | 0 | 6 |
| **All** | **34** | **6** | **2** | **26** |
