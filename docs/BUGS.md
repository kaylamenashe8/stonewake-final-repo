# Product bugs (SpiraTest)

> Owner: Bug Reporter. System of record: SpiraTest (D10). Filed with `npm run spira -- --submit <id>` after Kayla's approval.

| Spira ID | Title | Severity | Found by | Jam | Linked test | Status |
|---|---|---|---|---|---|---|
| <!-- SPIRA-? --> | | | test / crawler / exploratory / triage | | | draft |

## Drafts

<!-- Copy this block per bug (or run `npm run spira -- --template`). The draft id (DRAFT-01...) is what spira-file.ts takes: `npm run spira -- --from-bugs docs/BUGS.md --id DRAFT-01 [--submit]`. -->

### DRAFT-01: <Component>: <symptom>
- Environment: <URL>, Chromium <version>, <date>, commit <sha>
- Preconditions: <state needed>
- Steps:
  1. <step>
  2. <step>
- Expected: <expected result>
- Actual: <actual result>
- Severity: high
- Priority: P2
- Jam: https://jam.dev/c/<id>
- Screenshot: test-results/<test-dir>/test-failed-1.png
- Report: https://<user>.github.io/<repo>/runs/<run_id>/#?testId=<id>
- Linked test: tests/e2e/<feature>/<file>.spec.ts
- Spira: pending

### DRAFT-CG-01: Deal page: Download report fails silently when the report endpoint is rate limited (HTTP 429)
- Environment: https://app.stonewake.ai, Chromium (Playwright 1.64.1), 2026-11-04 18:39 IST, Finalist 4 workspace (team itac-4), commit a6ed91c
- Found by: crawler (promotion run of `dealbook.report-pdf.spec.ts`, 10 downloads in ~40 s, 1 worker)
- Preconditions: logged in; any deal page (seen on /deals/5df4ec755205)
- Steps:
  1. Open a deal from the Deal Book.
  2. Click **Download report** about 8-9 times within a minute (or once more after other report downloads by the same user).
- Expected: the PDF downloads, or the user sees a clear message such as "Too many downloads, try again in 9 s".
- Actual: `GET https://api.stonewake.ai/deals/<id>/report` returns **429** with `Retry-After: 9`. No file is downloaded, the page's alert region stays empty, and the button gives no feedback. The click silently does nothing.
- Severity: low (UX / error handling); Priority: P3
- Evidence: trace `test-results/promote/dealbook.export-Deal-Book--b158f--Download-report-is-clicked-chromium-repeat8/trace.zip` (network tab: report request 429, retry-after 9), error-context.md in the same folder (empty `alert`). Jam: to record (Bug Reporter).
- Linked test: tests/generated/dealbook.report-pdf.spec.ts (parked: the 10x promotion burst trips the limit; one PDF download per gate run would not)
- Spira: pending
