# Stonewake demo video: UI map (from promo.av1.mp4, 2:17)

Frames read every 4 s; the audio was not transcribed. Demo data, not the competition workspace: use it to learn the screens, not as expected values.

## Navigation (left sidebar, every page)
- **Pipeline:** Deal Book · Countries · Counterparties · Network
- **Coverage:** Monitoring · Portfolio Monitoring · Screenings · EDD Dossiers · Scoring
- **Account:** role shown (e.g. "Analyst") · How it works · Report an issue

## Flow 1: Deal Book
- Title "Deal Book", subtitle "Deals surfaced from official sources by the engine, every fact cited." **Export** button top right.
- Filters row: Search deals… · All stages · All sectors · All regions · All countries · Open deals · Reopen suggested · SORT (default **Score**).
- Columns: Deal (name + country · sector · summary line, a dot marks unseen updates) · Stage (Financing / Tender) · Value ($1.1bn, $440m) · Parties · Score (bar + number, highest first) · Last activity (3d ago).
- The video filters by stage (Financing) to show "Filter to your mandate".

## Flow 2: Screenings
- Page per company, e.g. "Tidewerk Fundamentbau GmbH", with "Organization · Counterparty screening · …  Requested 14 Jul 2026", **Download report**.
- **Summary** paragraph (overall red verdict, drafted from cited findings; "The analyst review below is the decision").
- Note: "Adverse media only. Not a sanctions or PEP check, and not a decision."
- **Adverse media**, nine categories, each with a verdict pill (Red / Amber / Green), "CONFIRMED", a sentence, "N cited findings" expander and a **Dismiss** button: Corruption, Financial distress, Litigation, Bribery, Fraud, Money laundering, Sanctions exposure, Human rights, Environment and ESG.
- Footer: "Confirm endorses a category verdict. Dismiss removes the category from the overall verdict. Both are reversible and every change is audited."
- Company pages also have **Screen again**.

## Flow 3: Network and Institutions (Counterparties + Network)
- Counterparty page (e.g. Windpark Wattgrund GmbH): status ACTIVE, register ids (de_register:HRB 3417 AURICH), **Watching** toggle, **Download report**.
  - Credit monitoring: "Score 88 / 100", signal coverage %, Red cap reason (Bankruptcy / insolvency proceedings), "Computed … profile v2".
  - Adverse media block, ownership (e.g. "Baltic Crest Invest S.à r.l. 25.5% … meets 25% threshold", individual owner), small Network graph, **Register events** (since your last review, alerts), **Recent research** (Verified · N source).
  - Clicking "1 source" opens a side drawer: register record with Case, Company, Court, Proceeding, Published, Register, **View at source** and the source URL.
- Network page "Network: <company>": Watching · **Export CSV** · "How are A and B connected?" · "Explore another company".
  - Controls: Min ownership %, Current / All history / As of; "12 of 12 loaded · 11 relationships · solid current, dashed ended, all register-cited".
  - Graph nodes show name, country ISO3, ACTIVE; edges labelled "Shareholder of 74.5%", "Parent of 100%". Zoom +/−/fit.
  - "Cited relationships" table (From · Relationship · To). Clicking an edge opens the register record (Identifier, Register wording, Ownership, Valid from/to, View at source).
  - The graph is a canvas (docs admit no text alternative): test it via the table and the API, not the canvas.

## Flow 4: Countries
- List: tiles High risk / Elevated / Moderate / Unscored (value and % of book, country count), **Export**, "Search countries…".
- Table grouped by region (Europe, Turkey, CIS & Central Asia, SCC, Middle East, North Africa, Sub-Saharan Africa…): Country · Country risk · Deals · Reported value · Lists.
- Country page (e.g. Egypt, "North Africa · 1 live deal in your book", Download report, Monitored daily): "Country risk 48 / 100" with one row per component and its points: CPI +17.5, WGI +13.6, FATF +0.0, EU high-risk +0.0, sanctions programs +0.0, sovereign rating +9.6, verified adverse news +7.2.
  - **The rows add up to the score** (17.5+13.6+9.6+7.2 = 47.9 → 48): a strong assertion.
  - Then "Sanctions and AML list status", "Country indicators" tiles, "Deals in Egypt" (Open in Deal Book).

## Flow 5: Monitoring and Portfolio
- Monitoring: "The sources and entities we check daily…": Entity · Type (Company / Agency-ECA / Country) · Frequency (Daily) · Last checked (2h ago, Next in 22h) · Status (OK) · Active.
- Portfolio Monitoring: Red / Amber / Green count tiles, "12 active exposures · 2 status changes in 30 days", **Scoring profile**, **Export**.
  - Columns: Entity (+ register id) · Desk (Project / Export Finance) · Status · Score · Signal coverage · Attention signals · Last status change ("Green to Red · 14 Jul 2026", "First assessment: Green").
  - Here a **higher score means riskier** (Red 88, Green ~10). In the Deal Book a higher score means a better fit. Do not mix them up in assertions.
  - Rows are red first.

## Testing notes from the video
- Every claim has a source drawer: check that "N source(s)" opens and that the count matches the drawer.
- Tile counts must equal table rows (Portfolio R/A/G, Countries tiles).
- Exports exist on Deal Book, Countries, Portfolio and Network (CSV): check that a download starts and its rows match the screen.
