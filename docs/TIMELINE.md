# Competition-day timeline (print this)

Final: Wednesday 4.11, 18:00. Form by **20:55** (hard close 21:00). Code freeze **20:20**. At most 6 heavy agents at once.

| Time | Phase | Kayla does | Agents active | Exit gate |
|---|---|---|---|---|
| 17:25-18:00 | 0 Brief | Read materials, fork repo, `scripts/apply-kit.sh`, `scripts/setup-secrets.sh`, ask judges (17:50) | None | Repo public, secrets set, judge answers in DECISIONS |
| 18:00-18:20 | 1 Recon | Watch baseline, confirm Pages and repo public | Recon | BASELINE.md committed, tag `baseline`, first CI run linked |
| 18:20-19:50 | 2 Parallel lanes | Merge every ~15 min with `/review`, file Spira bugs | Architect, Stabilizer, CI/Infra, Triage, Coverage, Crawler, API, Bug Reporter, Scribe | First parallel gate at **19:15** shows what still fails |
| 19:50-20:20 | 3 Integrate | Final merges, fix gate failures and remaining flaky existing tests, drop flaky new ones | Stabilizer, Visual/Bonus, Scribe | Second parallel gate at **20:00** is 5/5 |
| 20:20-20:40 | 4 Freeze + final gate | No code changes. Fill README numbers, rehearse video | Scribe, Bug Reporter | Gate 5/5 green |
| 20:40-20:55 | 5 Wrap-up | Record video, incognito link check, submit form | None | Form submitted by 20:55 |

**Cutoffs:** no new test starts after **20:00**. Review-queue tests may merge until 20:20.

**If the final gate goes red:** fix only the failing test (Spira-skip it only if it is a product bug; drop it only if it is a new test), then rerun. Still red at **20:35** -> submit the latest green gate run as the link and say so plainly in the README.

**Sequential gate required by judges?** Code freeze moves to **20:10**.

## Submission links (fill as you go)
1. Repo: 
2. Gate run (5/5): 
3. Pages report: 
4. STP: 
5. BUGS / FIXES: 
6. Video: 
