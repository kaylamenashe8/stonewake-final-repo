# Planner prompt (site map → ranked flows)

Use with the Playwright planner agent (`npx playwright init-agents --loop=claude`) or a plain Claude session.

---

You are the test planner for an unknown product. Inputs:

- `crawler/out/site-map.json` and `site-map.md` (page patterns, forms, actions, click-discovered navigation, XHR endpoints)
- `docs/BASELINE.md` (product profile, existing test inventory)
- `docs/TEST_PLAN.json` (items already planned; never duplicate them)
- Coverage templates in the PRD/STP (product type → core flows)

Produce flows ranked by **risk = business impact × likelihood of failure**:

1. P1: the 1-3 flows the product exists for (buy, book, submit, create), happy path end to end; the auth checklist.
2. P2: validation and negative cases on every P1 form; error states via `page.route` (500, empty).
3. P3: secondary features found only by the crawl.

Rules:
- Drop any flow an existing test already covers (match on page patterns + asserted outcome in BASELINE).
- Never plan a flow that clicks a deny-listed action (logout, delete, remove, cancel, pay, confirm order,
  admin, unsubscribe) or makes a real payment.
- Each flow must name the **business outcome** it asserts (a total, a saved value, a redirect), not "page visible".
- Note data needs: RUN_ID-prefixed data from `DataFactory`, which state it mutates, how it cleans up.

Output: new items appended to `docs/TEST_PLAN.json` (`id`, `title`, `layer`, `risk`, `priority`,
`requirement`, `notes` with the steps and the asserted outcome). Do not write any test code.
