# Stonewake notes A (llms-full.txt lines 1-714)

Sections covered: Stonewake API (overview), Quickstart, Authentication, Keys and access management, API reference (all subsections), MCP. Source is local docs only. `[Section]` tags name the doc section each point comes from.

Not in this range, though it is referenced: Errors and rate limits page (full error catalogue and the numeric limits), Security, Book import, Tender portal exports, Credit reviews, Deal Book page, Coverage. Section 6 lists what depends on those pages.

---

## 1. What each area does (plain words)

**Product shape** [Stonewake API]
- Read-only programmatic access to a bank's Stonewake workspace: credit monitoring (portfolio), entity/company risk, counterparty and country intelligence, deals, screenings, tenders, alerts, news/social monitoring.
- Base URL `https://api.stonewake.ai`. JSON over HTTPS. "No endpoint creates, changes or deletes anything in your workspace."
- Access is enabled per workspace by Stonewake (by arrangement). Once it is enabled, a workspace admin manages keys in the dashboard (Workspace settings) or through `/org/api-keys`.
- Docs are machine readable: every page is served as markdown at its path + `.md` or with `Accept: text/markdown`, plus `/llms.txt` and `/llms-full.txt`. Shortcuts on stonewake.ai: `/docs`, `/developers`, `/api-docs`, `/mcp` and `/openapi.json` redirect to the docs, the API reference, the MCP page and the OpenAPI schema. [Quickstart, For AI agents]
- Three surfaces share one data model:
  - UI: the dashboard. All writes happen here: key management, matching parties, setting the entity class, confirming candidates, applying imports.
  - REST: `/v1`, with 74 endpoints (71 GETs and 3 read-only POSTs).
  - MCP: `https://mcp.stonewake.ai/`, with 38 read-only tools.

**Areas** [API reference]
- **Identity / team scope.** `/v1/me` says who you are and which teams you read. A workspace has several teams ("desks"). Each team has its own book.
- **Portfolio (credit monitoring).** The book of monitored exposures. Each has a status (red/amber/…), a score, top signals, status transitions and credit reviews.
- **Entity risk.** The risk assessment of one company: signal rows with bands, states, gaps, grades, completeness shares and an entity class (corporate/bank/…).
- **Scoring rubrics.** The team's rubric versions and the live config.
- **Institution registry.** A closed list of ECAs, multilaterals, DFIs, development banks, agencies, banks and trade press. Uses `entity_id`.
- **Search.** Finds companies (and persons, where person data is on) by name or identifier. Returns a graph `node_id`.
- **Company nodes.** Register identity, records/citations, financials, events, energy/emissions, German sector/regional statistics.
- **Financing.** Charges, listed debt instruments, debt positions, maturity wall. Also public funding and collateral sites.
- **Network / Ownership.** The register neighbourhood graph and the upward ownership chains.
- **Register watches.** Companies whose register data is kept fresh. A watch does no scoring.
- **Alerts.** Events, channels, delivery log.
- **News / Social monitoring.** Daily readings (tone/sentiment) per company or monitored name.
- **Screenings.** Adverse-media screening runs plus the "Official lists" sanctions comparison.
- **Sanctions person review.** Name-match candidates between register persons and 6 sanctions lists.
- **Tenders.** Procurement-notice profiles and matches (TED), and a portal-export upload preview.
- **Licensed data.** North Data facts that were looked up under the bank's own licence.
- **Deals.** The ranked Deal Book: filters, sort, score windows, values, states, briefing (AI-drafted), summary lines (rule-based).
- **Research.** Monitoring targets, catalog, sources. Runs and developments.
- **Countries / reference / geography.** Country index and detail, datasets, geography rollups.
- **Citations.** Resolve record/event/assessment ids to evidence lines.
- **Audit log.** A CSV export. Needs the `audit` scope.
- **Documents.** PDF reports/packs and PPTX decks. Needs the `reports` scope.
- **Health.** `GET /health`, with no auth.

---

## 2. Endpoints and MCP tools

### 2.1 Key management (dashboard session auth, NOT API keys) [Keys and access management]

These routes authenticate with an admin's dashboard session. An API key sent to them gets **401**, the same answer an invalid key gets.

**`POST /org/api-keys`**
- Body: `name` (required, 1-120 chars), `expires_at` (optional), `team_id` (optional), `audit_export` (optional bool), `report_downloads` (optional bool).
- `expires_at` must carry a timezone and lie in the future, otherwise **422**.
- A `team_id` that is not one of the workspace's teams gives **422**. If omitted, the key reads the default team.
- `audit_export: true` adds the `audit` scope. `report_downloads: true` adds the `reports` scope.
- Success is **201**: `{ secret, key: {...} }`. `secret` is the full key, and it appears only in this response.
- API access not enabled gives **403**, `error.code` `forbidden`. The body carries both `error` and a top-level `detail` string.

**`GET /org/api-keys`**
- Returns 200 `{ api_access_active, api_access_expires_at, keys: [...] }`.
- Keys are listed newest first, and revoked keys are included. Keys are never deleted, so the list is a complete history.
- `api_access_expires_at` is non-null only while access is active and has an end date.
- Listing works even when API access has lapsed.

**`POST /org/api-keys/{key_id}/revoke`**
- Returns 200 with the key metadata and `revoked_at` set.
- It is idempotent: revoking again keeps the original `revoked_at`.
- An unknown id gives **404** `{error:{code:"not_found",message:"API key not found."},detail:"API key not found."}`.
- Another workspace's key id gets the same 404.
- Revocation works whatever the access status is. It takes effect on the key's next request.

**Key object** [Keys and access management, Key object fields]

| Field | Notes |
| --- | --- |
| `id` | UUID |
| `name` | |
| `key_prefix` | e.g. `swk_live_EXA`, the first characters of the key |
| `role` | always `viewer` |
| `scopes` | `["read"]`, plus `"audit"` and/or `"reports"` |
| `team_id` | |
| `team_name` | null once the team has been deleted |
| `created_by` | email |
| `created_at` | |
| `last_used_at` | null until first use; lags actual use because it is refreshed periodically |
| `expires_at` | null = never expires |
| `revoked_at` | |

- Only the `audit` and `reports` scopes are actually checked. Everything else is bounded by `/v1`.
- Keys created in the dashboard never carry an expiry. Expiry can only be set over the API.

### 2.2 REST `/v1` endpoints [API reference]

**General**
- All routes require `Authorization: Bearer swk_live_...`.
- List routes take `limit` and `offset` and return `{items, limit, offset, total}`.
- 422s name the offending parameter in `detail`.

**Identity**
- `GET /v1/me`
  - `credential`: `api_key` or `user`.
  - `team_scope`: `{ all_teams, teams: [{id, name}] }`.
  - `key`: `{id, name, role, scopes, expires_at}` for a key, and null for a signed-in user.

**Portfolio**

`GET /v1/portfolio`
- One item per exposure. Ordered by severity, **red first**.
- Item fields: status, score, `top_signals`, last transition, `review`, `review_overdue`, three shares, `screening_id`, `screening_verdict` (can be `incomplete`), `screening_confirmed`, `sanctions_name_matches_open`, `team_id`, `team_name`, `label`.
- `top_signals` order: first the signals whose red cap sets a red status, then red before amber.
- `review` is null if the exposure was never reviewed.
- `review_overdue` is true once the next review date has passed, and **never true on a deactivated exposure**.
- `include_inactive=true` adds deactivated exposures.

`GET /v1/portfolio/summary`
- Status counts over the **active** book, including a `sole_trader` count.
- `transitions_30d`: all feed entries, first assessments included.
- `status_changes_30d`: excludes first assessments.
- `reviews_overdue`.
- `sanctions_name_matches_open`: each match counted once.

`GET /v1/portfolio/transitions`
- Newest first.
- `since` must be ISO 8601 **with an offset** (`Z` or `+01:00`). A timestamp without an offset gives **422**.
- Row `cause`:
  - `kind`: `added` (first assessment) or `change`.
  - `available`: false means no drivers are claimed.
  - `drivers`: each with band before/after, `override` and citation ids.
  - `more_drivers`, `stopped_scoring`, `rules_changed`, both assessment ids, `record`.

`GET /v1/portfolio/{exposure_id}/reviews`
- Newest first. Item[0] is the standing review.
- `disposition`: `no_action` | `watch_list` | `intensified_care` | `escalated`.
- Also `note`, `next_review_on`, `reviewed_at`.
- Append-only. Owners and reviewers are not served.

`GET /v1/portfolio/reviews-due`
- `overdue` and `due_soon`, each **capped at 50**, soonest first.
- `overdue_total` and `due_soon_total` hold the exact counts.
- `window_days` is 14, today included. `never_reviewed` is a count. `as_of` is today in UTC.
- Row fields: `exposure_id`, `team_id`, `team_name`, `node_id`, `label`, `status`, `disposition`, `next_review_on`.
- Deactivated exposures are never listed.
- Takes **no limit/offset**. Sending either gives 422.

`POST /v1/portfolio/import`
- A preview only.
- Body: `csv` (≤2,000 rows), `dry_run` (always true; `false` gives **422** naming it), `limit` ≤100, `offset`.
- Rows are matched by register identifier alone. Each row returns an outcome and a reason.
- `counts` and `total` cover the whole file.

**Sole trader** [Portfolio]
- A natural person's business is never scored.
- Portfolio row: `status` `sole_trader`, every assessment field null, no `top_signals`, no `last_transition`.
- The summary counts it under `sole_trader`. It never appears in the transitions feed.
- In `/v1/search` its `score` is null.
- Its counterparty report, pack and company profile give 404.
- Every read that serves it writes a person access record.

**Entity risk**

