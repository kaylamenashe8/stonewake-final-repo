# Stonewake product notes (read before testing)

Read in this order:
1. `JUDGES_FOCUS.md`: the six flows the judges want, the deliverables (improved code, updated STP, bug report) and the environment rules.
2. `notes-B.md`: product features (Deal Book, Portfolio, Countries, Network, Monitoring, alerts, imports), mapped to flows F1-F6.
3. `notes-A.md`: authentication, API keys, every /v1 endpoint and the 38 MCP tools, with UI/API/MCP parity test ideas per flow.
4. `notes-C.md`: errors and rate limits, security, roles and SSO, accessibility (WCAG 2.1 AA), changelog (bug-prone areas), terms of use.
5. `DEMO_VIDEO.md`: screen-by-screen map of the UI from the demo video (sidebar, filters, columns, buttons per flow).
6. `AT_A_GLANCE.md`: the organizers' one-page map of the 10 dashboard areas (adds Tenders, Institutions, Settings, export formats) and the testable rules it states.

Source: the public docs (docs.stonewake.ai, llms-full.txt) and site, read on 2026-11-04 as background only. They are not a test target.

Testing cautions from the docs:
- API rate limit per key: 120 requests/minute; workspace: 50,000/day (`RateLimit-Policy` header is the authority). Keep API tests lean in the 5x gate.
- The terms of use forbid scraping the dashboard and probing infrastructure; the competition workspace is the agreed test target, but ask the judges before load or security scans.
- `node_id` and `entity_id` are both integers; a wrong-space id can return another company. Assert the returned name.
