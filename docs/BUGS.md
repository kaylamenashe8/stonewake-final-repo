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

### DRAFT-CG-02: Portfolio: no "Your alerts" section (needs confirmation: hidden when empty, or missing?)
- Environment: https://app.stonewake.ai/portfolio, Chromium (Playwright 1.64.1), 2026-11-04 19:30 IST, Finalist 4 workspace
- Found by: crawler (plan item T15, #9)
- Steps:
  1. Open Portfolio from the sidebar.
- Expected (organizers' at-a-glance map, areas 4 and 7): "Your alerts sits on this page"; "New alerts arrive under Your alerts".
- Actual: no "Your alerts" heading or text anywhere on the page. The page does call `GET /me/alert-feed`, which returns 200 `{"items":[],"total":0}`. With no alerts, no empty state is shown either.
- Severity: low; Priority: P3. Ask the judges first: if the section is meant to stay hidden until the first alert, this is not a bug, but an empty state ("No alerts yet") would still be expected UX.
- Linked test: tests/e2e/portfolio/portfolio.status-tiles.spec.ts (covers the tiles; the alerts part is not asserted until this is answered)
- Spira: pending