`GET /v1/nodes/{node_id}/risk`
- The team's current assessment for one company.
- Includes `name` (equal to the portfolio row's `label`).
- Distinguishes three cases: not held / held but not yet assessed / assessed.
- A sole trader returns `sole_trader: true` and no assessment.

`GET /v1/entities/{node_id}/risk`
- Deprecated and retired. Returns **404 for every id** since 31 Oct 2026.

`GET /v1/risk-assessments/{assessment_id}`
- An append-only permalink.

`GET /v1/nodes/{node_id}/company` (the Network view)
- `identity`: facts with `record_id` → `identity_sources`, each source with `verified_at` and `retrieved_at`.
- `locale=de` gives German labels. Codes (`key`, `band`, `state`, `gap_reason`, `grade`, `status`) stay untranslated.
- `risk_state`: `portfolio` | `assessed` | `in_progress` | `not_assessed` | `sole_trader`.
- `risk_reason` (with `not_assessed`): `allowance` | `failed` | `not_started`.
- An on-the-spot assessment has `exposure_id` null.
- **An API read never starts an assessment.**
- `officers.state`: `on_record` (with `count`, `checked_at`) | `none_on_record` | `reading` | `not_read`. It is null without a Companies House number. An API read never starts a register read.

Risk details [Entity risk]
- Signal `band`: `red` | `amber` | `green` | `null`. Null means it could not be scored, and the row is still served with a `note`.
- Signal `state`: `evidenced` | `register_quiet` | `gap` | `awaiting_bank_input` | `not_applicable`.
- `gap_reason` examples: `register_not_integrated`, `no_public_register`, `paid_register_excluded`. The last two count as "explained" (terminal gaps).
- `grade`: `A` (statutory register, filed accounts, bank certificate) to `D` (name-only witness).
- Assessment shares:
  - `completeness`.
  - `evidence_completeness`: stricter, because it excludes bands a rubric assumed.
  - `seen_share`.
  - `explained_share`: seen share plus terminal gaps.
  - `reachable_share`: read by the `insufficient` floor.
  - `coverage_line`: 1-3 sentences.
- `/v1/portfolio` rows carry all three shares.
- `no_status_reason`: `no_accounts` only on an `insufficient` assessment of a company with no accounts on record, otherwise null.
- A signal whose sources all serve other countries is omitted entirely, neither served nor counted.
- An amber floor that rests on A/B-grade evidence keeps the status amber below the floor.
- `entity_class_detail`:
  - `entity_class`: `corporate` | `sovereign_or_public_body` | `bank` | `spv` | `fund`.
  - `source`: `analyst_override` or a register rule.
  - Also `confidence`, `decided_at`, `derived_class`.
  - The same object is also served under the deprecated name `entity_class`. On every other route `entity_class` is a string.
  - A sole trader has neither field.
- Bank rules:
  - Banks are scored on 4 rows: CET1, NPL/noncurrent, leverage, liquidity. Corporate distress rows read `not_applicable`.
  - Liquidity comes only from UK Pillar 3 (6 groups and 6 operating banks). For any other bank it is a gap.
  - A bank with no own ratio read never reads better than `insufficient` when its red/amber came from corporate models. It reads green only if the same company unclassified reads green.
  - A class rule never improves a status on its own.
- Data-freshness rules for green register rows:
  - The feed must be drained within its refresh interval + 6 h grace.
  - Edition-age limits: SEC EDGAR 5 days, INSEE Sirene 40 days.
  - Rows that SEC EDGAR serves stay unscored until a full search has run.
  - A Companies House charges row needs a full charges sweep.

**Scoring rubrics**
- `GET /v1/risk-profiles`: newest first.
- `GET /v1/risk-profiles/{version}`.
- `GET /v1/risk-config`: `version` is null while the built-in default is live.

**Institution registry**
- `GET /v1/entities`: in **name order**.
  - `kind` includes `trade_press`.
  - `kind_label`.
  - `location_label`: a country, or `Multilateral`.
- `GET /v1/entities/{entity_id}`.

**Search: `GET /v1/search?q=`**
- `q` takes 2-256 chars. Outside that range gives **422** naming `q`.
- Accepted query forms:
  - `lei:...`, an ISIN, or a register number (punctuation-insensitive).
  - A German entry with the court before or after, e.g. `Amtsgericht München, HRB 177273` or `HRB 177273 München`.
  - A name: one typo per word for well-known companies; umlauts written out or not; hyphen or space; `&`/`und`/`and`/`+`.
  - A query in a non-Latin script is matched as written, with no fuzzing.
- A 2-letter query is answered only when it is exactly a known short name (e.g. `VW`).
- `limit` caps at 25 and counts **companies only**. Persons come after all companies (at least a quarter of `limit` after a full page).
- Envelope: `{query, hits, connected_sources, truncated}`. It has **no `limit`/`offset`/`total` keys**. `truncated` is true when the page is full.
- Hit fields: `node_id`, `node_type` (`company` | `person`), `score`, plus jurisdiction and registration data. A person's `score` is null.
- Score bands: 1.0 exact, 0.95 prefix, 0.9 every word, 0.87 one typo per word, ≤0.85 near spelling.
- Ordering is rank order, **not always score order**:
  - Well-known leading entities come first.
  - A group's parent comes before a matching subsidiary, unless the subsidiary's full name was typed (example: `Bank Leumi`).
- Node status fields:
  - `company_status` is a closed list of 24 codes: `active` … `unknown`.
  - `company_status_label`.
  - `company_status_source`: the register's verbatim words.
  - An unlisted wording gives code `unknown` with the register's words as the label.
  - No stated status gives null in all three.

**Company nodes**

Person nodes
- A person node is served only where person data is on. Otherwise it gives the canonical 404, and so does a person who objected.
- Company-only reads (financials, financing, collateral, sector, regional, risk, and the ownership root) give 404 for a person id in every workspace.

`GET /v1/nodes/{node_id}`
- Identity plus all current records, newest first. `records_total`, and `registers` with counts, newest register first.
- **Streamed.** Cut off after 60 s.
- Can return **503 `server_busy`** while other reads of large companies are running.
- `merged_into`: the id of the node that holds the data now, null otherwise.

`GET /v1/nodes/{node_id}/records`
- Standard envelope plus `records_total` and `registers`.
- `connector_id`: case-sensitive values from the OpenAPI list. An invalid value gives 422. A listed register with no records gives an empty page.

`GET /v1/nodes/{node_id}/financials`
- Returns a **JSON array**. Takes no limit/offset.
- `derived` and `derivation`.
- `equity` (the parent owners' share), `total_equity`, `non_controlling_interests`.
- `value_number`. `value_numeric` is deprecated.

`GET /v1/nodes/{node_id}/financials/coverage`
- `state`: `on_record` | `merged_into` | `on_twin_record`.
- `line`, and `other_node_id`.

`GET /v1/nodes/{node_id}/sector-context`
- German Destatis statistics.
- `nace` param, which sets `nace_source` `caller`.
- `applies` is false outside Germany, with `missing` empty and a `note`.
- `value` is null when the table prints a sign, which `value_sign` then holds. Licence `dl-de/by-2-0`.

`GET /v1/nodes/{node_id}/events`
- Grouped and tier-ordered.
- `group` takes a `group_key`. An invalid or empty value gives 422.
- `tier`: `alert` or `review`.
- `attrs.history_backfill`.
- `insolvency_lookup.state`: `current` | `stale` | `pending` | `not_looked_up` | `not_requested`.
- `action`: a fixed sentence.
- `merged_into`.

`GET /v1/nodes/{node_id}/energy-emissions`
- `power_plants` (≥10 MW), `reported_emissions` (PRTR), `macro_context`.
- `binding_rule` and `binding_value`.

`GET /v1/nodes/{node_id}/regional-context`
- `economy`, `housing`, `indicators`, `labour_market` (13 months), `regional_database`.
- `status_flag` `p` marks a provisional figure.
- `region.method`, e.g. `insolvency_notice_seat_name`.
- `determined`, `reason`, `applies`.

Record `verify_status` [Company nodes]
- Values: `ok` | `gone` | `unreadable` | `null`.
- A `gone` record is never deleted.
- `handelsregister_de` records are never re-checked on a schedule.

**Financing**

`GET /v1/nodes/{node_id}/financing`
- `unmatched_lines` is empty unless person data is on.
- `stale_line`: set when the figure is more than 18 months older than the newest figure.
- `include_matured=true` adds matured instruments; the default counts them in `matured_excluded`.
- More than 20 active instruments are folded into `maturity_wall`.
- `bucket`: `within_12m` | `1_to_2y` | `2_to_5y` | `beyond_5y` | `no_maturity`.
- At most 500 instruments. `instruments_total`, `instruments_truncated`. `derived` always reads every active instrument.
- `terminated_excluded`.

`GET /v1/nodes/{node_id}/public-funding`
- `binding_basis`: `vat` | `de_register` | `lei` | `pic` | `de_register_number`.
- Totals never mix basis or currency.

`GET /v1/nodes/{node_id}/collateral-sites`
- Paged.
- `status`: `in_operation` | `planned` | `temporarily_shut_down` | `permanently_shut_down` | `unknown`.
- `total` counts sites inside Germany. `with_coordinates`.
- No geocoding.

**Network**

`GET /v1/nodes/{node_id}/network`
- Returns `nodes` and `edges`.
- Edge fields: `edge_type`, `role`, `role_code`, `role_label`, `pct`, `valid_from`, `valid_to`, `current`, `citation`.
- Current edges come before closed ones.
- `beneficial_owner_of` is never `shareholder_of`.
- `edge_types`: comma-separated, case-sensitive. An unknown type gives 422.
- `limit` max 200, **no offset**. `truncated`.
- Reading the network never starts a lookup.

**Ownership**

`GET /v1/nodes/{node_id}/ownership-chain`
- `threshold`: (0, 100], default 25.
- `max_depth`: 1-8, default 8.
- `params` echoes both, plus `include_persons`.
- `threshold_state`: `meets` | `may_meet` | `below` | `not_computable`.
- `pct_value` is a number. `pct` as text is deprecated.
- `register_owners` (PSC): `kind`, `name`, `pct_band`, `band_lo`, `band_hi`, `ceased`, `traced`, `gated`.
- `coverage_reason` `register_owner_not_traced`.
- Without person data a chain that reaches a person ends in a gated terminal.

**Register watches**

`GET /v1/watches`
- Newest first.
- `register_unscheduled` (the German register).
- `last_refreshed_at`, and `queued_check_by` (which can be null).

**Alerts**

`GET /v1/alerts/events`
- Newest first.
- `event_class`: `risk_red` | `risk_amber` | `insolvency_notice` | `sanctions_candidate` | `tender_match` | `press_candidate` | `monitoring_finding`.
- `severity`: `critical` | `high` | `info`.
- `team_id` null means workspace-wide.
- `source{kind,id}`, `occurred_at`, `created_at`.
- **Ids only, never a name.**
- A sole trader's `risk_red` and `risk_amber` are withheld.

`GET /v1/alerts/channels`
- `email` | `sms` | `teams` | `webhook` | `in_app`.
- `delivers`.
- `reason`: `provider_unset` | `demo_workspace` | `sms_limits_unset`.
- `test_receiver_only`.
- The same answer for every team.

`GET /v1/alerts/deliveries`
- Statuses:
  - Claim: `queued` | `held_budget` | `held_quiet` | `digest`.
  - Outcome: `sent` | `failed` (+`error_class`).
  - Terminal, at most one per delivery: `delivered` | `undelivered` | `dead_letter`.
- `endpoint_id` is null on a member's own channel.
- Filters: `event_id`, `status`, `channel`.
- Every `event_id` must be in the events list. A withheld event's id reads like an unknown one.
- No address, number or secret is ever served.

**News**

`GET /v1/news/companies`
- Paged. `latest` can be null.

`GET /v1/news/companies/{node_id}`
- `days`: default 30, max 90.
- `state`: `reading` | `too_little_coverage` | `feed_gap`. Only `reading` carries `tone_mean`.
- Article fields: `article_key`, `url`, `publisher_host`, `published_at`, `language`, `gdelt_tone`, `matched_organization`.
- `attribution`.
- `events[]` with `check.status`. Only `confirmed` events alert.
- A company outside your book or watch list gives 404.

**Social** (off until a licensed source is enabled; `source.enabled`)
- `GET /v1/social/companies`.
- `GET /v1/social/companies/{node_id}`
  - `days`: default 30, max 90.
  - `sentiment_net`, `platform_counts`.
  - `link_withheld`: `url` is null when the link would name a person.
  - **No author, handle, title or text.**
- `GET /v1/social/names`
  - `kind`: `company` | `agency` | `brand` | `person` | `topic`.
  - In name order.
  - `held`: `sole_trader` | `not_read` | null.
  - `source.attribution{text,text_de,url}`, `paused_until`, `days[]` (oldest first).
- `GET /v1/social/names/{target_id}`
  - `source_kind`: `organisation` | `media` | `person`.
  - `matched_word`, `platforms`.
  - An unknown name gives 404.

**Screenings**

`GET /v1/screenings`
- Newest first.
- Filters:
  - `entity_id`, `node_id`.
  - `iso3`: upper-case alpha-3.
  - `subject`: normalized match.
  - `subject_type`: `entity` | `country` | `person`.
- `coverage_incomplete` true gives `worst_verdict` `incomplete`.
- `scope_note`.
- `listed_on`: `EU`, `UK`, `OFAC SDN`, `OFAC non SDN`, `SECO`, `UN`. Only an identifier match enters it, never a name.
- `verdicts_awaiting_decision` > 0 means `worst_verdict` is a draft.
- `purpose` and `purpose_held` (screenings for employment, recruitment or tenant purposes are held and never run).
- A person screening has `worst_verdict` null and no assessments, summary or score.

`GET /v1/screenings/{screening_id}`
- Assessments carry `rationale` with `[f<id>]` tokens. Each token must map to a `finding_ids` entry and to a `findings[].finding_id`.
- `rationale_withheld`.
- "Conflicting evidence" sentence.
- `window_years`.
- `source_count`: distinct sources; `confidence: low` matches are excluded.
- Finding fields: `cited`, `excerpt_only`, `window` (`inside` | `outside` | `undated` | null), `matter_year`, `marks`.
- Rules for screenings drafted since 3 Nov 2026:
  - A green that cites a guilty plea, conviction or settlement is held at amber.
  - A red whose every finding is undated is capped at amber.

`official_lists`
- Deterministic: no search and no model.
- `basis`: `screening` | `not_stored` | `recheck` (a separate block).
- Per-list `status`: `listed` | `name_match_awaiting_review` | `name_match_reviewed` | `name_match_delisted` | `no_entry_found` | `not_checked`.
- `fields` lines: `same` | `differs` | `not_stated`.
- `counts`, `lists_compared`. Lists checked more than 48 h ago read `not_checked`.
- `published_fields` (`path`, `value`) and `published_note`.
- Countries are not compared.

`GET /v1/deals/{deal_id}/screening-rollup`
- The screening picture across a deal's parties.

**Sanctions person review**

`GET /v1/sanctions/person-candidates`
- Fields: `node_id`, `node_label`, `linked`, `list_name`, `designation_ref`, `matched_on` (`name` | `alias`), `narrowed_on` (`date_of_birth` | `nationality`), `official_url`, `status`.
- `status`: `open` | `confirmed`. **Open first.**
- No list date of birth or nationality is served.
- `lists` (6): `reading` `Checked` | `Not checked`, `edition`, `published_on`, `checked_at`.
- `lists_not_checked`, `persons_compared`.
- With person data off (and always in the sandbox) the route gives the canonical 404.

**Tenders**

`GET /v1/tenders/profiles`
- Criteria fields: `cpv_codes`, `nuts_codes`, `value_min_eur`, `value_max_eur`, `procedure_types`, `buyer_legal_types`, `form_types`, `deadline_min_days`, `keywords`.
- Also `use_case`, `active`. `team` filter.
- The author is not served.

`GET /v1/tenders/matches`
- Newest first.
- `status`: `new` | `dismissed` | `in_deal_book`.
- `profile_id` not in your teams gives **404**. `team` filter.
- `reasons[]`: `outcome`, `reason`, `field`, `stated`, `wanted`, `matched`.
- `notice{source_url, record_id}`.
- `buyer_withheld`. Winners are never served.
- `portal_notice` (then `notice` is null), `arrived`, `decided_by` (`portal_search` gives `profile_id` null).
- `deadline_passed` (MCP).

`GET /v1/tenders/matches/{match_id}`
- Who set a match aside is not served.

`GET /v1/tenders/deals/{deal_id}`
- Paged.
- A deal with no matches gives an empty list. A deal outside your teams or an unknown id gives **404**.

`POST /v1/tenders/portals/upload`
- Body: `file_name`, `source_portal`, `content_base64` (≤700,000 bytes), optional `mapping`, `limit` ≤100, `offset`, `dry_run`.
- `dry_run` is always true; `false` gives 422.
- `mapping_required` plus `columns`.
- 422 at `source_portal` (portal not accepted), at `content_base64` (whole file refused), or at `mapping` (needs `title` or `reference`, or `notice_id` + `notice_version`).
- `counts`, `counters`, `total`.

**Licensed data**

`GET /v1/licensed-data/facts`
- Fields: `name`, `stated_legal_form`, `register_value`, `register_status`, `lei`, `node_id`, `source_url`, `provider_updated_at`, `retrieved_at`.
- Only the licence scope `internal_systems` is served.
- Filters: `node_id`, `register`.

**Deals**

`GET /v1/deals`

Filters
- `stage`, `window`, `country_code`, `region`, `sector`, `status`, `eca`, `eca_named`, `min_value_usd`, `q`, `team`, `include_hidden`.
- Closed values are case-sensitive, as the OpenAPI lists them. An invalid value gives **422** naming the param, never an empty book.
- `country_code`: upper-case alpha-3, plus `XKX` (Kosovo). Two-letter, `ZZZ` or lower case gives 422.
- `min_value_usd` must be finite. `1e400`, `inf` or `nan` gives 422.
- `team`:
  - An id from `/me`, or `all`.
  - Empty or malformed gives 422.
  - Well-formed but outside your access gives **403**, and so does a team that does not exist.
- `q` and `eca`: ≤128 chars, else 422. `%` and `_` are literal.

Text search with `q`
- Whole words, case ignored. Searched fields: name, summary, buyer, exporters, agencies (including registry `full_name` and `aliases`).
- `NIS` matches the currency code, never "Ministry".
- A double-quoted phrase is matched as written.
- More than 8 words are matched as one phrase.
- Marks only (e.g. `₪`) are matched as typed.
- `q_matched[]`: `term`, `field` (`name` | `buyer` | `agencies` | `exporters` | `summary`), `value`. It is null without `q`.
- `eca` also matches reported spellings the row does not print. `q` does not.

Sort
- `sort`: `priority` (default) | `score` | `value` | `last_activity` | `stage` | `name` | `first_seen` | `latest_update`.
- `direction`: `desc` (default) | `asc`. `priority` and `latest_update` are desc-only.
- Rows without a value come last in both directions. `deal_id` breaks ties.
- An unknown sort or direction gives 422.

Row fields
- `agencies[]`:
  - `kind`: `eca` | `multilateral` | `dfi` | `development_bank` | `agency` | `bank` | null.
  - `kind_label`.
  - `roles`: `agency`, and `lender` when the lender list names it too.
- `eca_named` keeps exactly the deals with a `kind` `eca` agency.
- Hidden rows (`score_hidden`) are excluded unless `include_hidden=true`.
- Page fields: `stale_months`, `movement_months` (0 = rule off), `outside_markets_held`.

`GET /v1/deals/{deal_id}`
- `summary_lines` (3, rule-based) with `citations` (`finding_id` can be null).
- `next_action`.
- `timeline_limit`: ≤200 (MCP default 50).
- `tracking_scheduled_seconds`, `tracking_next_check_at`.
- `briefing`: `{text, drafted_at, drafted_by:"model", sources[{source_id,url,publisher,published_at}]}` or null.
- `score_reasons` and `lowered`.

`GET /v1/deals/parties/binding-queue`
- Ordering: followed deals first, then flagged, then parties with candidates.
- Row fields: `deal_id`, `deal_name`, `deal_followed`, `team_id`, `team_name`, `role`, `name`, `flagged`, `flagged_identifier`, `dismissed`.
- `candidates[]`: `node_id`, `label`, `country_iso3`, ≤3 `identifiers` (LEI first).
- A `deal_id` outside your team gives an **empty page** (not 404!).
- `pool_unbound`, `pool_note`.

`GET /v1/deals/merge/suggestions`
- Deprecated. Always `total` 0 and no items, for every caller.

Deal row semantics [Deals]
- Status and merging
  - `status`: `new` | `tracking` | `dismissed`, with `dismissed_reason` (e.g. `duplicate`, `historical`).
  - `merged_into` is null on standing deals. Folded rows are dismissed and appear only when status asks for dismissed.
  - Status carry precedence on a merge: tracking > dismissed > new.
  - `from_pool`, `dismissed_in_pool`. A deal dismissed in the pool cannot be reopened or followed.
- Score
  - `score_window` and `score_window_label`: financing open, early stage, not confirmed, financing set, cancelled.
  - The score is comparable only inside a window. Priority order never puts a closed deal above an open one.
  - `score_band`, `score_reason_count`, `score_hidden`, `score_own_bank`.
- State and dates
  - `state` and `state_label` (11 words). `null` means no source confirmed it.
  - A letter of interest older than 12 months reads "may have lapsed" and sits in the Not confirmed window.
  - `event_date` is a plain date. `event_date` and `last_event_at` are never in the future (UTC) and never later than the source's publication date.
- Value
  - `buyer` is always one of the parties' buyers.
  - `contract_value_raw` is never a date, a tenor or a capacity.
  - `value_basis`: `financing` | `contract` | `unclassified`. It is null exactly when `value_text` is null.
  - `contract_value_bound`: `at_least` | `up_to` | `range`. Then `contract_value_usd` is empty and `_min` / `_max` carry the figure.
  - `value_status`: `confirmed` (+`value_finding_id`) | `reported` (+`value_note`) | `absent`.
- Parties
  - `lenders`: in name order, never duplicating `agencies`.
  - `angle` and `ask`.
- Latest update
  - `latest_update{date, label (≤64 chars), state, finding_id}`.
  - `has_unseen_update` is **null for API keys**. A `/v1` read never counts as an open.

**Research**

`GET /v1/monitoring/targets`
- `cadence_seconds`, `scheduled_cadence_seconds`, `next_run_at`, `last_run_at`.
- `last_error`: `run_failed` | `screening_allowance_reached`. The latter means `next_run_at` is the first moment of next month (UTC).

`GET /v1/monitoring/catalog`.

`GET /v1/monitoring/sources`
- `active`. An inactive source stays listed.

`GET /v1/runs`
- Newest first, `run_id` breaks ties.
- `entity_kind` can be null.

`GET /v1/runs/{run_id}`
- Another team's run gives **404**, like an unknown one.

`GET /v1/developments`
- `sort`: `recent` | `score`.
- A person run's rows carry `relevance_score` null and are never ordered by score.

**Countries, reference, geography**

`GET /v1/countries`
- Returns `{regions, countries}`. Takes no limit/offset.
- `risk_reason` `below_coverage_floor` (public data covers less than half of the score weight).

`GET /v1/countries/{iso3}`
- Every indicator is listed, with `on_record` false where the edition has no value.

`GET /v1/reference/datasets`
- Returns a JSON array. Takes no limit/offset.
- A dataset that may not be republished is withheld rather than served unattributed.

`GET /v1/geography/summary` and `GET /v1/geography/events` (newest first).

**Citations**

`POST /v1/citations/resolve`
- Body: `record_ids`, `event_ids`, `assessment_ids`, ≤100 each.
- Every requested id returns its evidence line or an explicit `null`. Unknown and forbidden ids are indistinguishable.
- `headline` (events), `published_fields`, `published_note`, `locator`, `deep_link` (FIRDS), `notice` (SOGC text; null for every other source).

**Audit log**

`GET /v1/audit-log.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Inclusive. At most 3653 days.
- Columns: `ts,action,actor,team,target_type,target_id,run_id,model,meta`.
- Timestamps end in `Z`.
- Values are ids, counts, codes or times. An email appears only on invite, remove and first-SSO rows.
- `model` joins several models with `+`, or reads `unknown`. `meta` carries `served_models`, `served_providers`, `planned_models`.
- Needs the `audit` scope (or a signed-in admin). Otherwise **403 `forbidden`**.
- The export itself is audited.

**Documents** (need the `reports` scope; otherwise 403 `forbidden`)
- `GET /v1/deals/{deal_id}/report.pdf`
- `GET /v1/deals/{deal_id}/pack.pdf?locale=en|de` (default: the workspace's pack language)
- `GET /v1/entities/{entity_id}/report.pdf`
- `GET /v1/entities/{entity_id}/pack.pdf`
- `GET /v1/nodes/{node_id}/profile.pdf`: 404 if the register form names a natural person.
- `GET /v1/deals/{deal_id}/deck.pptx`
- `GET /v1/nodes/{node_id}/risk-deck.pptx`: 404 if the team does not hold the company.

Document rules
- Another team's deal gives 404.
- A busy renderer gives **503 `server_busy` + `Retry-After`**.
- Audited as `report_generated` / `pack_generated`.
- No download drafts a new summary.
- Two downloads of the same deck differ only in the generated moment.

**Health**

`GET /health`
- No auth, and no `RateLimit-Policy` header.
- Returns 200 `{status:"ok", app:"stonewake", version, environment:"production"}`.

### 2.3 MCP server [MCP]

Transport and protocol
- Endpoint `https://mcp.stonewake.ai/`. JSON-RPC over streamable HTTP. Stateless: no session id.
- Revisions:
  - `2026-07-28` needs no handshake. It requires the `_meta` envelope and the `MCP-Protocol-Version`, `Mcp-Method` and `Mcp-Name` headers.
  - Handshake revisions `2025-11-25`, `2025-06-18`, `2025-03-26`, `2024-11-05` open with `initialize`.
  - `server/discover` lists the versions.
  - A request with neither the envelope nor a version header is treated as a legacy request.

Auth and limits
- No key is needed for `tools/list`, `initialize` or `search_stonewake_docs`. Those are rate-limited **per client address**: 60/min (calendar minute). Sending a key with them changes nothing.
- Every other tool needs a key. Those calls count against the same per-key rate limit and workspace daily quota as REST.

**38 tools.** Each is listed with its key arguments and rules.

Portfolio and scoring
- `portfolio_overview`
  - `transitions_since` (ISO with offset), `limit`, `offset`.
  - Returns status counts, the active count, recent changes and the overdue count.
- `portfolio_book`
  - Paged, most severe first. `include_inactive`.
- `portfolio_import_preview`
  - CSV text, paged. Writes nothing.
- `portfolio_reviews_due`
  - Overdue plus due within 2 weeks, plus the never-reviewed count.
- `exposure_review_history`
  - `exposure_id`, paged, newest first.
- `entity_risk_profile`
  - `node_id`.
- `scoring_rubric`
  - The live config plus the stored versions.
- `sanctions_person_candidates`
  - Paged.
  - Returns `lists`, `lists_not_checked`, `persons_compared`.
  - Without person data it answers not found.

Company
- `search_companies`
  - Name, LEI, registration number, or `scheme:value`.
- `company_profile`
  - Takes **`entity_id`** (registry), NOT `node_id`.
- `company_overview`
  - `node_id`, `locale`.
  - `risk_state`, and the same rules as `/company`. Never starts an assessment.
- `company_financials`
  - Newest period first, with `derived`.
  - A missing period means nothing was filed, not zero.
- `company_events`
  - `group_key` expands a rollup.
- `company_financing`
  - `bucket`, `include_matured`, `terminated_excluded`.
- `ownership_chain`
  - `threshold` (default 25), `max_depth` (max 8).
- `company_network`
  - `edge_types`: validated client-side, case-sensitive.
  - `limit` ≤200.
- `company_public_funding`
  - Organisations only.
- `company_sector_context`
  - `nace`, `locale`.
- `company_records`
  - ≤25 per page, `connector_id` validated.
  - Never more than one page per call.
- `company_regional_context`.

Intelligence
- `screening_lookup`
  - A filtered list, or one run by `screening_id`.
- `deal_book`
  - The `GET /v1/deals` facets plus `sort`, `direction`, `include_hidden`, `deal_id`, `timeline_limit` (default 50, max 200).
  - Invalid facets are refused client-side, including a non-finite `min_value_usd`.
  - `has_unseen_update` is null.
- `deal_binding_queue`
  - `deal_id`, paged. `pool_unbound`, `pool_note`.
- (The deal duplicates tool was retired 18 Oct 2026. Calling it gives the unknown-tool error.)
- `country_profile`
  - The index (read in parts with `offset`), or one country by `iso3`.
- `developments`
  - A feed, or one run by `run_id`. Another team's `run_id` gives not found.

Tenders
- `tender_matches`
  - `status`, `profile_id`, `match_id` alone, or `deal_id` alone. Paged.
  - `deadline_passed`. The match keeps its status.
- `tender_profiles`
  - Writes nothing and runs no pass.
- `tender_export_preview`
  - Base64 file plus `source_portal`. Paged.

Licensed data
- `licensed_facts`
  - `node_id` or a German register. Paged.

Alerts
- `alert_events`
  - `event_class`, `severity`.
- `alert_channels`.
- `alert_deliveries`
  - `event_id`, `status`, `channel`.

News and social
- `company_news`
  - Without `node_id`, or with it. A company outside the book or watch list gives 404.
- `company_social`
  - `source.enabled`.
- `social_sentiment`
  - `target_id`, `node_id`. `paused_until`.

Documents
- `report_downloads`
  - `subject`: `deal` | `counterparty` (registry id) | `company` (node id). Plus `id`.
  - Reads the subject first, so an unreadable id gives `not_found`.
  - Returns `/v1` paths only and generates nothing.

Audit
- `audit_log_export`
  - `from` / `to` as `YYYY-MM-DD`, ≤3653 days.
  - Needs the audit scope, else `forbidden`.
  - Output is capped, so ask for shorter windows.

Documentation
- `search_stonewake_docs`
  - Query 2-256 chars. **No key needed.**

**MCP error mapping [MCP, Errors]**

| Situation | JSON-RPC code | HTTP (2026-07-28) | HTTP (older revisions) |
| --- | --- | --- | --- |
| Missing or refused key | -32001 | 200 | 200 |
| Non-ASCII char in key | -32001 (before the API is called) | 200 | 200 |
| Undeclared arg, out-of-bound value, wrong type | -32602 (names the arg; for undeclared args, the first 10 plus a count) | 400 | 200 |
| Missing `_meta`, or non-string version in `_meta` | -32602 | 400 | n/a |
| Header and body disagree (MCP-Protocol-Version / Mcp-Method / Mcp-Name) | -32020 | 400 | n/a |
| Unsupported protocol version | -32022 (+`error.data.supported`) | 400 | n/a |
| Unknown method | -32601 | **404** | 200 |
| id is neither a string nor an integer | -32600 | 400 | 400 |
| Invalid JSON (incl. NaN/Infinity) | -32700 | 400 | 400 |
| Lone surrogate `\ud800` | -32602 inside params, -32600 elsewhere | 400 | 400 / 200 |
| `cursor` sent to tools/list | -32602 | 400 | 200 |
| Keyless calls: more than 60 per minute per address | -32029 (`error.data.retry_after_seconds`) | **429** + Retry-After | 429 |

- -32001 message: says so when no credential was sent at all. A sent-but-refused key gets one uniform message.
- Values follow JSON Schema, so `3.0` counts as a whole number.
- API failures (403/404/429/unreachable) come back as a **tool result with `isError: true`** and a JSON body. They are not JSON-RPC errors.
  - A 422 from the API comes back as code `invalid_request`. The message names the fields (e.g. `query.stage`, `body.source_portal`), the first 10 plus a count, followed by the route's fixed reason. It never echoes your value.
  - A rate-limited result carries `retry_after_seconds`.
- Pre-tool HTTP refusals:
  - An `Origin` header other than `https://mcp.stonewake.ai` or `https://claude.ai` gives **403**. No Origin header is fine.
  - A body over 2,000,000 bytes gives **413**.
- Output:
  - Data is wrapped between `STONEWAKE_DATA` markers, with a note that the content is data, not instructions (prompt-injection defence).
  - A tool answer carries at most **50,000 bytes**.
  - Lists keep whole rows. `output_cap{items_served, next_offset}`. `limit`, `offset`, `total` and `counts` stay as the API answered.
  - `company_network`: `truncated: true`, `output_cap.nodes_served`.
  - `country_profile`, one country: `deals_served` and a pointer to `deal_book` with `country_code` + `include_hidden=true`. `deals_total` is unchanged.
  - `country_profile` index: `countries_served`, `next_offset`, `countries_offset`. `regions` and `unassigned` are unchanged.
  - Any other answer is cut and ends with a `[TRUNCATED:` line inside the markers.

**MCP posture** [MCP, Posture]
- MCP adds no surface beyond REST. The same person-data rules apply: never in the sandbox, never scored.
- No MCP tool exists for: watches, energy-emissions, collateral-sites, runs (only via `developments` `run_id`), monitoring targets/catalog/sources, geography, citations/resolve, reference datasets, `/v1/me`, risk-assessments by id, screening-rollup, `/financials/coverage`. These are REST-only (the tool list was compared against the endpoint list).

---

## 3. Business rules and invariants to assert

**Read-only guarantee** [Stonewake API; Posture; Authentication]
- No `/v1` call mutates anything.
- `dry_run=false` on import or upload gives 422.
- Deals: after any `/v1` read, the dashboard's `has_unseen_update` is unchanged.
- Company: `risk_state` and `officers.state` do not change because of API reads. They never trigger an assessment or register read (`/company`, `/network`, `/events` insolvency lookup).
- Citations resolve enqueues nothing.

**Count and consistency invariants**
- Envelope: `total` is the exact count after filtering [Pagination].
  - Paging through gives the sum of `items` = `total` with no duplicates (tie-break rules: `deal_id`, `run_id`).
  - The echoed `limit` and `offset` equal what was sent.
- `/v1/portfolio/summary` [Portfolio]
  - Status counts are over the active book only. They should equal the count of active `/v1/portfolio` rows per status, including `sole_trader`.
  - `transitions_30d ≥ status_changes_30d`. The difference equals the number of `kind: added` rows in the last 30 days.
  - `reviews_overdue` should equal `/reviews-due.overdue_total` and the portfolio rows with `review_overdue: true` (active only).
- reviews-due [Portfolio]
  - `len(overdue) ≤ 50`, `len(overdue) = min(50, overdue_total)`, and the same for `due_soon`.
  - Every `due_soon.next_review_on` is in [as_of, as_of+14].
  - Every `overdue.next_review_on` < as_of.
  - Lists are sorted soonest first.
- `/me` [Identity and team scope]
  - For a key, `all_teams` is false and exactly one team is listed.
  - That team equals `team_id` of the key, and `key.role == "viewer"`.
  - `key.scopes` ⊇ `["read"]`.
- Team scope [Identity and team scope]
  - Every portfolio, deal, transition, screening, run and development row has a `team_id` equal to the key's team.
  - The exceptions are screenings with `team_id` null (workspace-wide) and alerts with `team_id` null.
- Search [Search]
  - `len(company hits) ≤ limit ≤ 25`.
  - Persons always come after all companies.
  - Person `score` is null.
  - `truncated` is true iff the page is full.
  - No `total`, `limit` or `offset` keys.
- Deals filters [Deals]
  - With `eca_named=true`, every row has ≥1 agency with `kind == "eca"`.
  - With `q`, every row has non-null `q_matched` with one entry per term. Without `q`, `q_matched` is null.
  - Without `include_hidden`, no row has `score_hidden: true`.
  - `value_basis` is null ⇔ `value_text` is null.
  - `contract_value_bound` set ⇒ `contract_value_usd` empty and `_min` / `_max` present.
  - `latest_update.label.length ≤ 64`.
  - `event_date` and `last_event_at` ≤ today (UTC).
  - `merged_into` set ⇒ `status == dismissed`.
  - `buyer` ∈ the parties' buyers.
  - `lenders` contains no name already in `agencies`, and is sorted by name.
- Deal ordering [Deals]
  - With default priority, no "financing set" or "cancelled" window row sits above a "financing open" row.
  - With sort by value, null-value rows come last in both directions.
- `/v1/deals/merge/suggestions` [Deals]
  - `total == 0` and `items` is empty, always.
- Ordering checks
  - `/v1/entities`: name order [Institution registry].
  - `/v1/social/names`: name order [Social monitoring].
  - Portfolio: red first [Portfolio].
  - Network: current edges before closed [Network].
  - Sanctions candidates: open before confirmed [Sanctions person review].
  - Reviews history: newest first, and item[0] equals the portfolio row's `review` [Portfolio].
- Screenings [Screenings]
  - `coverage_incomplete` true ⇒ `worst_verdict == "incomplete"`.
  - A person screening has `worst_verdict` null.
  - `listed_on` ⊆ {EU, UK, OFAC SDN, OFAC non SDN, SECO, UN}.
  - Every `[f<id>]` token in a `rationale` resolves to an entry in `findings`.
  - `official_lists.counts` sum = number of lists.
- Financials [Company nodes]
  - `total_assets == total_liabilities + total_equity` unless a `note` says a line is missing.
  - `derived` rows have a `derivation`.
- Ownership [Ownership]
  - `params.threshold` and `params.max_depth` echo the request (defaults 25 and 8).
  - Hop count ≤ max_depth.
- Financing [Financing]
  - `instruments_total ≥ listed`.
  - `instruments_truncated` true iff more than 500.
- Alerts deliveries [Alerts]
  - Every `event_id` appears in `/alerts/events` for the same caller.
  - At most one terminal row per delivery.
- Timestamps [Pagination]
  - Every timestamp is UTC ending in `Z`, the CSV included.
  - Day-only values are `T00:00:00Z`. `event_date` is a plain date.
- Search scores [Search]
  - Score bands are exactly 1.0, 0.95, 0.9, 0.87, or ≤0.85.
- Health [Service health]
  - `/health` → `{status:"ok",app:"stonewake",environment:"production"}`. No RateLimit-Policy header.
- Rate-limit headers [Quickstart, For AI agents]
  - Every `/v1` response has `RateLimit-Policy`.
  - Keyed responses also have `RateLimit`.
  - A 429 has `Retry-After`.

**Things that must never appear in responses**
- The full key, except in the one create response.
- `secret` in a list or revoke response [Keys].
- In alerts:
  - Names [Alerts].
  - Channel addresses, numbers or secrets [Alerts].
  - A user's identity in deliveries [Alerts].
- Owners or reviewers on reviews [Portfolio].
- Profile authors and who dismissed a match [Tenders].
- Tender winners [Tenders].
- Social:
  - Authors, handles, titles or text in social items [Social].
  - A social URL that names a person (`link_withheld`) [Social].
- Sanctions list date of birth or nationality [Sanctions person review].
- Person data without the workspace flag, or in the sandbox: nodes, edges, persons in search, `unmatched_lines`, person `published_fields` families [Posture].
- A score, verdict, assessment, summary or relevance score on any person [Posture].
- A quote over 240 chars, or a quote without a source URL or attribution [Posture].
- Portal account, address or key [Tenders].
- Provider key or connection [Licensed data].
- A dataset that may not be republished [Countries].
- Rejected sanctions candidates [Sanctions person review].
- In the audit CSV, emails other than on invite, remove or SSO-first rows [Audit log].

**Source and reliability rules** [Posture]
- `source_tier` 1/2/3 with `tier_label`.
- `text_provenance` `snippet`.
- `reliability` `disinformation_network` (Pravda / Portal Kombat, VIGINUM). These sources are still shown but never count toward a verified update, a confirmed value or corroboration.

---

## 4. Auth, roles, permissions; 401 vs 403 vs 404 vs 422 vs 429/503

**Key format and header parsing** [Authentication]
- Format: `swk_live_` + 40 random characters, 49 chars in total.
- Header: `Authorization: Bearer <key>`.
- The scheme is case-insensitive: `bearer` and `BEARER` work.
- Separators and whitespace:
  - A single space must follow the scheme.
  - Extra spaces or tabs before the key, and spaces or tabs after it, are ignored.
  - A **tab instead of the first space** means no key was sent.
- No other character is trimmed. Any other character before, inside or after the key makes it a different key, so it gets 401.
- The scheme without a key, or another scheme (e.g. `Basic`, `Token`), means no key → 401.
- A key in a URL or query string is not supported. The header is the only channel.
- MCP parses the header identically. A non-printable-ASCII char in the key gives -32001 locally.

**401 posture** [Authentication]
- One identical body: `{"error":{"code":"unauthenticated","message":"Missing or invalid credentials."}}`.
- It is the same for all of these: missing, malformed, wrong, revoked, expired, lapsed workspace access.
- An API key used on a non-`/v1` endpoint (the dashboard's endpoints, `/org/api-keys`) gets the same 401.
- Test: compare body bytes, headers and timing across all 6+ cases. They should be indistinguishable.

**Roles** [Keys; Identity and team scope]
- Key role: always `viewer`. Scopes: `read`, optional `audit`, optional `reports`.
- `all_teams` is true only for a signed-in admin or compliance officer, never for a key.
- Admin and compliance officers read every team's runs, alerts and deliveries.
- Audit CSV: a key with the `audit` scope, or a signed-in **admin** only (compliance is not mentioned).
- Documents: a key with the `reports` scope, or a signed-in user of **any role**.
- Key management: dashboard admin session only.

**403 `forbidden`**
- Key create when API access is not enabled [Keys].
- Every `/v1` call and every workspace-reading MCP call with a key whose **team was deleted** [Keys]. This gives 403, not 401.
- Audit CSV without the audit scope [Audit log].
- Documents without the reports scope [Documents].
- `/v1/deals?team=<well-formed id outside access or nonexistent>` [Deals].
- MCP request with a foreign `Origin` header (plain HTTP 403, before any tool runs) [MCP Errors].
- Also mentioned: a 403 from `/v1` in Quickstart, explained on the Errors page (not in range).

**404 (canonical, never confirms existence)** [Errors in API reference; Keys]
- An unknown id, or an id in another workspace: revoke, and all `/v1` resources.
- Another team's `run_id` [Identity and team scope; Runs].
- Another team's deal: documents, `/tenders/deals/{id}`, every deal route [Documents; Tenders].
- `profile_id` outside your teams on tender matches [Tenders].
- Person node without person data, or a person who objected. Person id on company-only routes in every workspace [Company nodes].
- Sanctions person-candidates route without person data or in the sandbox [Sanctions person review].
- Person screening id without person data [Screenings].
- News or social for a company outside the book or watch list, or an unknown social name [News; Social].
- Sole trader: counterparty report, pack and company profile. `profile.pdf` for a natural-person register form [Portfolio; Documents].
- `risk-deck.pptx` for a company the team does not hold [Documents].
- Deprecated `/v1/entities/{id}/risk`: every id [Entity risk].
- MCP: unknown method gives HTTP 404 (`-32601`, 2026-07-28 only).
- Exceptions that give an empty result instead of 404:
  - binding-queue `deal_id` outside the team → empty page.
  - Person filter on screenings without person data → empty page.
  - citations/resolve → `null` per id.

**422 validation** [many sections]
- Field-naming `detail`. An unknown query parameter also gives 422.
- Examples:
  - `since` without an offset.
  - `expires_at` without a timezone or in the past.
  - A bad `team_id` on create.
  - `q` outside 2-256 (search) or over 128 (deals `q`/`eca`).
  - `offset` > 2^63-1.
  - limit/offset on the 4 whole reads, or offset on network.
  - Bad `connector_id`, `edge_types` or `group`.
  - Bad deals facets, sort or direction.
  - Non-finite `min_value_usd`.
  - `dry_run=false`.
  - Upload mapping, portal or content errors.

**429 and 503** [Quickstart; Company nodes; Documents]
- 429 codes: `rate_limited`, `daily_quota_exceeded`, `quota_unavailable`. Honour `Retry-After`.
- 503 `server_busy` on node reads of large companies and on document renders, with `Retry-After` on documents.
- The 413 body limit applies to MCP only (2,000,000 bytes).
- MCP keyless calls: 60/min per IP, then 429 with -32029.

---

## 5. Edge cases, negative tests, security angles

**Auth / key lifecycle (API)**
- The header matrix from [Authentication]:
  - `Bearer`, `bearer`, `BEARER`, `BeArEr` → 200.
  - `Bearer  key` (two spaces), `Bearer \tkey`, `Bearer key ` + trailing spaces or tabs → 200.
  - `Bearer\tkey` → 401.
  - `Bearer` alone, `Basic <key>`, `Token <key>`, no header → 401.
  - Key + trailing `\n` or NBSP, a key with one char changed, `swk_live_` + 39 or 41 chars → 401.
  - A key in `?api_key=` / `?key=` → 401 (and the unknown param could be 422; check which wins).
- After revoke:
  - The next request gets 401 immediately.
  - Revoke again: `revoked_at` is unchanged and the response is 200.
- Expiry:
  - A key created with `expires_at` a few minutes ahead gets 401 after expiry.
  - Create with `expires_at` in the past → 422.
  - Create with `expires_at` lacking a timezone (`2027-01-01T00:00:00`) → 422.
  - Create with `expires_at` using a `+02:00` offset → presumably 201; check it is normalised to Z.
- Name bounds: `name` "" → 422, 120 chars → 201, 121 → 422, missing → 422.
- `team_id` from another workspace → 422 (not 404). Omitted → default team.
- After deleting a team, its key gets **403 `forbidden`** (not 401). The list shows `team_name: null`.
- An API key on `/org/api-keys` (GET, POST, revoke) → 401. A key cannot revoke itself.
- Revoking another workspace's key id → 404, the same body as an unknown id (tenant-isolation test).
- Lapsed access:
  - List still works and `api_access_active` is false.
  - Revoke still works.
  - Create → 403.
  - `/v1` with an existing key → 401.
- `secret` appears once. A list or revoke response never contains it. The key prefix is visible.
- `last_used_at` is null right after creation and updates (with lag) after use. Do not assert an exact time.
- Scopes:
  - A plain key on `/audit-log.csv` → 403. An audit key → CSV.
  - A plain key on `report.pdf` → 403.
  - A reports key on another team's deal → 404 (not 403).
- An `audit` key is still read-only and team-scoped for everything else.

**UI (Playwright) angles** [Keys; Identity; Deals; Alerts]
- Workspace settings → API keys:
  - Create shows the full key once. After closing the dialog or reloading, only the name, prefix and usage metadata remain.
  - Form options: name, team selector, "audit" option, "Can also download reports and packs as PDF".
  - No expiry option in the dashboard (assert that keys created in the UI show no expiry).
  - Revoke keeps the row in the list (history). Newest first.
  - Non-admin users should not see or manage keys (implied: admin-only).
  - Disabled API access: the creation error message "API access is not enabled for your workspace. Contact your Stonewake representative."
- UI vs API parity:
  - The dashboard's key list equals `GET /org/api-keys`.
  - The settings page channel states equal `/v1/alerts/channels`.
  - Deal Book scores, band words and "Your bank is in" hover equal `score_band` and `score_own_bank`.
  - Reviews-due list rules are "the dashboard's list with its rules unchanged".
  - German locale (`locale=de`) dashboard text equals the API's German labels.
- `has_unseen_update`: opening a deal in the dashboard flips it for that user. API reads never do.
- Writes exist only in the UI: matching parties, confirming sanctions candidates, setting the entity class (`source` → `analyst_override`), applying a book import, confirming a tender upload. Verify that the API reflects these after the UI action.

**API negatives and boundaries**
- Pagination:
  - `limit=100` OK. `limit=101`: the behaviour is not stated (422 or clamp?). Test it.
  - `limit=0` and negative values: not stated.
  - `offset=9223372036854775807` OK (empty page). `offset=9223372036854775808` → 422. A negative offset should give 422.
  - Non-integer `limit=1.5`.
  - `offset` beyond total → empty items with the correct total.
- Whole reads: `?limit=1` on `/v1/countries`, `/v1/portfolio/reviews-due`, `/v1/reference/datasets`, `/financials` → 422.
- Network: `offset` → 422.
- Unknown query param on any route → 422 naming it.
- Search:
  - `q` of length 1 → 422, length 2 that is not a known short name → no hits, `VW` → hit, 257 chars → 422.
  - Non-Latin script (Hebrew, Cyrillic) → exact only.
  - SQL or wildcard chars.
  - `limit=26`: behaviour is not stated (422 vs cap).
- Deals:
  - `country_code`: `de`, `DE`, `ZZZ` → 422. `XKX` → OK.
  - `min_value_usd`: `1e400`, `inf`, `nan` → 422.
  - `q`: `%`, `_` are literal. 129 chars → 422.
  - `team`: empty → 422, malformed → 422, a random well-formed id → 403.
  - `sort=priority&direction=asc` → presumably 422 (priority is desc-only; not explicit). `sort=foo` → 422.
  - Lower-case enum values (e.g. `stage=TENDER` vs the listed case) → 422.
  - `q` precision: `NIS` must not match "Ministry". A quoted phrase. Nine words treated as a phrase.
- Transitions: `since=2026-10-30T22:20:00` → 422. `+01:00` → OK. A date-only value?
- Import:
  - 2,001 CSV rows → presumably 422 (not explicit).
  - `dry_run=false` → 422.
  - `limit=101` → 422?
- Upload:
  - `content_base64` of 700,001 bytes → 422 at `content_base64`.
  - A bad portal → 422 at `source_portal`, listing the accepted portals.
  - A mapping without a title or reference column → 422 at `mapping`.
  - An unknown header → `mapping_required` with `columns`.
- Citations resolve:
  - 101 ids in one list → presumably 422.
  - Unknown and foreign ids → `null` (an indistinguishability test).
  - Person records without person data → `null`.
- Records: `connector_id` in the wrong case → 422. A listed connector with no records → empty page, not 422.
- Events: `group=` (empty) → 422. A group from another node → 422 ("an events group the company does not hold").
- Ownership: `threshold=0` → 422, `100` OK, `100.1` → 422. `max_depth=0` or `9` → 422.
- Network: `limit=201` → 422? `edge_types=Officer_of` → 422.
- News or social `days=91` → presumably 422. `days=90` OK.
- Audit CSV:
  - `to` before `from` → 422 (MCP mentions "export window whose end is before its start").
  - 3654 days → 422.
  - A bad date format.
- Documents: `locale=fr` → presumably 422.
- Deprecated routes:
  - `/v1/entities/{id}/risk` → 404 for an id known to be valid as a node.
  - `merge/suggestions` → `total:0`.
- Large company `/v1/nodes/{id}` streams, is cut at 60 s, and may give 503 `server_busy`. Use `/records`.

**Data-integrity, IDOR and tenant isolation**
- id-space confusion [API reference intro; MCP]:
  - `node_id` and `entity_id` are both integers.
  - Passing a node id to `/v1/entities/{id}` or `company_profile` can return a *different* real record (not 404).
  - Tests should assert that the returned `name`/`label` matches the expected company.
- Cross-team: key A (team X) reading a team Y deal, run, tender or match must get 404 with the same body as a nonexistent id. Compare response bodies.
- Cross-workspace: ids from workspace B → 404 everywhere. Citations → `null`.
- Person data:
  - With the flag off or in the sandbox: search has no `node_type: person`, network has no person edges, ownership ends at a gated terminal, sanctions candidates → 404, person screening filter → empty page.
  - Every person-serving response writes an access record (audit side-effect test).
- Sole trader:
  - Never scored anywhere: portfolio, risk, search `score` null.
  - Never in transitions.
  - Its `risk_red` and `risk_amber` alerts are withheld.
  - News: `latest` null, `gdelt_tone` null.
- Deleted team: the key gets 403 on `/v1` and on MCP workspace-reading tools, while MCP `tools/list` still works.

**MCP-specific tests**
- `tools/list` with no key → 38 tools, including `search_stonewake_docs`. The retired duplicates tool is absent.
- `tools/list` with `cursor` → -32602.
- A tool call with no key → -32001, with a "no credential" message. A bad key gives a uniform message that is different from the no-credential one.
- Key with a non-ASCII char → -32001.
- Rate limit: 61 keyless calls in one calendar minute → HTTP 429 + `Retry-After` + -32029 with `retry_after_seconds`. Keyed workspace tools never count toward it. Sending a key with `tools/list` does not exempt it.
- Undeclared argument → -32602 naming it. With 12 undeclared args, the message names the first 10 and "+2".
- Type checks: `limit: 3.0` accepted as an integer. `limit: "5"` → -32602.
- Out-of-bound values: `max_depth: 9`, `timeline_limit: 201`, a network `limit` of 201, a docs query of 1 char → -32602.
- Client-side enum validation: `edge_types` mis-cased, `connector_id` invalid, `country_code: "deu"`, `min_value_usd` non-finite → refused "before a request leaves".
- Protocol (2026-07-28):
  - Missing `_meta` → -32602 / 400.
  - Header vs body mismatch → -32020 / 400.
  - `MCP-Protocol-Version: 1999-01-01` → -32022 with `data.supported` listing 5 versions.
  - Unknown method → -32601 / HTTP **404**.
  - `id: 1.5` or `id: null` → -32600.
  - Invalid JSON, `NaN` → -32700 / 400.
  - `\ud800` in params → -32602.
- Legacy: `initialize` works. A request with no version header and no envelope is served. Only -32700 and -32600 come with HTTP 400; others come with 200.
- Origin:
  - `Origin: https://evil.example` → 403.
  - `Origin: https://claude.ai` → OK. `Origin: https://mcp.stonewake.ai` → OK. No Origin → OK.
  - Try look-alikes: `https://claude.ai.evil.com`, `http://claude.ai`, a trailing slash, mixed case.
- Body over 2,000,000 bytes → 413.
- Output cap:
  - A large `portfolio_book` → ≤50,000 bytes of text, valid JSON between the markers, `output_cap.items_served` and `next_offset`, `total` unchanged.
  - Other tools end with `[TRUNCATED:`.
- `STONEWAKE_DATA` markers are present.
  - Prompt-injection angle: data containing instruction-like text must stay inside the markers.
- Tool errors from the API (403/404/429) → `isError: true` with a JSON body, not a JSON-RPC error. 422 → `invalid_request`, and the message never echoes your input (a reflection/XSS angle).
- `audit_log_export` with a non-audit key → `forbidden`.
- `report_downloads` for an unreadable id → `not_found`.
- `developments` with another team's `run_id` → not found.
- Parity: MCP results must equal the REST results for the same key (portfolio counts, deals ordering, `has_unseen_update` null).

**Security observations worth probing**
- Uniform 401: check timing side channels between a non-existent key and a revoked key [Authentication].
- `last_used_at` lag: rapid revoke-and-use races. Revocation is "on the next request".
- `/health` leaks `version` and `environment` without auth. This is by design, but note it.
- Docs search is usable without a key (60/min per IP). Check that it cannot read workspace data.
- The `Origin` allowlist on MCP is the DNS-rebinding/CSRF defence. REST has no stated Origin check.
- CSV injection in `/v1/audit-log.csv`: values are said to be ids, codes, counts and times, but `meta` and emails could carry `=`, `+` or `@` formulas. `model` uses `+` as a joiner.
- Quotes ≤240 chars with attribution. A briefing has instruction-like clauses ("confirm/verify/check/review") removed — an LLM-output sanitisation test.

---

## 6. Confusing or contradictory points

1. **The overview says "the document downloads answer PDF"**, but two of the seven document routes return **PPTX** (`deck.pptx`, `risk-deck.pptx`). [API reference intro vs Documents]
2. **404-canonical posture vs 403 on `team`.** The `/v1/deals?team=` parameter returns 403 for a nonexistent team, while every other "does not exist" case is 404. 403 for a nonexistent team arguably still hides existence (same as foreign), but it breaks the general pattern. [Deals vs Errors]
3. **A deleted-team key gets 403, not 401**, although Authentication says that keys refused for any reason all look the same as 401. The deleted team is a distinct, observable state. [Keys vs Authentication]
4. **binding-queue with another team's `deal_id` gives an empty page**, while every other deal route gives 404 ("as every deal route does" in Tenders). [Deals vs Tenders]
5. **Audit log access.** It is a "signed in user reads it only as an administrator", yet `all_teams` and team-wide reads cover "administrator or compliance officer". Compliance officers apparently cannot export the audit log. Confirm. [Audit log]
6. **Unstated limits:**
   - The default `limit` (the example shows 50, but it is not stated as the default).
   - The behaviour for `limit` >100 (422 vs clamp).
   - Over-limit behaviour for search `limit` >25, import over 2,000 rows and citations over 100 ids.
   - `priority` + `asc` (said to be "desc only" without stating 422).
   - The numeric rate limits and quotas are on the Errors page (out of range). [Pagination; Deals]
7. **`company_profile` naming (MCP).** It takes a registry `entity_id`, while the REST "company profile" PDF (`/nodes/{node_id}/profile.pdf`) and `report_downloads` subject `company` take a `node_id`. This is easy to confuse, and the id spaces collide silently. [MCP vs Documents]
8. **Deprecated alias shapes:**
   - `entity_class` is an object on `/nodes/{id}/risk` and `/company` (deprecated) and a string elsewhere.
   - `pct` is text (deprecated) next to `pct_value`.
   - `value_numeric` is deprecated next to `value_number`.
   Tests must not assume one shape. [Entity risk; Ownership; Pagination]
9. **`api_access_expires_at` example.** The example shows `2026-11-13` while the key `expires_at` is `2027-01-01`. Does a key outlive workspace access? Lapsed access gives 401 for all keys anyway. [Keys]
10. **MCP `portfolio_overview`.** "either alone lists the newest transitions of any date" is ambiguous: does passing `limit` or `offset` without `transitions_since` list transitions? [MCP]
11. **The REST transitions route has `since` but does not mention limit/offset explicitly.** It is presumably a standard list. [Portfolio]
12. **The bare-scheme rule.** "A tab in place of that space … sends no key at all", but "further spaces or tabs before the key … are ignored". So `Bearer \tKEY` works while `Bearer\tKEY` fails. This is subtle but consistent; a good test. [Authentication]
13. **Endpoint and tool counts check out:**
    - I counted 74 `/v1` routes in the reference (71 GET + 3 POST), matching the claim. `/health` is outside `/v1`.
    - I counted 38 MCP tools, matching "Thirty-eight".
    - Quickstart lists only three read-only POSTs. Correct. [API reference; MCP]
14. **Error envelopes differ in shape.**
    - 401 has only `error{code,message}`.
    - The `/org` 403 and 404 bodies add a top-level `detail` string.
    - `/v1` 422 puts the param name in `detail`.
    Assert per route; do not assume one shape. [Authentication; Keys; Errors]
15. **`reviews-due` "today (UTC)"** vs portfolio `review_overdue`, which says "once its next review date has passed". Does it share the UTC basis? An edge case at the UTC midnight boundary. [Portfolio]
16. **The Quickstart needs an "admin seat in the dashboard"**, but Authentication says keys can be created "over the API". That too requires the admin's dashboard session, not an API key. Wording only. [Quickstart; Keys]
17. **The MCP 2026-07-28 revision date** vs today (Nov 2026) is fine. Note that the legacy list includes `2025-11-25`. [MCP]

---

## 7. Judges' six flows: mapping and cross-surface test ideas

Flows: (1) Deal Book, (2) Screenings, (3) Network and Institutions, (4) Countries, (5) Monitoring and Portfolio, (6) API + MCP read-only parity. "Other scope" means outside the six flows.

### 7.1 Endpoint and tool to flow map

**Flow 1, Deal Book (search/filter, open deal with summary and sources, export)**
- REST:
  - `GET /v1/deals`: search with `q`; filter by stage, window, country_code, region, sector, status, eca, eca_named, min_value_usd, team, include_hidden; sort.
  - `GET /v1/deals/{deal_id}`: summary_lines, briefing, sources, timeline, score_reasons.
  - `GET /v1/deals/parties/binding-queue`.
  - `GET /v1/deals/merge/suggestions` (deprecated, empty).
  - Export: `GET /v1/deals/{id}/report.pdf`, `/pack.pdf`, `/deck.pptx` (the `reports` scope).
  - Sources: `POST /v1/citations/resolve` (shared with flows 2, 3, 5).
  - Agency names: `GET /v1/entities` (aliases are used by `q` and `eca`). Shared with flow 3.
  - `GET /v1/tenders/deals/{deal_id}`: deal-linked tender matches. Shared; tenders are otherwise other scope.
- MCP: `deal_book` (list and `deal_id` detail), `deal_binding_queue`, `report_downloads` (subject `deal`).

**Flow 2, Screenings (background check on a company, result with sources)**
- REST:
  - `GET /v1/screenings` (filters entity_id, node_id, iso3, subject, subject_type).
  - `GET /v1/screenings/{screening_id}` (assessments, findings, sources, `official_lists`).
  - `GET /v1/deals/{deal_id}/screening-rollup`.
  - `GET /v1/sanctions/person-candidates`.
  - Portfolio row fields `screening_id`, `screening_verdict`, `screening_confirmed`.
- MCP: `screening_lookup`, `sanctions_person_candidates`.
- Note: screenings are *requested* in the dashboard only. The API and MCP only read them [Posture].

**Flow 3, Network and Institutions (company profile, financing, ownership chain)**
- REST, profile:
  - `GET /v1/search`.
  - `GET /v1/nodes/{id}`, `/company`, `/records`, `/financials`, `/financials/coverage`, `/events`.
  - `GET /v1/entities`, `/v1/entities/{entity_id}`.
  - `GET /v1/nodes/{id}/profile.pdf`, `/v1/entities/{id}/report.pdf`, `/pack.pdf` (exports).
- REST, financing: `GET /v1/nodes/{id}/financing`, `/public-funding`, `/collateral-sites`.
- REST, ownership and network: `GET /v1/nodes/{id}/ownership-chain`, `/network`.
- REST, secondary context: `/sector-context`, `/regional-context`, `/energy-emissions` (German context, shown in profile).
- MCP: `search_companies`, `company_profile` (entity_id!), `company_overview`, `company_records`, `company_financials`, `company_events`, `company_financing`, `company_public_funding`, `ownership_chain`, `company_network`, `company_sector_context`, `company_regional_context`, `report_downloads` (subject `company` / `counterparty`).

**Flow 4, Countries (risk score and indicators)**
- REST:
  - `GET /v1/countries` (`risk_reason` `below_coverage_floor`).
  - `GET /v1/countries/{iso3}` (indicators with `on_record`, risk breakdown, related deals).
  - `GET /v1/reference/datasets` (attribution).
  - `GET /v1/geography/summary`, `GET /v1/geography/events`.
  - `GET /v1/screenings?subject_type=country&iso3=` (shared with flow 2).
- MCP: `country_profile` (index with `offset`, or `iso3`).

**Flow 5, Monitoring and Portfolio (add a company to monitoring, receive its updates)**
- Adding is a **dashboard (UI) write**. No API or MCP route adds anything. The API and MCP only observe the result.
- REST, portfolio:
  - `GET /v1/portfolio`, `/summary`, `/transitions`, `/{exposure_id}/reviews`, `/reviews-due`.
  - `POST /v1/portfolio/import` (preview only).
- REST, risk:
  - `GET /v1/nodes/{id}/risk`, `GET /v1/risk-assessments/{id}`.
  - `GET /v1/risk-profiles`, `/{version}`, `GET /v1/risk-config`.
  - `GET /v1/nodes/{id}/risk-deck.pptx`.
- REST, updates:
  - `GET /v1/watches`.
  - `GET /v1/alerts/events`, `/channels`, `/deliveries`.
  - `GET /v1/news/companies`, `/{node_id}`.
  - `GET /v1/social/companies`, `/{node_id}`, `/v1/social/names`, `/{target_id}`.
  - `GET /v1/monitoring/targets`, `/catalog`, `/sources`.
  - `GET /v1/runs`, `/{run_id}`, `GET /v1/developments`.
- MCP:
  - `portfolio_overview`, `portfolio_book`, `portfolio_import_preview`, `portfolio_reviews_due`, `exposure_review_history`, `entity_risk_profile`, `scoring_rubric`.
  - `alert_events`, `alert_channels`, `alert_deliveries`.
  - `company_news`, `company_social`, `social_sentiment`, `developments`.

**Flow 6, API + MCP read-only parity (cross-cutting)**
- REST: `GET /v1/me`, the auth and 401 posture, pagination envelope, rate-limit headers, `POST /v1/citations/resolve`.
- MCP:
  - Transport, auth and error codes (-32001, -32602, …).
  - `tools/list`.
  - `search_stonewake_docs`.
  - Output cap and `STONEWAKE_DATA` markers.
- Every endpoint and tool above is in scope for parity.

**Other scope**
- Tenders: `GET /v1/tenders/profiles`, `/matches`, `/matches/{id}`, `POST /v1/tenders/portals/upload`; MCP `tender_matches`, `tender_profiles`, `tender_export_preview`.
- Licensed data: `GET /v1/licensed-data/facts`; MCP `licensed_facts`.
- Audit: `GET /v1/audit-log.csv`; MCP `audit_log_export`. Useful only to verify that a read was recorded.
- Key management: `POST/GET /org/api-keys`, `/revoke`. A prerequisite for flow 6 setup, not a flow itself.
- `GET /health`.
- Deprecated `GET /v1/entities/{node_id}/risk` (always 404).
- No MCP equivalent (REST-only; parity cannot be tested): watches, energy-emissions, collateral-sites, monitoring targets/catalog/sources, `GET /v1/runs` list, geography, reference datasets, citations/resolve, `/v1/me`, risk-assessments by id, screening-rollup, financials/coverage.

### 7.2 Flow 6 test ideas: same data via UI, API and MCP (all read-only)

General harness: one key K (team T). Call the REST route and the MCP tool with identical params. Parse the JSON between the `STONEWAKE_DATA` markers. Compare ids, counts and order. Where the UI shows the same thing, scrape it with Playwright as the same team.

**Flow 1, Deal Book**
1. Filter parity:
   - `GET /v1/deals?country_code=DEU&stage=…&sort=value&direction=asc` vs `deal_book {country_code:"DEU", stage:…, sort:"value", direction:"asc"}`.
   - Same `total`, same `deal_id` order, same `stale_months`, `movement_months`, `outside_markets_held`.
   - The UI Deal Book with the same filters shows the same rows and count.
2. Search parity: `q=NIS` (REST) vs `deal_book {q:"NIS"}`. Same rows, same `q_matched` entries. The UI search box gives the same result set. No "Ministry" false hits on any surface.
3. Deal detail parity: `GET /v1/deals/{id}?timeline_limit=50` vs `deal_book {deal_id, timeline_limit:50}`.
   - Identical `summary_lines` (text and citations), `briefing` (or null on both), `value_text`, `value_status`, `state_label`, `score_band`, `score_window_label`, `latest_update`.
   - The UI deal page shows the same three summary lines and the same sources.
4. Sources: take every `finding_id` and `record_id` cited in the deal and `POST /v1/citations/resolve`. Each must resolve (not null), with a source URL and quote ≤240 chars matching what the UI shows.
5. Read-only proof: read the deal via the API and MCP 3 times. In the UI, `has_unseen_update` / unseen badge is unchanged. API and MCP both return `has_unseen_update: null` for the key.
6. Export: `report_downloads {subject:"deal", id}` returns `/v1/deals/{id}/report.pdf`, `/pack.pdf`, `/deck.pptx`.
   - GET each with a reports-scoped key → 200 PDF/PPTX.
   - A plain key → 403 via REST and `isError` `forbidden` via MCP.
   - Two `deck.pptx` downloads differ only in the generated moment.
   - The UI download button gives the same document.
7. Isolation: another team's `deal_id` → REST 404 and MCP not_found (`isError`), identical to a random id.
8. Hidden rows: `include_hidden` false on both surfaces → no `score_hidden: true`. Totals match the UI default view.

**Flow 2, Screenings**
1. List parity: `GET /v1/screenings?node_id=X` vs `screening_lookup {node_id:X}`. Same screening ids, newest first, same `worst_verdict`, `coverage_incomplete`, `listed_on`, `verdicts_awaiting_decision`.
2. Detail parity: `GET /v1/screenings/{id}` vs `screening_lookup {screening_id}`.
   - Same assessments and findings.
   - `official_lists` with the same per-list `status`, `basis`, `as_of`.
   - Every `[f<id>]` in a rationale resolves to a finding on both surfaces.
   - The UI screening report shows the same verdicts and sources.
3. Invariant on all surfaces: `coverage_incomplete` true ⇒ `worst_verdict` `incomplete` (never `no_findings` or `green`). A draft is indicated while `verdicts_awaiting_decision` > 0.
4. Portfolio link: the `/v1/portfolio` row's `screening_id` and `screening_verdict` equal the latest complete screening from the list, and `portfolio_book` shows the same.
5. Sanctions (person data on): `GET /v1/sanctions/person-candidates` vs `sanctions_person_candidates`. Same items, open first, same `lists_not_checked`, `persons_compared`. Off or sandbox → REST 404, MCP not_found.
6. Read-only: reading a screening never re-runs it (the screening's `as_of` and stored `official_lists` are unchanged; only `recheck` has a new `as_of`).

**Flow 3, Network and Institutions**
1. Search parity: `GET /v1/search?q=…` vs `search_companies`. Same `node_id` order and `score` bands, `truncated`. The UI search shows the same top hits (e.g. `Bank Leumi` parent before the UK subsidiary).
2. Profile parity: `GET /v1/nodes/{id}/company` vs `company_overview {node_id}`.
   - Same `identity` facts and `record_id`s, `risk_state`, `risk_reason`.
   - With `locale=de`, German labels on both, while codes stay English.
   - The UI Network view shows the same facts.
   - Re-read: `risk_state` must not move to `in_progress` because of the reads.
3. Institution: `GET /v1/entities/{entity_id}` vs `company_profile {entity_id}`. Same row.
   - Negative/data-integrity: pass a `node_id` as `entity_id`. Both surfaces may return a different record. Assert that the name check catches it.
4. Financing parity: `GET /v1/nodes/{id}/financing?include_matured=true` vs `company_financing {node_id, include_matured:true}`. Same `instruments_total`, `matured_excluded`, `terminated_excluded`, `bucket` slices. The UI financing tab agrees.
5. Ownership parity: `GET /v1/nodes/{id}/ownership-chain?threshold=50&max_depth=3` vs `ownership_chain {threshold:50, max_depth:3}`.
   - Same hops, `threshold_state`, `params` echo.
   - Bounds: `max_depth` 9 → REST 422, MCP -32602.
6. Network: `GET /v1/nodes/{id}/network?edge_types=officer_of&limit=200` vs `company_network`. Same edges, current edges first. A mis-cased type → REST 422, MCP refused client-side.
7. Records: REST `/records?connector_id=…` vs `company_records`. Same `records_total` and `registers` counts. MCP pages ≤25.
8. Financials: REST array vs `company_financials`. Same `derived` rows, and assets = liabilities + total equity.

**Flow 4, Countries**
1. Index parity: `GET /v1/countries` (whole) vs `country_profile` index read in parts via `output_cap.next_offset` / `offset`. The union of countries equals the REST list, with the same scores and `risk_reason`. `regions` and `unassigned` are unchanged.
2. Detail parity: `GET /v1/countries/DEU` vs `country_profile {iso3:"DEU"}`. Same risk score, breakdown, indicators (including `on_record:false` rows) and dataset attributions. The UI country page shows the same score and indicators.
3. Unscored country: `below_coverage_floor` on all three surfaces, with no score shown.
4. Related deals: the `country_profile` `deals_total` equals `GET /v1/deals?country_code=DEU&include_hidden=true` `total` (MCP output_cap points there).
5. Negatives: `iso3=deu` and `ZZZ` → 404 or 422 on REST, and an error or `isError` on MCP. Behaviour is not documented in range, so record it.

**Flow 5, Monitoring and Portfolio**
1. Add in the UI (watch list / portfolio). Then poll read-only:
   - `GET /v1/watches` shows the node (newest first, `last_refreshed_at` null → `queued_check_by`).
   - `GET /v1/portfolio` shows the exposure. The first assessment appears in `/transitions` as `cause.kind: added`. `transitions_30d` increments, `status_changes_30d` does not.
   - `portfolio_book` and `portfolio_overview` show the same.
2. Summary parity: `GET /v1/portfolio/summary` vs `portfolio_overview {}` vs the UI portfolio header counts. Equal status counts, `reviews_overdue`, `sanctions_name_matches_open`.
3. Book parity: `GET /v1/portfolio` vs `portfolio_book`. Same severity order (red first), `top_signals` order, shares.
4. Reviews: `GET /v1/portfolio/reviews-due` vs `portfolio_reviews_due` vs the UI list. Same overdue and due_soon, 14-day window, `never_reviewed`. `exposure_review_history` equals `/{exposure_id}/reviews`.
5. Risk: `GET /v1/nodes/{id}/risk` vs `entity_risk_profile`. Same bands, states, `gap_reason`, shares, `entity_class_detail`. After an analyst sets the class in the UI, both show `source: analyst_override`.
6. Updates:
   - `GET /v1/alerts/events` vs `alert_events`: same event ids, ids only and no names.
   - `/alerts/deliveries` vs `alert_deliveries`.
   - `/alerts/channels` vs `alert_channels` vs the UI settings page.
   - `/news/companies/{node}` vs `company_news {node_id}`.
   - `/social/...` vs `company_social` / `social_sentiment` (`source.enabled` agrees).
   - `/v1/developments` vs `developments`.
7. Import preview: `POST /v1/portfolio/import` vs `portfolio_import_preview` with the same CSV. Same outcomes and `counts`. Afterwards the portfolio is unchanged. `dry_run:false` → 422 / `invalid_request`.
8. Scope: a company not in the book or watch list → news/social REST 404 and MCP 404 `isError`. Another team's `run_id` → not found on both.

**Cross-cutting (flow 6 itself)**
- Same key on both surfaces: a revoked or expired key gives REST 401 `unauthenticated` and MCP -32001. Both are uniform and reason-free.
- A deleted-team key gives REST 403 `forbidden` and an MCP `isError` forbidden.
- Rate limit: keyed MCP calls share the REST per-key limit and daily quota. A REST 429 implies a rate-limited MCP result with `retry_after_seconds`.
- Pagination: REST `{items,limit,offset,total}` equals MCP `limit`/`offset`/`total` even when MCP `output_cap` truncates (`items_served` < `limit`, then continue from `next_offset`).
- Read-only sweep: call every MCP tool and every REST GET. Then the dashboard state (key list `last_used_at` aside, `has_unseen_update`, `risk_state`, insolvency lookup state) is unchanged. The audit log records only exports and downloads.
- Person-data gating is identical on both surfaces in a flag-off or sandbox workspace.
