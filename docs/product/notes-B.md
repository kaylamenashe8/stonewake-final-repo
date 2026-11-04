# Stonewake test notes B (llms-full.txt lines 715-1491)

Source: `/Users/kaylamenashe/workspace/stonewake-prep/llms-full.txt`, lines 715-1491, read in full.
Sections covered: Deal Book, Portfolio, Credit reviews and status changes, EDD dossiers, Monitoring, Network, Countries, Tender profiles and matches, Teams and webhook alerts, Alerts by SMS, Alerts by email, News monitoring, Social monitoring, Book import, Tender portal exports, Your own sources.

Flow tags used below:
- **[F1]** Deal Book (search/filter, open deal with summary + sources, export)
- **[F2]** Screenings (background check, result with sources)
- **[F3]** Network and Institutions (company profile, financing, ownership chain)
- **[F4]** Countries (risk score + indicators)
- **[F5]** Monitoring and Portfolio (add company to monitoring, receive updates)
- **[F6]** Same data via API and MCP (read-only)

Note on F2: these sections say little about Screenings directly. Relevant bits: the Portfolio row shows the company's "latest complete screening" beside the status (never part of it); EDD dossiers run "global screening"; "Screen all parties" on a deal lists each party once. Screenings proper are documented elsewhere in the file (not in this range).

---

## Cross-cutting facts (apply to many areas)

- **Parity rule [F6]:** Deal Book rows over `GET /v1/deals` and MCP tool `deal_book` have "the same values, dates and order" as the UI. Good parity test target: same filters in UI and API, compare ids, order, `value_text`, `last_event_at`.
- **Read-only API/MCP [F6]:** Over `/v1` and MCP nothing is written for: tender profiles/passes/to-deal-book, alert channels, book import (`dry_run` always true), tender portal uploads (`dry_run` always true). Expect no write endpoints there.
- **Tenant isolation:** News, social: "Any other company/name answers 404, so the routes never show which companies another workspace follows". A key reads its own team's rows plus workspace-wide ones (alerts, tenders, news events).
- **Roles mentioned:** viewer (reads only), analyst (records reviews, requests dossiers, ack changes, dismisses tender matches), compliance member (reads dossiers of every team; can own reviews), workspace administrator (alert channels, approves SMS numbers, portal accounts, licensed data, ack across teams), "edit access" (add to book, pause/resume monitoring, register watch, research country).
- **Person data switch:** natural persons shown/followed only in workspaces where person data is switched on (Network, Monitoring, News, Social). Persons/sole traders never scored.
- **No model in scoring/deterministic paths:** status-change cause, tender judging, tender-to-deal-book, deck generation ("fixed rules from stored data with no model step"), risk score uses no model/news/social. Model is used only in the news check (Claude Haiku 5.5) and social post labeling.
- **Alert language default:** German on German time unless admin chose English / UK time.
- **Demo workspace:** email and SMS switched off; Teams and webhook go to the Stonewake test receiver only; licensed data answers from provider's published sample.

---

## 1. Deal Book [F1] (doc: "Deal Book", lines 715-760)

### 1.1 What it does / user flow
1. Open Deal Book: team's list of origination leads assembled from public sources (tenders, contract awards, financings, ECA cover). Every fact links to its source.
2. Search / filter (stage, sector, region visible; institution, country, status behind **Filters** button with a count badge). Optional **Order** field.
3. Point at a row: two actions, **Follow** and **Dismiss**.
4. Open a deal page: Stage, Key facts, parties, score reasons, Rate and source, Project register, tender line, **Update research**, **Download report** (PDF), **Download deck** (PPTX).
5. **Export**: Excel workbook of the deals the page shows.
6. Following tab: followed deals (newest update first) and followed names.
7. Reopen suggested view: dismissed deals with new evidence; **Reopen and follow**.

### 1.2 Columns / data model
- **Deal**: one-line name; country and sector below where sources state them. Multi-country deals list each; API `countries` and `countries_iso3` same countries, same order, one entry each. Unresolvable place (region) stays as written with no code (so `countries_iso3` entry missing/empty for that one; check alignment).
- **Financing window** (list words, enum of 4): `Financing open`, `Early stage`, `Not confirmed`, `Financing set`. Hover shows the detailed state = what the deal page calls **Stage**.
- **Value** (USD, one figure):
  - Never prints sources' own words in the cell. If not one dollar figure (words only, several amounts) -> cell empty, hover explains, deal page shows source wording under **Key facts**.
  - Unconfirmed by a quote -> shown **muted**, reason on hover.
  - Empty with hover **Value not reported** = no amount reported.
  - Cells never widen columns (long entry never pushes Last activity out of view) -> layout test.
  - API fields: `value_text` (print value), `value_status` (whether a quote confirms), `contract_value_usd`, `contract_value_bound` (`at_least` | `up_to` | `range`), `contract_value_usd_min`, `contract_value_usd_max`, `contract_value_usd_unread` (`several_amounts`, `price_per_unit`, `not_one_figure`, `no_currency`, `shared_currency`, `no_rate`), `contract_value_conversion` (`stated_usd`, `source_usd`, `reference_rate` + `currency`, `rate`, `quote` e.g. "USD 1.1130 per EUR", `rate_date`, `rate_source`), `amount`, `amount_min`, `rounded_to`, `value_note`.
  - Conversion priority: amount in USD -> source's own bracketed USD figure -> ECB euro reference rates of **29 October 2026** / official fixed parity (Gulf pegs, CFA franc, Bulgarian lev, pataca...) / IMF SDR USD value for that day (also AfDB UA) / US Treasury Reporting Rates of **30 September 2026** or later amendment.
  - Number parsing: `527 633,67 EUR` and `CHF 545'400` = one number; `Lot 2 150 000,00 EUR` ambiguous -> no figure.
  - Rounding: to the last place the source states, never coarser than the Deal Book prints. Examples: GBP 82m -> `109000000`; EUR 1bn -> `1100000000`; cents kept where stated to the cent or in dollars.
  - Bounds: "exceeding EUR 1bn", "more than SEK 100 million", "EUR 900+ million" -> `at_least`, `contract_value_usd` empty, `contract_value_usd_min` rounded **down**. "up to $1.1bn" -> `up_to`, max rounded **up**. "between EUR 50m and EUR 150m" -> `range`, both ends. UI prints "at least $1.1bn", "up to $3.1bn", "$55m to $167m".
  - Empty `contract_value_usd` for: several amounts/ranges, change from one figure to another, price per unit, unreadable ("USD 500 odd million"), no rate.
  - Shared currency sign/word (Rs, P, lira, lei, pesos, kronor w/o country) -> no conversion (`shared_currency`). `Rs 715 crore` stays as words; `INR 73.52 crore` and `₹1,650 Cr` convert.
  - Currency words/signs that do convert: "6.9 trillion won", "2 billion reais", "FCFA 93 million", "TL 17 million".
  - Value also read from "money backing the deal" (e.g. "£129m will back the project", "UKEF is providing £20m").
  - `value_note`: why a row shows no Value though summary states an amount (e.g. project/investment size).
  - Pre-rule stored figures: `contract_value_conversion` empty until re-read (legacy data case).
  - **Sort / `min_value_usd` / value floor / totals / ticket fit** all read the **highest** figure (amount, bound, or upper end of range). Example: "more than USD 1.1 billion" passes a USD 500m floor. Sort key exact to the cent.
- **Parties**: first ECA, lender or exporter named + count of the rest. Descriptions ("an international commercial bank") not listed. "Ltd" vs "Limited" = one exporter. "EXIM" alone = the ECA the source names in full (US EXIM beside US words). ECA cover stage needs a named ECA; unknown stage confidence max low. A sole lender on a row: angle names it with its kind; summary names it rather than "lender role open".
- **Score**: 0-100. Bands: **Strong fit >= 70**, **Worth a look >= 45**, **Weak fit >= 20**, **Not a fit < 20**. A deal outside the team's mandate (market or sector) **never** reads Strong fit regardless of score; mandate reason says which.
- **Last activity** (`last_event_at`): newest source-confirmed event date; else day newest reported event was first published (repeated old report doesn't refresh). Report-stated event day in an earlier month counts (words or figures like `20/02/2019`); ambiguous `05/03/2019` counts for nothing. Search snippets and index pages never date a deal. Page stamped with year alone (1 January) dates nothing.

### 1.3 Business rules / invariants
- **Default order:** groups Financing open -> Early stage -> Not confirmed; highest score first within group.
- **Real estate desk order:** exchanged sales and refinancings -> under offer -> marketed -> rest in default order. Financing set/cancelled never rises above them. Other desks unchanged.
- **Search:** every typed word as a whole word, anywhere (AND semantics); `"phrase"` as written. `NIS` finds the shekel code, never "Ministry". Searchable fields: deal name, buyer, summary, exporter, agency (printed name or other registry names). Never a source spelling the row doesn't show.
- **Stage filter** offers only the financing-window words the list shows; chosen window lists only rows that read it.
- **Sector filter** under All teams: sectors of every team's desk.
- **Filters badge count** = number of institution/country/status filters narrowing. **Order** never counts as a filter.
- Empty result: names the filters set and offers to clear them.
- Each page of the list has its own address; browser Back returns to previous page (pagination URL test).
- **Order** options: highest / newest / furthest stage first; names A-Z. API: `sort` + `direction` both directions.
- **Held back by default** (page says how many): financing set or cancelled; own bank already lends; domestic; last activity older than stale window (default **12 months**); no movement 12 months; below team value floor. Project Finance desk: works lot with no financing need (scaffolding, doors, landscaping, paving) -> reason "Works contract, no financing need" (unless lender/financing/concession named). Real estate desk: outside mandate market; non-property deals (energy, industrial, infra, company takeover).
- One click shows hidden. API: `include_hidden=true`; each row explains via `score_hidden` and ranking reasons.
- Summary saying financing closed / cover provided -> Financing set if no source quote confirms more than an announcement; reason names date. **Summary never opens or advances a deal.** A source quote holding it open (tender, award, mandate, arranging, cover in principle) stays open whatever the summary says.
- Age dating from summary: year alone -> end of year ("2025" = end of 2025; "December 2025" = last day). Reason e.g. "No movement since 2010". Year counts only when dating an event ("in 2019"), not in names/figures ("Natura 2000", "2000 kW"). Plan/deadline/range/law/background dates count for nothing; briefing never read for a date.
- **Scoring page (rubric per team):** five parts summed; weights 0-100 summing to 100; factors 0-1; out-of-range field marked before sending (client validation). **Preview effect** shows deals moved most; **Save and activate** -> book reorders same as preview. **Built in default** restores launch rubric. Every saved version listed, one **Activate** away. Unsaved draft kept in that browser tab (sessionStorage-like).
- **Parties dedup:** each party once on page, API, MCP, report, Screen all parties. Acronym/ticker in brackets = same company. Place/company in brackets, subsidiary, JV, consortium = separate party. Offtaker/processing partner under own roles, never buyers. Missing exporter/EPC -> parties say so. Hermes cover = German federal ECA guarantees (Euler Hermes AG); **KfW IPEX** separate from KfW.
- Deal country: from its own lines only, never another project's line or a party's seat.
- **Institutions [F3]:** an agency's deal count == number of deals Deal Book finds filtered by that agency, any role. Strong cross-page invariant.
- **Institution involved** filter: "ECA named" + every registry institution with counts; multi-select OR semantics; = API `eca` param repeated per agency.
- Converted dollar figures show rate, rate date, source under **Rate and source** (deal page) and on hover (list).
- Party matched to a register under same name in another role is that party; not re-listed in Match parties / `GET /v1/deals/parties/binding-queue`.
- **Project registers:** UK/US generation or storage -> UK REPD or EIA 860M record under **Project register**, API `project_records` on `GET /v1/deals/{deal_id}` and MCP `deal_book`. Shows status, first-edition date, planned vs first-reported operation month and months moved, in-operation month, capacity, operator, edition date, data date, link. **Delayed** = beyond two quarters, or canceled/abandoned/out of service/retired (same rule as portfolio project signal). Links only on exact project-name match (minus tech words and sponsor) and fitting technology.
- **Agency publications:** Hermes Category A projects published >= 30 days before final decision; open a deal with Hermes cover. Finally covered item joins a deal only if it names that deal's party, country, assets.
- **Phone:** each deal one block, full name first line, then stage, value, parties, score, last activity; nothing cut. Same for Portfolio, screenings list, officers and ownership (responsive viewport tests).
- **Follow:** listed under Following tab newest update first. Hint on deal page Follow states research frequency.
- **Dismiss:** requires one reason; removes from book. Own-workspace deal: stops its research. Shared-pool deal: pool research continues.
- **Reopen suggestion** (once) when: later stage, value first at **USD 200m or more**, or fresh coverage of a deal set aside as historical. Shows in **Reopen suggested**; **Reopen and follow**.
- Merged deals or Stonewake-dismissed shared-pool deals: cannot be reopened or followed; page says why.
- **Merge precedence:** following > dismissal > untriaged. Followed deal never leaves Following via merge. Dismissal as duplicate/historical carries nothing. Next step: survivor keeps own; takes other's if none. Split restores carried state unless team changed it since.
- **Update research:** own-workspace deal researched once now; no schedule change.
- **Export (Excel):** deals the page shows; dashboard language (German headers when UI German). Columns include **Reported value**, **Value (USD)** (one amount), **Value from (USD)** / **Value to (USD)** (bound/range), **Rate** (rate, date, source, or "stated in dollars"). Numeric cells sortable/summable.
- **Download report** -> PDF. **Download deck** -> PPTX via fixed rules. API `GET /v1/deals/{deal_id}/deck.pptx` needs key with **reports** scope.

### 1.4 API / MCP
- `GET /v1/deals` (params seen: `sort`, `direction`, `include_hidden`, `min_value_usd`, `eca` (repeatable), `status` incl. `tracking` for followed)
- `GET /v1/deals/{deal_id}` (`project_records`)
- `GET /v1/deals/{deal_id}/deck.pptx` (reports scope)
- `GET /v1/deals/parties/binding-queue`
- MCP `deal_book`

### 1.5 Edge / negative / security tests
- Search `NIS` must not match "Ministry"; multi-word AND; quoted phrase exact; word only in hidden source spelling must not match.
- Filters badge count excludes Order; empty-state names filters and Clear works; Back after paging.
- Stage filter: every row shown reads chosen window.
- Score band boundaries: 19/20, 44/45, 69/70; out-of-mandate deal with score >= 70 not "Strong fit".
- Value: bound rows have null `contract_value_usd` but min/max set; min floored, max ceiled; `value_status` unconfirmed -> muted UI.
- `min_value_usd=500000000` must include "more than USD 1.1bn" (upper bound used).
- Sort by value: range sorted by upper end.
- `countries.length == countries_iso3.length`? Doc implies same order "one entry each" but unresolved region "stays ... with no code": check how API represents the missing code.
- Scoring page: weights not summing to 100 / weight > 100 / factor > 1 / negative must be blocked before send. API key without reports scope on deck.pptx -> expect 403.
- Dismiss without reason blocked. Follow/reopen on merged deal blocked.
- Export language switches with UI language.
- Mobile viewport layout.

### 1.6 Confusing / contradictory
- Last activity: "where a report names the day of its event in a later month than the page that carries it, that day counts, since a page cannot report an event before it happened" reads self-contradictory (a later-month event than the page would be in the future). Treat as unclear; don't assert.
- Financing set/cancelled are hidden by default, yet the RE-desk ordering rule says they "never rise above" sale stages: only observable with hidden shown.
- `contract_value_conversion` empty for legacy figures: tests asserting it always present may fail.
- "Stage" (deal page) vs "Financing window" (list) are different granularities of the same thing.
- Tender-derived stages (Planned, Tender open, Contract awarded) are "your desk's own stages", which map onto the four window words in an unspecified way.

---

## 2. Portfolio [F5] (doc: "Portfolio", lines 764-783)

### 2.1 Flow
1. Portfolio page shows counts, the book, Status changes, Reviews due.
2. **Add a company to the monitored book** (edit access): find company -> add. Register records watched and scored on every recompute.
3. Open company page from row: signal breakdown, review record, register records; **Download deck** (credit monitoring slides), **Start EDD dossier**.
4. **Import book** (see section 13), **Edit terms** per row.

### 2.2 Data model
- Six statuses (see 3.2): Green, Amber, Red, No score yet, Not yet assessed, Sole trader.
- **Counts strip:** active exposures per status; then one line: status changes last 30 days, reviews overdue, unscored sole traders. Open sanctions name matches of persons linked to the book stay in view until reviewed.
- **Book row:** company, status, score, what needs attention, last change; plus latest complete screening beside the status (never part of the status) [F2].
- **Status changes:** each change with cause. **Reviews due:** overdue or due within **two weeks**; also counts exposures with no credit review on record.

### 2.3 Rules
- Status recomputed from cited register records, never estimated.
- Same company under another register record (e.g. SEC filer record beside LEI record) is not added twice; the add names which company the book holds; records joined by identity rule.
- Company deck: `GET /v1/nodes/{node_id}/risk-deck.pptx`.

### 2.4 API / MCP
- `GET /v1/portfolio`, `GET /v1/portfolio/summary`, `GET /v1/portfolio/transitions`
- `GET /v1/nodes/{node_id}/risk-deck.pptx`
- MCP `portfolio_overview`, `portfolio_book`

### 2.5 Edge cases
- Add same company via LEI then via CIK -> no duplicate; message names existing company.
- Viewer cannot see/use Add (edit access needed).
- Counts strip numbers == API summary numbers == row counts by status.
- Screening shown beside status must not change status.

---

## 3. Credit reviews and status changes [F5] (doc: "Credit reviews and status changes", lines 787-842)

### 3.1 Flow
1. Status changes feed shows each change with a one-line cause.
2. Analyst acknowledges changes one by one or "all open changes shown on the page".
3. Company page: record a review (disposition, note, owner, next review date); history list.
4. Remove from book (with reason); re-add.

### 3.2 Statuses (UI name -> API `status`)
| UI | API | Meaning |
|---|---|---|
| Green | `green` | assessed |
| Amber | `amber` | assessed |
| Red | `red` | assessed |
| No score yet | `insufficient` | assessed but too little observed; if no annual accounts: `no_status_reason` = `no_accounts` |
| Not yet assessed | `not_assessed` | no assessment yet |
| Sole trader | `sole_trader` | natural person's business per register; never scored; identity and review stay |

Status-change moves are between Green, Amber, Red, No score yet.

### 3.3 Cause of a change (deterministic, no model)
- **Drivers**: signals whose change moved status; each with band before/after and citation ids. Worsening: signals turning more adverse or triggering override + signals that stopped scoring green. Improving: mirror. Move into No score yet: signals that could no longer be observed. All drivers stopped scoring -> "7 signals stopped scoring" style text. Lead driver same band but override changed -> e.g. "Bankruptcy / insolvency proceedings now forces Red".
- **Register record** behind lead driver named (register + reference). Evidence-absent signal cites nothing and says so.
- **Scoring rules changed** stated first when engine or rubric differs. Standard rubric vs team-saved rubric = different. No score yet assessments never compared by rubric.
- Max **5 drivers** named; rest counted. Both assessment ids served with the cause. Unreadable assessment -> **Cause not available** and nothing else.

### 3.4 Additions / removals
- First assessment = **Added to the book** with first status (+ signals for Amber/Red). Not a change: never needs ack, not in "status changes of last 30 days", but **is** in "all transitions of last 30 days". API: `status_changes_30d` excludes, `transitions_30d` includes.
- **Remove from book** reasons: **Added by mistake**, **Exposure ended**. Auto-join of two records: **Same company as another entry**. Feed shows **Removed from the book** with status at removal; disclosure shows who/why. Re-add: **Added back to the book**; continues same entry; history retained. These never need ack, never raise alert.

### 3.5 Acknowledgement
- Only real changes of own team still open are stamped; admin can ack across teams. Each ack writes its own audit entry (bulk too).

### 3.6 Review record
- From join day: adder owns first review, due **one year later**; record reads **Added to the book** (API `added`).
- **Disposition** enum: Reviewed, no action; Watch list; Intensified care; Escalated to credit. (EBA GL/2020/06 paras 270, 272, 275; MaRisk BTO 1.2.4.)
- **Note**: free text up to **2,000** chars.
- **Owner**: current workspace member who could record the review = analyst or compliance member of exposure's team, or workspace admin. Removed-account member not offered and refused.
- **Next review date**: between today and one year from today (MaRisk BTO 1.2.2).
- Append-only; no edit/delete; correction = newer review. Viewers read, record none.
- **Overdue** = standing review's next date passed. Reviews due list: overdue + due within 2 weeks, soonest first; counts never-reviewed (only the join record counts as never reviewed). Same team scope as page; under All teams rows name team. Dates compared in **UTC**.

### 3.7 API / MCP
- `GET /v1/portfolio/transitions` -> `cause`
- `GET /v1/portfolio` -> `review`, `review_overdue`
- `GET /v1/portfolio/summary` -> `transitions_30d`, `status_changes_30d`, `reviews_overdue`
- `GET /v1/portfolio/{exposure_id}/reviews` (join record `added`)
- `GET /v1/portfolio/reviews-due`
- Owners/reviewers identities NOT served on API ("stay in the dashboard").
- MCP: `portfolio_overview` (causes + overdue count), `portfolio_book` (standing review), `exposure_review_history`, `portfolio_reviews_due`.
- Committee pack prints standing review and recent changes with causes.

### 3.8 Edge / negative
- Note 2,001 chars rejected. Next review date yesterday or > 1 year rejected; exactly today and exactly +1 year accepted (boundary).
- Owner = viewer, or member of other team, or removed member -> refused. Viewer cannot record review (UI hidden, request refused).
- No edit/delete endpoints/actions on reviews.
- Analyst acking another team's change -> not stamped; admin can.
- Bulk ack writes N audit entries.
- Addition not in ack queue; `transitions_30d >= status_changes_30d`.
- Cause has <= 5 drivers listed.
- UTC boundary for overdue (test around midnight).

### 3.9 Confusing
- "Sole traders that are not scored" in the counts strip vs "Sole trader ... is never scored": all sole traders are unscored, so the qualifier is redundant or hints at something else.
- Reviews due "counts the exposures never reviewed, an exposure whose only record is the one of the day it joined among them": i.e. the auto-created join record does not count as a review.

---

## 4. EDD dossiers [F2/F5] (doc: "EDD dossiers", lines 846-862)

- Enhanced due diligence on a **company or a person**, in stages, autonomous, every check cited. Order: register identity, global screening, company footprint, then register checks per country of presence.
- Entry points: **EDD Dossiers** in sidebar (if workspace holds dossiers module), **Start EDD dossier** on company page (preset), **New dossier** on workbench.
- Analyst or above requests; must state **purpose** (mandatory for a person; implied optional for company?). Each stage recorded on completion. Empty proposed footprint -> waits for user confirmation. **Retry** reruns failed stage. **Download report** -> PDF.
- Viewers read own team's dossiers, request none; compliance reads all teams' dossiers.
- Dashboard only; audit log records each dossier by id. Underlying identity, screenings, register records available on API/MCP.
- Tests: viewer has no New dossier; person dossier without purpose blocked; empty-footprint wait state; Retry on failed stage; compliance cross-team visibility; no dossier API endpoint expected.
- Unclear: whether purpose is required for a company dossier ("which a dossier on a person always needs" suggests optional for companies).

---

## 5. Monitoring [F5] (doc: "Monitoring", lines 866-882)

### 5.1 Flow
1. Follow a deal (Deal Book row) or Follow a name (Following tab: company, brand, person, topic). **Browse catalog** bulk-adds ECAs/agencies of desk's verified catalog by region.
2. Monitoring page sets frequency: **hourly, daily, every 2 days, weekly**; pause with **Active** switch.
3. Following tab shows each with newest update and tone (where posts are read).

### 5.2 Table
- Columns: type, frequency (under it, the schedule research keeps where that differs), last check, status.
- Status enum: **OK, Queued, Checking, Overdue** (check late), **Paused, Retrying, Failed** (error on hover).
- Active switch pauses/resumes; paused not checked until resumed. Multi-select pause/resume/remove (edit access).
- Workspace without Deal Book keeps Follow a name on Monitoring page. Old Sentiment tab addresses redirect to Following tab.
- Persons followable only where person data switched on.

### 5.3 Scope boundaries
- Monitoring = scheduled research. Not Portfolio credit monitoring, not register watch (Coverage). News/social are separate pages.

### 5.4 API
- Followed deals: `GET /v1/deals?status=tracking`
- `GET /v1/monitoring/targets` (latest run outcome, next due time), `GET /v1/monitoring/catalog`, `GET /v1/monitoring/sources`.

### 5.5 Tests
- Follow deal -> appears in Following and in `status=tracking`. Follow name -> appears in `monitoring/targets`.
- Pause -> status Paused, next due not advanced; resume.
- Viewer cannot bulk pause/remove.
- Redirect from old Sentiment URL.
- Person follow hidden when person data off.

### 5.6 Confusing
- Displayed frequency vs "schedule research keeps in your workspace where that differs": UI can show two frequencies.

---

## 6. Network [F3] (doc: "Network", lines 886-915)

### 6.1 Flow
1. Open company -> Network view: officers, shareholders, beneficial owners, holdings, branches, relations.
2. Click company -> its connections; click relationship -> source record + day read.
3. Controls: **Min ownership** (%), **Current / All history / As of** (date), **How are A and B connected?**, **Export CSV** (relationships shown, each with citation).
4. Company page: ownership chain, PSC list, officers, **Watch register changes** (edit access).

### 6.2 Rules
- Solid = current; dashed = ended; financing relationships own colour.
- Canvas overflow: view states how many shown.
- Persons shown only with person data on.
- UI opening a company can start a register lookup; **API network read never does**.
- **Ownership chain**: upward, hop by hop, each hop cited; `GET /v1/nodes/{node_id}/ownership-chain`.
- **PSC (Companies House)**: every PSC listed as register states: band of shares/votes, registration place of org, notified date, ceased date. All ceased -> listed with dates (never looks like "never had one"). Non-UK org with control: chain ends on it, named, not traced; never ends on "no PSC" statement. Exempt company (e.g. listed on regulated market) chain ends as **exempt**.
- Officers (Companies House) on first visit: if not read yet, read at once, page says so, shows on arrival; if none, says so with check date. Company profile PDF says the same.

### 6.3 API / MCP
- `GET /v1/nodes/{node_id}/network` (every relationship's citation), `GET /v1/nodes/{node_id}/ownership-chain`. MCP same reads.

### 6.4 Tests
- Min ownership 25% hides lower stakes; As of date shows only relationships in force then; All history shows dashed ended ones.
- Export CSV rows == relationships shown, each with citation column.
- Path finder between two connected / unconnected companies.
- API network call does not trigger lookup (no side effect).
- Officers "loading" state then populated; "none" state with date.
- Chain endings: non-UK org, exempt.

### 6.5 Confusing
- Financing on Network vs Institutions: financing relationships drawn in colour; Institutions deal count rule is in the Deal Book section.

---

## 7. Countries [F4] (doc: "Countries", lines 919-943)

### 7.1 Flow
1. Countries list: one line per market: risk 0-100 (**higher = riskier**), sanctions / EU AML / FATF flags; with Deal Book, live deals + reported value (team in sidebar or all under All teams).
2. Strip on top: count per risk band (or pipeline value per band); clicking band filters list.
3. **Export** -> Excel (with deals/value when Deal Book).
4. Country page: composite risk + weighted breakdown, list status with citations, indicators, CPI, governance indicators, Freedom in the World Global Freedom Score, OECD category (each with edition), reference events, your deals. **Download report** -> Country Brief PDF for team. **Research this country** (edit access) -> header reads **Researched daily**. **How the points are counted** shows arithmetic.

### 7.2 Score model
| Part | Component | Weight |
|---|---|---|
| Country assessments | Corruption Perceptions Index | 25 |
| | Governance indicators | 20 |
| | OECD country risk category | 12 |
| | Verified adverse news (own research) | 13 |
| List standing | FATF lists | 10 |
| | EU high risk list | 5 |
| | Country sanctions programs | 15 |
Total 100 (assessments 70, list standing 30).

- Each component -> risk 0-100. OECD category k -> `k * 100 / 7` (k=7 -> 100; k=0 -> 0).
- Missing component passes weight to components with data **in its own part**; list standing always 30 points.
- Scored only if components with data carry **>= 50** of 100 weight points; else **Not scored** with reason on hover. Missing component never scored as safe. Page lists components with data, prints nothing (not even %) about others.
- OECD-unclassified (high income OECD / euro area) -> no category, never read as 0; page shows OECD note in table's own words.

### 7.3 API
- `GET /v1/countries` (index; unscored -> `risk_reason` = `below_coverage_floor`)
- `GET /v1/countries/{iso3}`: indicators with dataset attribution; `on_record: false` where edition holds no value; `risk.gaps` = components computed without, each with `reason`, `sentences`; each row's `part`.
- `GET /v1/reference/datasets`.

### 7.4 Tests
- Range 0..100; band strip counts sum to number of scored countries (plus Not scored?); click band filters.
- Recompute: sum(weight_i * risk_i) with redistributed weights == displayed score (use "How the points are counted").
- OECD k mapping, e.g. k=3 -> 42.857...
- Germany/euro-area: no OECD category, not 0, OECD note present.
- Unscored country: API `risk` null + `risk_reason` `below_coverage_floor`; UI "Not scored" hover.
- `on_record:false` indicators.
- Invalid iso3 (e.g. `XXX`, lowercase `deu`, 2-letter `DE`) -> 404/422.
- Export Excel deal counts match list. Research this country needs edit access.
- Deal counts per country match Deal Book filtered by country for the same team.

### 7.5 Confusing
- With weight redistribution inside a part, as soon as one assessment has data the assessments part carries 70, so "components with data carry at least 50" is ambiguous: originally-weighted or after redistribution? Probably original weights (else the floor would only bite when all four assessments are missing: 30 < 50). Don't hard-assert.
- "A missing assessment is never filled with list rows that read 0": list components always have data (0 = not listed).

---

## 8. Tender profiles and matches [F1] (doc: "Tender profiles and matches", lines 947-1009)

### 8.1 Flow
1. Tenders page (team in sidebar): matches linked to notices, profiles, upload portal exports.
2. Default profile auto-made from desk mandate (`made_by_stonewake`). Edit, pause, archive (with confirm), restore.
3. **Look back** on a profile row: run over last <= 31 days.
4. Match: **Add to Deal Book** or set aside (dismiss).

### 8.2 Model
- Profile: >= 1 CPV code or >= 1 NUTS region required. Optional: value band EUR (inclusive bounds; estimated value else award value; other currency never converted), procedure types, buyer legal types, notice kinds, days to tender deadline, keywords. Plus use case (financing a project | bank as bidder) and active flag.
- CPV hierarchy: `45000000` covers `45233120`. NUTS hierarchy: `DE2` covers `DE212`. Extra-regio codes can't be asked.
- Keywords: whole words in title/description, umlauts spelled out, accents dropped: Türen = TÜREN = tueren; Tür never matches Türen. Multi-word = consecutive. Match names field + words as written.
- Codes must be in official eForms lists; refusal names offending codes, first 10 per list + count of rest.
- Default profile: CPV = works + equipment of mandate's sectors (all desk sectors if none); regions = countries of markets bought into (never excluded markets); country without NUTS (UK) narrows nothing; no other criterion so valueless notices still match. Judges last 31 days at once, then live. Archived default never recreated; team with own profiles gets none; new team gets one on creation.
- Notices: TED (today Germany buyers), plus own uploads and own portal alerts.
- Outcomes per criterion: **Hit / Miss / Unknown**. Unknown: field not stated, only broader code (country when region asked), place could be anywhere, code not in any list, value in other currency. Any-of codes hits. Match = all hits. One miss = no match. Unknown + no miss = undetermined, **never shown**.
- Days-to-deadline counted from pass day; Bekanntmachungsservice notices state no deadline -> undetermined when set.
- One match per procedure; later notice (correction, result) moves match; set-aside stays set aside.
- `deadline_passed` when deadline before today on buyer's calendar; page marks closed; status kept.
- Amount <= 1,000 never a contract value -> treated as not stated.
- Run: `POST /tenders/profiles/{profile_id}/run`, <= 31 days; longer or reversed window refused (same sentence). Returns count judged and per-criterion miss/unknown counts with why. Max 50,000 notices per pass; says so when capped.
- Paused profile resumes where stopped.

### 8.3 Into Deal Book
- Only **new** matches confirmed by every criterion, or new portal saved-search matches. Set-aside never. Adding twice changes nothing (idempotent). No model.
- Evidence: notice fields (kind, title, buyer, value, deadline, pub date, reference), link to TED/portal, fixed sentence.
- Stage: Prior information -> **Planned**; Contract notice -> **Tender open**; Contract award -> **Contract awarded**. Forward only, never back.
- One procedure one deal: lands on existing deal holding procedure (other profile, portal lane with same procedure or TED pub number, research finding citing TED page). Stonewake-maintained deal: stage and evidence unchanged. Two procedures never on one deal; if two deals hold same procedure, match waits for analyst merge.
- Deal page shows one line: tender deadline + notice link. Audit trail for every addition.

### 8.4 Persons / privacy
- Winners never shown (names/ids). Buyer named only if all buyer legal types are public; else withheld with a note. Description never shown. Title shown unless buyer withheld and title repeats buyer name/id. TED link always.

### 8.5 Routes
- Dashboard-only (session, analyst in team with Deal Book module, not in `/v1`, not in `/openapi.json`): `/tenders/profiles`, `GET /tenders/profiles?archived=true`, `POST /tenders/profiles/{profile_id}/restore`, `POST /tenders/profiles/{profile_id}/run`, `/tenders/matches`, `POST /tenders/matches/{match_id}/dismiss`, `POST /tenders/matches/{match_id}/to-deal-book`.
- Read API: `GET /v1/tenders/profiles`, `GET /v1/tenders/matches`, `GET /v1/tenders/matches/{match_id}`, `GET /v1/tenders/deals/{deal_id}`; `team` param narrows for multi-team readers; key reads only its issued team. MCP `tender_profiles`, `tender_matches` (with `deal_id`). Fields: `made_by_stonewake`, `notice` or `portal_notice`, `decided_by` (profile vs saved search). No writer identities, no portal account/address/key.

### 8.6 Tests
- API key against `/tenders/profiles` dashboard routes -> refused (session only). Viewer session -> refused. Team without Deal Book module -> refused.
- `/openapi.json` does not list `/tenders/*` dashboard routes.
- Profile with no CPV and no NUTS -> refused. Bad CPV code list -> one error naming codes (first 10 + count).
- Run window 32 days or reversed -> refused.
- Under All teams, new profile/upload blocked until a team is chosen.
- To-deal-book twice -> no duplicate; dismissed -> refused; undetermined never listed.
- Stage regression attempt (award then PIN) -> stays Contract awarded.
- Value band boundary inclusive; non-EUR value -> Unknown; value 1000 -> not stated.
- Keyword normalization cases.
- Winner names never present in API JSON.

### 8.7 Confusing
- "Tender open" etc. are "your desk's own stages" vs Deal Book financing-window words: mapping unspecified.
- "Keeping profiles, running passes and setting matches aside need ... analyst" but archive/restore role not explicit.

---

## 9. Teams and webhook alerts [F5/F6] (doc: "Teams and webhook alerts", lines 1013-1073)

### 9.1 What an alert is
- Written when book state changes (exposure to Red, register event on watched company, serious news event), in the same step as the change (no alert for rolled-back change).
- Carries event class, severity (`critical` | `high` | `information`), dates, subject ids, **never a name**.
- Team channel: that team's + workspace-wide alerts; workspace channel: all; only for parts of Stonewake the team holds.
- Old fact at write time -> daily summary only, not posted.

### 9.2 Microsoft Teams
- Via Workflows (O365 connectors retired May 2026). Template **Send webhook alerts to a channel** or trigger **When a Teams webhook request is received**. Paste link in Settings.
- Accepted hosts only: `environment.api.powerplatform.com`, `logic.azure.com`. Link sealed, never shown again.
- Adaptive Card in alert language with button to dashboard. Log reads **Sent**, never **Delivered**.

### 9.3 Signed webhook (Standard Webhooks)
- HTTPS POST JSON; headers `webhook-id` (same across retries), `webhook-timestamp` (unix seconds), `webhook-signature` = `v1,` + base64(HMAC-SHA256(secret, id + "." + timestamp + "." + rawBody)).
- Secret prefix `whsec_`, shown once.
- Receiver: constant-time compare, reject timestamp > 5 min skew.
- Body: `type` (`stonewake.alert`), `version`, `content_class`, `event_id`, `severity`, `text`, `link`. **detailed** adds `event_class`, `occurred_at`, `created_at`, `node_id`, `exposure_id`, `source` (kind + id). News (`press_candidate`) adds `news` {`event_type`, counts of `articles`, `languages`, `sources`}. **minimal**: no subject.
- 2xx -> **Delivered**.

### 9.4 Retries
- Retryable: 5xx, 408, 425, 429, timeout, connection error. Schedule: 30 s, 2 min, 8 min, 32 min, then hourly; **8 attempts** total, under 4 hours. Each attempt logged.
- **Given up** immediately: other 4xx, address fails checks, channel disabled in flight, channel kind not switched on. Also when attempts exhausted. Nothing dropped without a log row.

### 9.5 Address checks (create + every send) - SSRF tests
- HTTPS only, standard port, no userinfo.
- Hostname only (no IP literal), plain ASCII (no IDN/punycode? "plain ASCII").
- All resolved IPs public; private, loopback, link-local, cloud metadata refused; connect only to checked IP (DNS rebinding protection).
- No redirects followed.
- Optional host allowlist (set by Stonewake rep).
- Test ideas: `http://`, `https://host:8443`, `https://user:pass@host`, `https://10.0.0.1`, `https://169.254.169.254`, `https://localhost`, unicode host, host resolving to 127.0.0.1, 302 redirect receiver.

### 9.6 Test messages / switched off
- **Send test message**: fixed doc naming no event, same checks, answer shown immediately. Stonewake test receiver: verifies signature + timestamp, records result, internal only.
- Settings shows for every channel (email, SMS, Teams, webhook, dashboard) whether it delivers; **Switched off** + one-sentence reason, no form, no test button.
- Admin-only settings, except the channel delivery list (all members).
- Language German/English; time German/UK.

### 9.7 API / MCP
- `GET /v1/alerts/events`; `GET /v1/alerts/deliveries` filter `event_id`, `status`, `channel`; `GET /v1/alerts/channels`. Key: own team + workspace-wide. MCP `alert_events`, `alert_deliveries`, `alert_channels`. No address/secret ever served; no create/test/disable via API.

### 9.8 Confusing
- Webhook body has a `text` sentence while alert "never names a name": email names the company, webhook/Teams/SMS do not (presumably). Check `text` doesn't contain company name.

---

## 10. Alerts by SMS [F5] (doc: "Alerts by SMS", lines 1077-1109)

- Number: international format (+49...). Accepted countries (mobile only): **DE, AT, CH, UK, FR, NL, LU, BE, IT, ES**. Premium, shared cost, satellite, landline refused.
- Admin approval required -> sends 6-digit code; user enters it. Code valid **10 min**, **5 attempts**; max **5 codes/day**, **1/minute**.
- Stored encrypted; displayed masked (first two + last two digits). Never in logs/delivery record. Remove/replace number erases it; member removal erases it. Admin can remove number of departed member, never approves one (for departed members? wording: "and never approves one").
- Message text exact: EN "Stonewake. A new critical alert in your workspace. Details in the dashboard." (high: "important"); DE "Stonewake. Eine neue kritische Meldung in Ihrem Arbeitsbereich. Details im Dashboard." (high: "wichtige"). No company, figure, client. EU provider, sender "Stonewake".
- Routing: per-team subscription (admin + Stonewake); only active members of the alert's team whose team holds the module. Personal setting: default **only move to Red** on own team's book; widen to all critical, or critical + high. Informational never. News event only when critical. Old facts: > **2 days** status change, > **30 days** register event -> daily summary, not sent.
- Quiet hours on workspace clock (German default, UK option), DST aware. Held and recorded, **not sent later**. Critical bypass on by default, can be switched off.
- Limits: daily per workspace, per member, monthly budget, global daily. Codes count against daily limits. Over limit -> held and recorded; failed not resent. No limits set -> SMS switched off. Demo -> off, settings says so, takes no number.
- Delivery states: queued, sent, delivered, not delivered (provider report), failed, held (reason quiet hours or limit). API `GET /v1/alerts/deliveries`, MCP `alert_deliveries`: ids only.
- Tests: number validation matrix (US +1 refused, landline refused), code expiry at 10 min, 6th attempt locked, 6th code/day refused, 2 codes within 60 s refused, masking format, delivery record has no phone number, quiet hours held not resent.
- Confusing: "An administrator can also remove the number of a member who has already left, and never approves one" - ambiguous whether admins can never approve their own/departed members' numbers.

---

## 11. Alerts by email [F5] (doc: "Alerts by email", lines 1113-1135)

- Settings card **Email alerts** -> sign-in email address. Severity: critical only | high and critical | every severity. Personal setting; covers all alert classes team holds. Off stops immediately. No email on sign-in -> card says so. API keys never get mail.
- Mail: alert language; German mail includes English text below; English mail English only. Subject starts "Stonewake", names severity and company where known. Body: company, what changed, source-stated date, source, link. Dates calendar days on workspace clock.
- Eligibility: alert belongs to team or workspace, severity >= chosen, active member, team holds module. News events go to teams whose book/watch list holds the company. Old facts -> summary.
- Limits: monthly mail budget, monthly deliveries per channel, provider allowance. Over limit held, never sent another way. Bounced / spam-reported address gets no more. No limits -> card says so, setting kept. EU provider; demo none leaves.
- Delivery states: queued, sent, failed, held (reason). API `GET /v1/alerts/deliveries?channel=email`, MCP `alert_deliveries`: ids only.
- Contrast with SMS/webhook: email names the company; SMS/webhook do not.

---

## 12. News monitoring [F5/F6] (doc: "News monitoring", lines 1139-1206)

### 12.1 Source & matching
- GDELT 15-min files; English + machine-translated (~65 languages; translated read ~1 h later). Only articles naming a monitored company/person kept. `attribution` field in every answer with GDELT citation + link.
- Company match: whole-name equality, case/punct/hyphens/accents ignored, ø->o, æ->ae, ł->l, legal form spelled out (AG = Aktiengesellschaft), legal form at end optional (Adolf Würth GmbH & Co. KG = Adolf Wurth; Novo Nordisk A/S = Novo Nordisk). Register names incl. former names. Alias list (Wikidata + GLEIF) by LEI: BMW, VW; only for company holding that LEI.
- Never: substring (BP vs bpost); name shared by two monitored companies; alias shared by two companies (Porsche); reviewed ambiguous list (Merck, Hermes, Continental, Metro, Otto, Shell, Mercedes, Caterpillar, Bayer, RBI, ~30 more). Merck KGaA matched only as "Merck KGaA".
- Person: whole name, given names first ("MUSTER, Anna Maria" = Anna Maria Muster = Anna Muster). Single word never; shared names match neither; namesakes possible. Only with person data on; never an objector.

### 12.2 Retention
- Kept: URL, publisher domain, date, language, GDELT tone. No headline/text/other names. Readings 1 year; articles+matches 1 year + 30 days.

### 12.3 Daily reading (UTC, 30-day window)
- `reading`: >= 3 articles; `tone_mean` (GDELT tone approx -10..+10).
- `too_little_coverage`: < 3 articles, all 30 days read in full.
- `feed_gap`: day not read in full, or < 3 with some gap days. No tone.
- Fields: `article_keys` (newest 100, SHA-256 of URL), `articles_window` (all), `gap_days`.
- Day read in full: every 15-min file in both streams read, or not published within a day, or failed 3 attempts. Today always `feed_gap`.
- Backfill 30 days for newly added companies; until done, earlier days not full. Only own workspace's matches.
- Tone not a risk-score input. Sole trader: `latest` null, no `readings`, but articles and events served.

### 12.4 News events
- Types: insolvency; sanctions or penalty; fraud/corruption/money laundering; cyberattack/data breach; industrial accident; lawsuit/antitrust; executive exit/arrest; layoffs/closures; strike; environmental/human rights incident. No product recall, no rating downgrade.
- Article qualifies: theme within 200 chars of company mention; company named >= 4 times and first within first 200 chars; tone <= -1.5; no police/theft/road traffic theme near company. Exec exit needs role (CEO/chairman) nearby.
- Event: same company + type within 48 h, >= 2 independent sources (syndicated copies count once), >= 2x company's usual rate for that type over prior 14 days. Later articles join open event; new alert only for more severe type or after 48 h. Backfill never alerts.
- Severity: insolvency **critical** if >= 3 independent sources in >= 2 languages, else **high**. **information**: sanctions, strike, executive exit, environmental/HR. Others **high**.
- Alert as `press_candidate` via team subscriptions, quiet hours, budgets; SMS only if critical.
- News check: fetch up to 8 newest (one per story), Claude Haiku 5.5 reads up to 5 + company identity; answers yes/no/unsure with type and quotes. Optional NewsAPI.ai second source (contract-gated, hand-approved search profiles, companies only, up to 5 total). Deterministic gate: quotes verbatim from read articles; type must be in mapping (narrow only); yes needs >= 2 different publishers (syndicated same passage counts as one); instruction-like article text excluded (prompt-injection defence); anything else = unsure. Severity never above rule's.
- Only confirmed events alert; others stay as coverage (no type/severity), never hidden/deleted. Check unavailable -> no alert, reason recorded, retried later.
- Workspace watches company -> one event per workspace; team-book-only -> one event per team.
- Accuracy figures (informational; don't test).

### 12.5 Routes
- `GET /v1/news/companies` (`limit`, `offset`; `node_type` `person`; `latest` null when no reading).
- `GET /v1/news/companies/{node_id}` (`days` default 30, max 90; readings newest first; newest 100 articles + event articles with `article_key`, `url`, `publisher_host`, `published_at`, `language`, `gdelt_tone`, `matched_organization`; `events` max 20 newest first with `event_type`, `severity`, `opened_at`, `detected_at`, `closes_at`, `last_article_at`, `articles`, `sources`, `languages`, `alerted`, `article_keys` (20), `mapping_version`, `rule_version`, `check` {`status`: `confirmed`|`not_confirmed`|`pending`|`unchecked`|`covered`, `verdict`, `event_type`, `severity`, `article_key`, `reason`, `model`, `prompt_version`, `checked_at`, `second_source_articles` [... `provider`]}).
- Other workspace's company -> **404**. MCP `company_news`.
- Tests: `days=91` -> error/clamp; `days=0`/negative; `alerted == true` only when `check.status == confirmed`; `readings` states enum; tone null unless `reading`; no headline field anywhere; 404 for foreign node.

---

## 13. Social monitoring [F5/F6] (doc: "Social monitoring", lines 1210-1259)

- Per-workspace switch; off -> routes answer `source.enabled` false, no reading/post.
- Daily search of X, LinkedIn, TikTok, Instagram, YouTube, Reddit, Threads; first page only (sample). Sole trader never searched. Awario intended source. `source` field says enabled + citation.
- Matching like news; hashtag = its words; person needs >= 2-word whole name; shared names match neither.
- LLM labels each post: about name / something else / unclear; tone positive/negative/neutral. Batch counts only if every post labeled exactly once in exact form; else batch unrated. Off-topic posts excluded.
- Kept: key, post number, platform, post-only link, date, language, poster kind (organisation/media/private), matched word, label. Not kept: author, handle, avatar, followers, title, text. Link revealing a person's page -> `url` null, `link_withheld` true.
- Retention: readings 1 y; posts 1 y + 30 d; YouTube 30 days (still counted in `platform_counts`).
- Reading (UTC, 30 days): `platform_counts`, `positive`, `negative`, `neutral`, `unrated`. States `reading` (>= 3 toned posts; `sentiment_net` = (pos-neg)/toned, -1..+1), `too_little_coverage`, `feed_gap`. Day full when complete search ran >= 6 h after day ended. Refused/failed search reads no day. Name's days start at first complete search. `item_keys` (100), `items_window`, `gap_days`. Awario readings don't count YouTube.
- Paused updates -> `paused_until` = first day of next month.
- Not a risk-score input.
- Routes: `GET /v1/social/names`, `GET /v1/social/names/{target_id}` (newest 100 posts, last 30 days: `item_key`, `platform`, `url`, `link_withheld`, `published_at`, `language`, `sentiment`, `matched_word`, `source_kind`); MCP `social_sentiment`. `GET /v1/social/companies`, `GET /v1/social/companies/{node_id}` (`matched_name`, `node_type` person); MCP `company_social`. Foreign name -> 404.
- UI: Following tab with tone words and 30-day strip (wide screens only), What changed; name page with posts; company/person page card.
- Tests: sentiment_net math; `url` null iff `link_withheld`; no author fields in JSON; disabled workspace returns `source.enabled:false`.

---

## 14. Book import [F5/F6] (doc: "Book import", lines 1263-1358)

### 14.1 Flow
Portfolio page -> **Import book** (template download) -> upload CSV -> preview (writes nothing) -> confirm (reruns against current book) -> adds; audit per company; register watch; recompute queued.

### 14.2 File rules
- Header first line; required `identifier_type`, `identifier`; optional `name`, `currency`, `limit_amount`, `drawn_amount`.
- Comma separated; semicolon header -> semicolons. Any line endings.
- Unicode text (UTF-16) or any control character -> whole file refused with reason.
- Max **2,000 rows** and **1,000,000 characters**. Re-importing a part adds nothing twice.
- Amounts: digits, <= 2 decimals, no thousands separator (`25000000.50` or `25000000,50`), < 1,000,000,000,000,000; needs 3-letter ISO currency. Not scored. Existing companies keep terms (Edit terms).
- Names never used for identity; name-only row adds nothing.

### 14.3 Identifier types
`lei`, `de_register` (type+number+court, e.g. `HRB 275806 München`), `uk_crn`, `us_cik`, `ch_uid`, `fr_siren`, `dk_cvr`, `no_orgnr`, `be_kbo`, `cz_ico`, `sk_ico`, `euid`, `es_rm_hoja`, `lv_regnr`, `ee_reg`, `au_acn`, `au_abn`, `us_co_sos_id`, `us_ct_sos_id` (7 digits), `us_ny_dos_id`, `us_rssd`, `us_crd`, `de_mastr`, `ro_cui` (no RO prefix), `ra_raNNNNNN` (e.g. `ra_ra000406`), `isin`, `bic`, `mic`, `vat` (with country prefix), `ocid`, `spglobal`, `northdata_id`.
- Check digits: LEI (ISO 17442, 18 chars + 2 check), ISIN (ISO 6166), NO orgnr, BE KBO, CH UID, AU ABN/ACN.
- Numeric ids: spaces, points, slashes, hyphens allowed; CH UID may start with `CHE`. Letters -> invalid (`us_cik,32O193`).
- German number without court -> ambiguous.
- Company must carry a register identifier or LEI to join.
- Identifier > 64 chars -> invalid.

### 14.4 Row outcomes
`add`, `reactivate` (retired, returns), `in_book` (names held company if other record), `duplicate` (earlier line, incl. other register record), `ambiguous`, `unresolved`, `invalid`. Every non-`add` has plain-word reason. Goes into own team's book; preview names team.

### 14.5 API / MCP
- `POST /v1/portfolio/import` body `{"csv": "..."}`; `dry_run` always true; paging `limit` (default/max 100), `offset`, file order; `counts` and `total` cover whole file. Unreadable file (e.g. missing identifier columns) -> **422** naming problem.
- MCP `portfolio_import_preview`; whole-file refusal -> tool error.

### 14.6 Bank terms
- Signals needing bank input show **Awaiting bank input**: deal counterparties (guarantor, LC bank, offtaker), project register entry, refinancing market, supervisory slotting grades. **Edit terms** -> save queues recompute; row leaves Awaiting once present. Facility figure change alone queues no recompute. Unedited stored terms saved back unchanged.

### 14.7 Tests
- Sample file from doc -> thyssenkrupp `add`/`in_book`, VARTA, Boeing.
- Bad LEI check digit -> `invalid`; `us_cik,32O193` -> `invalid`; `HRB 728059` no court -> `ambiguous`; unknown type -> `invalid`; 65-char id -> invalid; amount `1,000,000.00` -> invalid; amount without currency -> invalid; `limit=101` -> clamp or 422; 2,001 rows -> refused; UTF-16 file -> refused; control char -> refused; missing `identifier` column -> 422.
- Same company twice in file (LEI + CIK) -> second `duplicate`.
- `dry_run=false` on /v1 ignored (still preview) -> verify portfolio unchanged.

### 14.8 Confusing
- Is exceeding 2,000 rows a whole-file refusal or per-row? Doc says "at most", implies refusal; not explicit.
- Decimal comma `25000000,50` allowed while file is comma-separated: needs quoting; ambiguity in CSV parsing.

---

## 15. Tender portal exports [F1/F6] (doc: "Tender portal exports", lines 1362-1456)

- Upload on Tenders page (**Upload a portal export**, analysts/admins) or Settings > Tender portal exports (teams without Tenders page). Team-private.
- Files: CSV/XLSX (one notice per row) or eForms XML (one notice). Extension `.csv`/`.xlsx`/`.xml` must match content; `.xls` not read. Max **700,000 bytes**, **2,000 rows**. >1,000 columns -> exact error "The worksheet has more than 1,000 columns. Save it with at most 1,000 columns and upload it again." CSV separators comma/semicolon/tab; UTF-8 or Windows German code page. First worksheet only. Whole-file failure -> nothing read. Re-upload stores nothing twice.
- `source_portal` enum: `dtvp`(refused), `vergabe24`(refused), `evergabe_bund`, `vergabe_nrw`, `rib_bayern`, `subreport`, `cosinex_laender`, `dab`(refused), `dtad`(refused), `had`(refused), `vergabe_saarland`(refused), `oeffentlichevergabe_de`, `other_public`, `manual`. Refused portal -> whole upload refused before reading.
- Profiles: `template` (needs `reference`, `title`), `oeffentlichevergabe_de_purpose` (purpose.csv). None/multiple match -> mapping required; unmapped columns listed unknown, never read; no guessing.
- Fields: `reference` (else `notice_id`+`notice_version`), `title` (required), `notice_version` 1-99, `procedure_id`, `publication_number` (e.g. `670716-2026`), `form_type`/`notice_type`/`notice_subtype` (inconsistent type dropped), `published_on`/`tender_deadline` (`2026-11-14` or `14.11.2026`), `buyer_name`, `buyer_identifier`, `buyer_country` (3-letter), `contract_nature`, `procedure_type`, `cpv` (8 digits, check digit allowed, `;` or space separated, first = main), `place_of_performance` (NUTS or ISO3), `estimated_value` (<= 2 decimals, no separator; <= 1,000 placeholder not stored), `estimated_currency`, `description`, `text_lang` (3-letter), `source_url` (https only), `lot` (lot rows skipped).
- Bad value dropped alone and counted, never kills the row.
- Contact data: email, intl phone, `0711 123456`, `0711/123456`, `0711-123456`, labels Telefon/Fax/Ansprechpartner/Kontakt -> whole field withheld + counted. Natural-person buyer keeps only country.
- Row outcomes: `new`, `update`, `unchanged`, `duplicate` (first kept), `skipped` (lot), `invalid` (no reference/title, or more cells than header).
- `counters` e.g. `estimated_value_placeholder`, `contact_data_withheld`.
- Confirm reruns against stored notices, one audit entry with counts; stored notice keeps profile, portal, file+line, uploader, time, link. Profiles then judge them.
- API `POST /v1/tenders/portals/upload` {`file_name`, `source_portal`, `content_base64`, `mapping`?}; `dry_run` always true; `limit` default/max 100, `offset`; `counts`, `counters`, `total` whole file. 422 at `content_base64` (unreadable), at `mapping` (e.g. no column for `title`), at `source_portal` (names accepted portals). MCP `tender_export_preview`.
- Tests: refused portal 422; `.xls` refused; `.csv` name with XLSX content refused; 700,001 bytes; 1,001 columns exact message; `source_url` http dropped; `notice_version` 100 dropped; title with phone `0711-123456` withheld; `estimated_value` 1000 counted as placeholder; row with extra cells invalid; duplicate references.
- Confusing: `subreport` and `cosinex_laender` are accepted for file uploads but their alerts are "not accepted for now" in Your own sources (different channels, different rules).

---

## 16. Your own sources (doc: "Your own sources", lines 1460-1488)

- Neither switched on yet (documented but not live; expect feature off).
- Portal accounts: admin adds per team; address `t-` + 32 letters/digits + `@in.stonewake.ai`, shown once. No password stored. Accepted alerts (once on): e-Vergabe des Bundes, Vergabe.NRW, vergabe.bayern (RIB). Not: DTVP, Vergabe24, DAB, DTAD, HAD, vergabe.saarland, subreport, cosinex. Mail read only when provably from portal (SPF/DKIM recomputed; sender-written auth results stripped) and addressed to this account. Else recorded with reason, nothing read. Notices with own link + title -> team notice (reference, title, pub date, deadline, link); buyer names/other cells not stored; body/subject/addresses/attachments not kept. Each -> tender match (`decided_by` saved search) + profile judging. Mail max 2 MB. Address replaceable/endable; mail to old address dropped and counted. Test button: counts only.
- Licensed data: admin connects with bank key, licence scope, monthly quota, contract confirmation; key encrypted, never shown again. North Data connectable (once on); Creditreform, BvD Orbis listed but not connectable. Lookup by German register number with court; tied to company only by register number or LEI, never name. Quota: one company per calendar month as billed; exhausted -> none until next month; no auto-repeat. Test button counts as one request, max once per month. Natural person/sole trader values not stored. API `GET /v1/licensed-data/facts`, MCP `licensed_facts` only for scope covering bank's own systems. Demo uses published sample.
- Never: login to portal/provider, portal/licensed data in shared base or other bank, address/key on API/MCP.

---

## Top API/MCP inventory from this range [F6]

| Endpoint / tool | Area |
|---|---|
| `GET /v1/deals` (`sort`,`direction`,`include_hidden`,`min_value_usd`,`eca`,`status=tracking`) / MCP `deal_book` | Deal Book |
| `GET /v1/deals/{deal_id}`, `/deck.pptx` (reports scope), `GET /v1/deals/parties/binding-queue` | Deal Book |
| `GET /v1/portfolio`, `/summary`, `/transitions`, `/{exposure_id}/reviews`, `/reviews-due`; `POST /v1/portfolio/import` | Portfolio |
| MCP `portfolio_overview`, `portfolio_book`, `exposure_review_history`, `portfolio_reviews_due`, `portfolio_import_preview` | Portfolio |
| `GET /v1/nodes/{node_id}/network`, `/ownership-chain`, `/risk-deck.pptx` | Network / Portfolio |
| `GET /v1/monitoring/targets`, `/catalog`, `/sources` | Monitoring |
| `GET /v1/countries`, `/v1/countries/{iso3}`, `GET /v1/reference/datasets` | Countries |
| `GET /v1/tenders/profiles` (`team`), `/matches` (`team`), `/matches/{match_id}`, `/deals/{deal_id}`; `POST /v1/tenders/portals/upload`; MCP `tender_profiles`, `tender_matches`, `tender_export_preview` | Tenders |
| `GET /v1/alerts/events`, `/deliveries` (`event_id`,`status`,`channel`), `/channels`; MCP `alert_events`, `alert_deliveries`, `alert_channels` | Alerts |
| `GET /v1/news/companies` (`limit`,`offset`), `/{node_id}` (`days`); MCP `company_news` | News |
| `GET /v1/social/names`, `/{target_id}`, `/v1/social/companies`, `/{node_id}`; MCP `social_sentiment`, `company_social` | Social |
| `GET /v1/licensed-data/facts`; MCP `licensed_facts` | Own sources |
| Dashboard-only (not /v1, not in openapi.json): `/tenders/profiles`, `/tenders/profiles/{id}/restore`, `/tenders/profiles/{id}/run`, `/tenders/matches`, `/tenders/matches/{id}/dismiss`, `/tenders/matches/{id}/to-deal-book` | Tenders |

## Quick numeric reference
- Score bands 70 / 45 / 20; score 0-100; country risk 0-100 higher riskier; country floor 50 weight; OECD k*100/7.
- Stale window 12 months; no movement 12 months; reopen value trigger USD 200m.
- ECB rates 29 Oct 2026; US Treasury rates 30 Sep 2026.
- Review due 1 year after add; reviews due window 2 weeks; note 2,000 chars; drivers max 5; status changes 30 days.
- Tender look-back <= 31 days; pass cap 50,000 notices; amount <= 1,000 = not stated; first 10 bad codes listed.
- Webhook: 8 attempts (30s, 2m, 8m, 32m, hourly), < 4 h; timestamp tolerance 5 min; secret `whsec_`.
- SMS: 10 countries; 6-digit code, 10 min, 5 attempts, 5 codes/day, 1/min; old fact 2 days (status) / 30 days (register).
- News: GDELT 15 min; >= 3 articles; window 30 days; `days` max 90; events max 20; article_keys 100 / 20; tone <= -1.5; 200 chars; >= 4 mentions; 48 h; 14-day baseline x2; insolvency critical >= 3 sources & >= 2 languages; check reads <= 5 of <= 8; yes needs >= 2 publishers; retention 1 y / 1 y + 30 d.
- Social: >= 3 toned posts; sentiment_net -1..+1; full day = search >= 6 h after day end; YouTube 30 days.
- Book import: 2,000 rows, 1,000,000 chars, id <= 64 chars, amounts < 10^15, 2 decimals; API page max 100.
- Portal export: 700,000 bytes, 2,000 rows, 1,000 columns, notice_version 1-99; API page max 100; mail 2 MB.
