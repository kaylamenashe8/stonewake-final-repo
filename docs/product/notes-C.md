# Stonewake prep notes C: errors, security, roles, data, a11y, changelog, public site

Sources: `llms-full.txt` lines 1492-2514 (cited by doc section, e.g. [errors], [api-security], [sec-overview], [onboarding], [sso], [sharepoint], [support], [data-handling], [coverage], [ai-act], [disclosure], [a11y], [changelog DATE], [terms-of-use]) and `site/*.md` (cited by file name, e.g. `site/terms.md`).
All of this comes from the docs only. Nothing was fetched from Stonewake.

## Flow tags (judges' priority)

| Tag | Flow |
| --- | --- |
| **[F1]** | Deal Book: search and filter deals, open a deal with its summary and sources, export it |
| **[F2]** | Screenings: background check on a company, read the result with its sources |
| **[F3]** | Network and Institutions: company profile, financing, ownership chain |
| **[F4]** | Countries: a country's risk score and its indicators |
| **[F5]** | Monitoring and Portfolio: add a company to monitoring, receive its updates |
| **[F6]** | Reading the same data through the API and the MCP server (read-only) |
| **[other]** | Outside the six flows (SSO, SharePoint, tenders, feedback, legal, etc.) |

"HIGH" marks changelog entries that touch a priority flow. These are the most likely places to find bugs.

## Read this first: what testers may and may not do

- **The ToS forbids automating the dashboard UI.** `site/terms.md` 4(j): "access or read the platform with bots, scrapers or other automated means, except through the API and the MCP server". [terms-of-use] says the same ("Do not read the dashboard with bots, scrapers..."). Screen readers are exempt. **Before running Playwright against app.stonewake.ai, get written permission from the competition organisers.** [F1-F5 UI]
- **ToS 4(g) forbids** "circumvent technical limits (rate limits, tenant isolation, render policies), probe or scan the infrastructure". The disclosure safe harbour ([disclosure]) does allow good-faith research that stops once an issue is shown. These two rules conflict (see section 8). [all]
- **Out of scope for security testing** ([disclosure]): other customers' workspaces and data, **denial of service**, social engineering, physical attacks, and third-party services (for example the US CDN and the UK auth provider). The safe harbour excludes any test that "degrade[s] the service". **Performance and load tests therefore need agreed ceilings.** [errors] says a workspace can hold its own ceilings "agreed with Stonewake, for example for a load test". Ask for this. [F6]
- In-scope hosts ([disclosure]): `stonewake.ai`, `app.stonewake.ai`, `api.stonewake.ai`, `docs.stonewake.ai`, `mcp.stonewake.ai`.
- **Evaluation rule** ([onboarding]): enter no bank data. Leave the facility and declarations of "Your terms" and the amount columns of a book import empty. Use public information only, and no personal data beyond your own account. [F5]
- **Never put live keys or workspace data in a bug report** ([api-security], [support], [disclosure]). Give the host, path, time and error code.

---

## 1. Errors and rate limits ([errors] lines 1492-1680)

### 1.1 The error envelope [F6, also F1-F5 via dashboard routes]
- Every refusal on every route returns one object: `{ "error": { "code": "...", "message": "..." } }`, under `/v1` and everywhere else.
- **Three exceptions:**
  - a **413 may arrive with no body**;
  - the MCP OAuth endpoints `/oauth/authorize` and `/oauth/token` answer in RFC 6749 form (a page for the person, or an `error` code as text).
- **One fixed message per code**, never one per call site, so a refusal does not reveal why it happened. The single exception is `quota_unavailable`, which has two messages.
- Codes are stable and are never renamed. New codes may be added. Clients should branch on `error.code`, not on the message text.
- Dashboard routes (including `/org/api-keys`) use the same envelope. The message is the dashboard's own sentence, and a top-level `detail` repeats it for older clients. Example: `{ "error": { "code": "not_found", "message": "API key not found." }, "detail": "API key not found." }`. [other/F6]

| Code | Status | Exact message |
| --- | --- | --- |
| `unauthenticated` | 401 | `Missing or invalid credentials.` |
| `forbidden` | 403 | `The credential does not allow this request.` |
| `not_found` | 404 | `Resource not found.` |
| `method_not_allowed` | 405 | `Method not allowed.` |
| `content_too_large` | 413 | `The request body is too large.` |
| `validation_failed` | 422 | `The request failed validation.` |
| `rate_limited` | 429 | `Rate limit exceeded. Retry after the number of seconds in Retry-After.` |
| `daily_quota_exceeded` | 429 | `Daily quota exceeded. The quota resets at UTC midnight.` |
| `internal_error` | 500 | `The request failed.` |
| `quota_unavailable` | 503 | `The daily quota could not be verified. The request was refused.` **or** `The rate limit could not be verified. The request was refused.` |
| `server_busy` | 503 | `The server is busy. Retry after the number of seconds in Retry-After.` |
| `service_unavailable` | 503 | `The service is unavailable. Retry later.` |

- Traffic refusals (429 and `server_busy`) also carry `retry_after_seconds`. Examples in the docs: 21, 14580 (daily) and 3 (busy).
- **Unauthenticated over-ceiling exception:** this 429 uses code `rate_limited` but adds `detail` with the text `Rate limit exceeded; slow down.` [F6]

### 1.2 Status semantics [F6]
- **401:** one body for every cause (missing, revoked, expired or malformed key). The SharePoint section confirms: "401 for a missing, revoked or expired key".
- **403:** "action not available to your workspace". Examples: creating a key while API access is off; a download without the reports scope.
- **404:** the API **does not distinguish** between "does not exist" and "belongs to another workspace". This is the key tenant-isolation oracle test.
  - An id that names nothing, in the path or as a filter such as `profile_id` on `GET /v1/tenders/matches`, answers 404 and **"never an empty page"**. See 1.4 for the contradiction with [changelog 12 Oct].
- **405:** `/v1` is GET only. The exceptions are `POST /v1/citations/resolve`, `POST /v1/portfolio/import` and `POST /v1/tenders/portals/upload`.
- **413:** a request body may be at most **1,000,000 bytes**; a book import at most **2,000,000 bytes**. The 413 may come with no body.
- **500:** never carries internal detail. Retry with backoff.
- **400 is not in the table**, yet [changelog 3 Nov] says a stale dashboard page cursor is "refused with 400". **409 is not in the table either**, yet [changelog 1 Nov] says adding a company the book already holds under its other record answers `409`. Both are good probes for an inconsistent envelope. [F1/F5]

### 1.3 422 `validation_failed` detail rules [F6, also F1-F4 filters]
- `detail[]` entries carry only `type`, `loc` and `msg`, **never the value sent**. `input` and `ctx` were removed (see [changelog Sept]).
- The body is **at most 32,768 bytes** whatever the request holds.
- It lists the **first 10 entries** in the order they were checked, then **one `too_many_errors` entry with an empty `loc`** whose `msg` gives the count, for example `1990 more entries are not listed.`
- A `loc` name longer than **64 bytes** and a `msg` longer than **2,048 bytes** are cut and end in `...`. Any text `detail` is cut at 2,048 bytes.
- **Unknown query parameter:** answers 422 with type `extra_forbidden`, one entry per parameter, and a `msg` that lists the parameters the endpoint reads. The point is that a misspelt filter never returns a *wider* list. Since [changelog 31 Oct] this holds on dashboard routes too, and since [changelog 2 Nov] on the API-reference files.
- **A single-valued parameter sent twice** answers 422 `value_error` naming it, whichever value comes first. Example: `sort=nope&sort=score`. List parameters such as `stage` may repeat.
- **A NUL character** in a path or query value answers 422, and so does a NUL in `file_name` on `POST /v1/tenders/portals/upload`. Before [changelog 24 Oct] this was a 500.
- Types:
  - `literal_error`: a closed value outside its list, such as an unknown `stage`, or a `country_code` that is not ISO 3166-1 alpha-3 in **upper case**. Matching is **case-sensitive**: `Financing` and `deu` are refused. The `msg` names the allowed values.
  - `finite_number`: `1e400`, `inf` or `nan`, in a query or a JSON body.
  - `timezone_aware`: a date-time with no offset, for example `since` on `GET /v1/portfolio/transitions`. It needs `Z` or a value like `+01:00`.
  - `value_error`: an endpoint rule. Examples: an export window whose end is before its start, a tender mapping with no title column, a `group` that is not one of the node's event groups. The `msg` never repeats the value sent.
- **MCP:** a tool call with undeclared arguments names the first 10 and counts the rest. Since [changelog 25 Oct] it answers `-32602` instead of ignoring them.

### 1.4 Id bounds [F6]
- [changelog 12 Oct]: an integer id that no record can hold (0, a negative number, more than **2147483647**, or more than **9223372036854775807** for `match_id`) answers like a missing id: **404 for a single record, "an empty page for a list filter"**. A value that is not a whole number answers 422.
  - This contradicts [errors]: "never an empty page". The later [changelog 31 Oct] says a tender `profile_id` that is not yours answers 404. **Test both.**
- Any `offset` runs from 0 to 9223372036854775807. A larger value answers 422; before [changelog Sept] it answered 500.
- MCP declares id arguments from **1 to 2147483647** and `offset` from **0 to 9223372036854775807**. A value outside these answers JSON-RPC **`-32602`** before any request reaches the API.

### 1.5 Ceilings [F6, also F1-F5 UI sessions]

| Who | Ceiling | Over-ceiling answer |
| --- | --- | --- |
| API key | **Per key, one-minute window.** Default example `q=120;w=60`. The `RateLimit-Policy` header is the authority, not the docs. | 429 `rate_limited` |
| Workspace (all keys) | **Daily quota**, example `q=50000;w=86400`, resets at **midnight UTC** | 429 `daily_quota_exceeded`; `Retry-After` counts to midnight |
| Signed-in person (session), dashboard and `/v1` | Per person, per **calendar minute**: **2,190 reads (GET/HEAD), 60 writes** (any other method) | 429 `rate_limited` + `Retry-After` + `retry_after_seconds` |
| Person, on the 5 PDF downloads and `GET /v1/audit-log.csv` | **60 per minute, reads included** | same 429 |
| Person whose minute cannot be counted | n/a | 503 `quota_unavailable` |
| No credential, per client address, per calendar minute | `/openapi.json` and `/docs`: **at least 1,200 per minute** | 429 `rate_limited`, `detail` `Rate limit exceeded; slow down.` |
| MCP, per address, calls that read no workspace data (`initialize`, `tools/list`, `search_stonewake_docs`) | **60 per minute** | HTTP 429 + `Retry-After`; JSON-RPC **`-32029`** with `retry_after_seconds` in `error.data` |
| MCP tool call with a key that reads workspace data | counts against that key | tool **result** carrying `retry_after_seconds` (no headers) |

- Custom ceilings for a workspace apply from its next request. A response to a request with no key always states the **defaults** ([errors], [changelog 26 Oct]).
- `RateLimit-Policy` names **key ceilings only**. A response to a person carries **no `RateLimit` state**.

### 1.6 Headers [F6]
- **Every `/v1` REST response**, authenticated or not (401, 403, 404 and 429 included), carries `RateLimit-Policy: "key-minute";q=120;w=60, "workspace-day";q=50000;w=86400`. The format is IETF `draft-ietf-httpapi-ratelimit-headers` Structured Fields. Header names are case-insensitive.
- Responses to a **keyed** request also carry:
  - `RateLimit: "key-minute";r=87;t=42` (`r` is requests left, `t` is seconds until reset);
  - `X-RateLimit-Limit`;
  - `X-RateLimit-Remaining`, which equals `r`;
  - `X-RateLimit-Reset`, a Unix time in seconds, `t` seconds after the response.
- `Retry-After` on a 429: for `rate_limited` it **equals `t`**; for `daily_quota_exceeded` it counts **to midnight UTC and takes precedence over `t`**.
- `quota_unavailable` has **no `Retry-After`**; retry with backoff. `server_busy` has `Retry-After`.
- MCP responses carry **none** of these headers.
- These headers have existed since [changelog 23 Aug]. The OpenAPI document has declared 401, 403, 429 and 503 on every endpoint, 404 on id lookups, 413 on the three POSTs, `Retry-After` and `RateLimit-Policy` since [changelog 24 Oct]. The security scheme is `bearerAuth`, and the `authorization` header parameter was removed.

### 1.7 503 `server_busy` and timeouts [F3, F1 export, F6]
- `GET /v1/nodes/{node_id}` for a company with a **very large record book** answers 503 `server_busy` while other large reads are running.
  - Page instead with `GET /v1/nodes/{node_id}/records`, newest first, with `records_total` and a count per register.
  - The node response **streams** and is **cut off after 60 seconds** (see [changelog Sept]).
- The **five PDF downloads** answer `server_busy` while every render slot is taken. This has been coded as `server_busy` since [changelog 24 Oct].
- **Statement timeout:** if nothing has been sent yet, the answer is `server_busy` with **`Retry-After` 15**. A download that is **already streaming ends early with no refusal**, so the file is silently truncated. That is a test target. Retry once, then narrow the request (smaller page, shorter period).

### 1.8 Retry guidance (verbatim intent)
- On 429, wait `Retry-After`, then retry.
- On a 503 with `server_busy`, wait `Retry-After`. On any other 503, use exponential backoff with a bounded number of attempts.
- For steady load, pace against `RateLimit` (`r`, `t`) rather than reacting to refusals.

### 1.9 How to test this safely (no hammering) [F6]
- **Read the ceilings first.** Send one unauthenticated GET to any `/v1` path, expect 401, and read `RateLimit-Policy`. That gives the key ceiling without spending quota.
- **Header-consistency checks on normal traffic:**
  - `X-RateLimit-Remaining == r`;
  - `X-RateLimit-Reset ≈ now + t`;
  - `r` decreases by exactly 1 per keyed request;
  - `t` counts down and resets at the window.
- **Trigger `rate_limited` cheaply.** The key ceiling is about 120 per minute by default, so a burst of `q+1` lightweight GETs (for example `GET /v1/me`) triggers it once. Then check:
  - the envelope, `retry_after_seconds == Retry-After == t`;
  - the headers are present on the 429;
  - the next request after `Retry-After` succeeds.

  Do this **once**, after asking the organisers. Better still, ask Stonewake for a low custom ceiling (for example q=5) on a test workspace.
- **Do not try to exhaust the daily quota on production.** Verify `daily_quota_exceeded` only against a workspace given a tiny custom daily quota.
- **The person ceiling of 60 writes per minute** is easy to hit with UI automation (which needs organiser consent, see the ToS). The **60 per minute on PDFs and the audit CSV** is the realistic one to verify.
- **MCP unauthenticated ceiling of 60 per minute:** 61 `tools/list` calls from one IP. Expect HTTP 429 + `Retry-After` + `-32029` with `error.data.retry_after_seconds`.
- **Ceilings for no credential:** use a docs-only route (`/openapi.json` has a ceiling of at least 1,200) only if you are permitted. It is low value; skip it.
- **Performance tests that stay within limits:**
  - measure latency per endpoint at **≤ r per minute**;
  - time `GET /v1/nodes/{id}` on a large company (UK companies are a good choice; GBR has 378,557 register events per `site/countries.md`) and watch the 60-second cut-off;
  - compare `/nodes/{id}` with paged `/nodes/{id}/records`;
  - time the PDF render;
  - time MCP tools that hit the 50,000-byte `output_cap`.
- **Concurrency of large reads** (to provoke `server_busy`) counts as load. Do it only with agreement.

---

## 2. Security posture and the tests it suggests

### 2.1 Claims ([api-security] 1683-1734, [sec-overview] 1738-1769, `site/home.md`)
- **Access**
  - API access is **off by default** for every workspace and enabled by arrangement.
  - Keys are created by an admin, **shown once**, stored as a **one-way hash**, and **revocable instantly**. [F6]
  - **Keys work only on `/v1` and the MCP server.** Every other endpoint refuses a key *exactly* as it refuses an invalid one, so a key never reaches dashboard endpoints or key management. [F6]
  - No anonymous reads.
  - The API is **read-only**. Keys cannot manage keys, **including themselves**. [F6]
- **Key format:** `swk_live_` prefix (`site/docs.md`). Keys can carry `scopes` such as `report_downloads` ("Can also download reports and packs as PDF") and an **audit** scope used for SIEM. A key has a `role`, `scopes` and `expires_at` (null means it never expires), shown in `GET /v1/me` → `key` ([changelog 4 Nov]). **A key reads exactly one team** ([sharepoint] "The key"). [F6]
- **Authorization header parsing** ([changelog 25 Oct]):
  - the scheme `Bearer` is accepted in **any letter case**;
  - **spaces and tabs around the key are ignored**;
  - **no other character is trimmed**, so any other character before, inside or after the key is refused, on both `/v1` and MCP.
  - On MCP, a key with a **character outside printable ASCII** answers `-32001` before the request reaches the API. [F6]
- **Isolation**
  - One key reads one workspace. Isolation is enforced "at multiple independent layers ... down to the database".
  - The SSO domain check runs **on every request**.
  - A sign-in to a different workspace inside a SharePoint frame is refused and ended at once. [F6, other]
- **Persons:** served only where **person data is switched on**, never in the **sandbox**, never scored.
  - Elsewhere a person answers the **canonical 404** ([changelog 5 Oct]).
  - Every API or MCP response that serves a natural person writes one **access record** (workspace, key, route and ids, **never a name**).
  - Fields that can state a natural person (free text, other parties, contact lines on sanctions entries) are replaced on the API by `published_note` ([changelog 4 Oct]). [F2, F3, F6]
- **Dashboard headers** ([sec-overview]):
  - CSP, frame denial (`frame-ancestors 'none'` + `X-Frame-Options: DENY` per [sharepoint]), HSTS and content-type protections on **every response**, "verifiable from any browser".
  - The only framing exception is `/embed/<embed id>`, and only by SharePoint sites the admin has listed. [F1-F5 UI]
- **Transport:** TLS everywhere; the API is HTTPS only; data encrypted in transit and at rest; nightly encrypted backups in Finland.
- **"A failed usage meter refuses the request"** (`site/home.md`), which matches `quota_unavailable`. The service fails closed, never unmetered.
- **AI:** `/v1` is deterministic with **no model at request time**. Downloads make no model call. API/MCP requests **never start an assessment** ([changelog 8 Oct]). [F6]
- **Auditing:**
  - Key creation, revocation and last use are recorded.
  - Every download is logged as `report_generated` or `pack_generated` with the key.
  - Every `/v1` person read writes a `v1_person_read` row with person ids. [F6]
- **Output sanitiser** ([changelog 10 Oct]): when `rationale`, `summary_text`, a deal `briefing.text` or a deal `ask` is read, **any clause asking the reader to confirm, verify, check or review is removed**. If nothing is left:
  - `rationale` falls back to a fixed neutral sentence;
  - `summary_text` becomes `null` with `summary_status` `failed`;
  - `briefing` becomes `null`.

  This is a prompt-injection or instruction-leak defence worth probing. [F1, F2]
- **SSRF-like claim** (library delivery): Stonewake calls only `login.microsoftonline.com` and `graph.microsoft.com` and "never follows an address an answer carries". [other]
- **Secrets:** SSO signing certificates and client secrets are "never written to our code or our database". The library client secret is sealed in a vault "under a key that never enters the database, and is never shown again". SCIM tokens are shown once. [other]

### 2.2 Concrete security tests suggested by the claims

**Authentication and keys [F6]**
- Missing key, wrong scheme (`Basic`, `Token`), `bearer`/`BEARER`/`BeArEr`, leading or trailing spaces and tabs (should pass), and these should all be refused:
  - a trailing `\n` or `\r`;
  - a zero-width space;
  - a quote character;
  - a key with one character changed;
  - a truncated key;
  - a key with the `swk_live_` prefix stripped;
  - two keys in one header;
  - two `Authorization` headers.
- Every 401 body must be byte-identical (`unauthenticated` / `Missing or invalid credentials.`) whatever the cause, so the response is not an oracle for "revoked" versus "never existed".
- Compare timing across causes as a weak oracle check.
- **A key on a non-`/v1` route** (dashboard API, `/org/api-keys`, SCIM `/scim/v2`) must answer the *same* refusal as an invalid key.
- **A revoked key** must stop at once. A key whose creator was **removed** must be revoked ([sso]). A key after **API access lapses** must stop authenticating while listing and revoking still work ([terms-of-use]).
- **Scopes:** a PDF download without `report_downloads` → 403. Audit CSV without the audit scope → presumably 403.
- `GET /v1/me` with a key shows `key.scopes`. With a session, `key` is `null`.
- **Read-only:** POST, PUT, PATCH and DELETE on every `/v1` path except the three POSTs → 405 `method_not_allowed`.
- The three POSTs are **previews**: `dry_run` is always true for import and upload. Send `dry_run=false` and confirm that nothing is written.
- `HEAD` and `OPTIONS` behaviour, plus a CORS preflight from a foreign origin. The SharePoint app section says only the workspace's own SharePoint origin gets a readable answer.

**Tenant and team isolation (IDOR) [F1-F6]**
- Iterate ids from another workspace or team (deals, entities, nodes, screenings, exposures, tender profiles, assessment ids, run ids). The answer must be **404 `not_found`, identical to a nonexistent id**, with **no timing difference**.
- A key reads only its own team: another team's deal → 404 ([sharepoint]).
- **Pool deals** (`from_pool`, `dismissed_in_pool`) are shared across workspaces. Check that no other workspace's follows, dismissals or notes leak ([changelog 31 Oct]).
- German insolvency lookups: "each workspace sees only its own lookups ... neither can tell" whether another workspace holds a company. **Notices are shared**, so check `looked_up_at` and `insolvency_lookup` for cross-tenant leaks ([coverage]). [F3]
- Register re-checks are "stored only for the workspaces it served ... Other workspaces can neither read it nor tell when it happened". Only the shared extract and its retrieval date are visible to all. [F3, F5]
- A person in a sandbox, or with person data off: must give the **canonical 404**, the same as any missing node. Check search (`node_type` `person` must not appear), `/nodes/{id}/network`, `/ownership-chain`, `/v1/watches`, `citations/resolve`, `official_lists` and `sanctions/person-candidates`. [F2, F3, F6]

**Injection and input handling [F1, F6]**
- `q` and `eca` on `GET /v1/deals` are matched **as typed**: `%` and `_` are **not wildcards** ([changelog 24 Oct]). Test `q=%`, `q=_`, `q=%25`, `q='`, `q="`, `q=\`, SQL-meta strings, and brackets or quotes (they "find only a name that holds one"). Also non-ASCII names "as typed". [F1]
- Quoted phrases in `q` are matched exactly. Each word is matched as a **whole word**, never part of a word ([changelog 31 Oct]). Check `q_matched`. [F1]
- Search: Hebrew or other non-Latin script → exact-script hits or **no hits, never a near spelling**. A 2-letter query is answered only when it is exactly a known short name (`VW`, `Haspa`). `&`/`und`/`and`/`+` are equivalent; a hyphen equals a space ([changelog 31 Oct, 1 Oct]). [F3, F6]
- NUL bytes, lone surrogates (`\ud800`: `-32602` inside `params`, `-32600` elsewhere on MCP), very long strings (the `search_stonewake_docs` query is limited to **256 characters**), `1e400`/`NaN`/`Infinity`, and bodies just over 1,000,000 bytes and 2,000,000 bytes (book import).
- **MCP JSON-RPC fuzzing:**
  - invalid JSON, including `NaN` → `-32700`;
  - an `id` that is neither a string nor an integer → `-32600`;
  - a `cursor` on `tools/list` → `-32602`;
  - undeclared arguments → `-32602`;
  - out-of-bounds arguments → `-32602`;
  - an unknown method → `-32601` (HTTP **404** on revision 2026-07-28, **HTTP 200** on earlier revisions);
  - revision 2026-07-28 requests missing `_meta` → `-32602` at HTTP 400; a header that disagrees with the body → `-32020` (400); an unsupported version → `-32022` (400);
  - earlier revisions: every error at HTTP 200 except `-32700` and `-32600`, which are HTTP 400 ([changelog 25 Oct]). [F6]
- **Tender upload** (`POST /v1/tenders/portals/upload`, [other]): CSV, XLSX and eForms XML. Test formula injection in CSV, XXE in XML, a zip bomb in XLSX, a NUL in `file_name`, an unreadable `mapping` (the 422 is at `mapping`), and a refused portal (the answer names the accepted ones).
- **Book import** (`POST /v1/portfolio/import`, `csv` field) [F5]: CSV injection, identifiers that fail their checksum (`invalid`), duplicates (`duplicate`, `in_book`), and a 2,000,001-byte body.

**Data leakage [F1-F6]**
- A 422 must **never echo the input value** (including inside `msg`). Send a secret-looking marker string and grep the response.
- A 500 must not carry stack traces or internal details.
- The **audit CSV** must contain no screening subject, no address of a page a screening left out, no research question, **no API key name**, and **no sign-in email**. An email may appear only on rows for a member invited, removed, or first signed in by SSO. `actor` = `stonewake_operator` for operators. Every timestamp ends in `Z` ([changelog 4 Nov]). [other/F6]
- Person screenings must not serve verdicts, summaries or scores anywhere (API, MCP, report, audit export). **Dates of birth and nationalities of listed persons are served nowhere** ([changelog 30 Sep]). [F2]
- Sole traders: no score, status, tone or sentiment; no `entity_class` on the portfolio row; `withheld` leaves social answers. [F3, F5]
- `has_unseen_update` must be `null` for an API key ([changelog 30 Sep]). [F1]
- `GET /v1/alerts/deliveries` must list only deliveries of alerts that `/v1/alerts/events` serves. There must be no withheld sole-trader alert and no person alert when person data is off ([changelog 24 Oct]). [F5]

**Session and UI security [F1-F5 UI]**
- Check headers on every dashboard response: CSP strength (no `unsafe-inline`?), `X-Frame-Options: DENY`, `frame-ancestors 'none'` (except `/embed/...`), HSTS (max-age, includeSubDomains), `X-Content-Type-Options: nosniff`.
- Clickjacking test: frame `app.stonewake.ai` from a local page; it must be refused.
- **Embed frame:**
  - the session is held **in memory only**, with no cookie or storage, and reloading asks for sign-in again;
  - the admin pages (API keys, members, sign-in settings, site list) must not open inside the frame, and **the API refuses those changes from a framed page**;
  - the sign-in popup sends its `postMessage` only to Stonewake's own origin.

  These are CSRF and postMessage-origin tests. [other]
- The set-password link works **once** and expires after **1 hour**. Opening it alone "checks nothing until the person continues", so a mail scanner does not burn it. The page names the account before anything is kept in the browser ([changelog 20 Oct]). Test reuse, expiry, and opening without continuing. [other]
- Access tokens expire after **1 hour** and renew only while the session is active. Sign-out ends the session. Removal ends every session **on its next request**.
- An account signed in with a given password **must set its own**; the option to keep the given one is gone ([changelog 4 Nov]).
- Since [changelog 21 Aug] the sign-in gate fails closed: **an account with no assigned role and team is refused**.
- `security.txt` (`site/.well-known_security.txt.md`): `Contact: mailto:contact@stonewake.ai`, `Expires: 2027-08-11T00:00:00.000Z`, `Preferred-Languages: en, de`, `Policy: https://docs.stonewake.ai/security-disclosure`, `Canonical: https://stonewake.ai/.well-known/security.txt`. **The dashboard and docs are supposed to carry copies pointing to the canonical one**: verify.

### 2.3 Disclosure policy ([disclosure] 2263-2291, [support])
- Report to `contact@stonewake.ai` with "Security" in the subject, in English or German. Include the host, path, request and observed effect. No keys or data.
- They **acknowledge and assess**. [support] adds "acknowledged within **three business days**, followed by a first assessment with an indicative fix path".
- **There is no bug bounty.**
- Safe harbour covers good-faith work in scope that stops at demonstrating the issue, does not touch others' data, and does not degrade the service. Give them a reasonable time to fix before disclosure. It does not bind third-party infrastructure.

### 2.4 Acceptable-use limits from the terms ([terms-of-use] 2482-2514, `site/terms.md`)
- Use is internal only. Do not share keys, resell, systematically extract, or run a public product over the data. [F6]
- Do not circumvent rate limits, quotas, tenant isolation or read-only access. No bots or scrapers on the dashboard. No sole automated decisions about people. No scoring of people's creditworthiness.
- ToS 4(c): person screening is for **CDD/EDD only**. **Employment, tenant, consumer, marketing and law-enforcement uses are prohibited.** The product enforces this:
  - a purpose naming employment, recruitment or tenant screening → **422** ([changelog 4 Nov]);
  - a person request with `other` → **422** ([changelog 1 Nov]).

  [F2]
- Attribution: preserve source names, ids, retrieval dates and attribution lines. TI CPI is **CC BY-ND 4.0, displayed unmodified**; WB WGI is CC BY 4.0. [F4]
- Governing law: German law excluding the CISG (ToS 14.1). Venue: **Potsdam** (14.2). English prevails (14.3). The ToS can change with 6 weeks' notice (13.1). Wind-down: 30 days (12.3). Liability is capped at the fees for 12 months (11.3). The provider may suspend for a suspected violation (§4).

---

## 3. Roles, onboarding, SSO, teams [mostly other; roles touch F1-F5]

### 3.1 Workspace, teams, roles ([onboarding] 1773-1806)
- Each institution has one **isolated workspace** (its own users, teams, audit trail and **cover-page branding** on downloads).
- **Teams mirror desks.** A team's **module set** trims the nav, the downloads, the built-in guide and the quick-start PDF everywhere. Test that a hidden module is unreachable by direct URL and by API. [F1-F5]
- Roles are **cumulative**: Viewer < Analyst < Compliance < Admin. The same table appears under Workspace settings → Members.

| Role | Can |
| --- | --- |
| Viewer | Read the team's deals, countries, institutions, screenings and reports, and download them |
| Analyst | + start screenings, dossiers, research and monitoring; edit deals; decide screening reviews **for their team** |
| Compliance | + **read every team** of the workspace |
| Admin | + run the workspace: members, **API keys**, alerts, branding, connections and settings; **export the audit log** |

- `site/terms.md` 3.3 lists "analyst, viewer, administrator", **with no compliance role**. Small inconsistency.
- Role tests: a viewer cannot start a screening, add to monitoring or edit a deal. An analyst cannot see another team. Compliance can see all teams but cannot manage keys. Only an admin exports the audit log.
- **SharePoint app reads always act as a viewer of the person's own team**, whatever their role. [F1, F2, F5]
- Members (admin view, [changelog 4 Nov]): role, team, last sign-in, the seat line, invite, change role or team, **remove after a confirmation**.
- Password reset is **not self-service**: "a forgotten password is reset through a new link from your Stonewake contact". New users and leaver removals also go through the named contact ([support]).
- **Support:**
  - Report an issue (sidebar) attaches the page and is persisted before delivery, with a same-day reply.
  - There is **no SLA, no status page and no phone line** ([support]).

### 3.2 Authentication ([sec-overview], [onboarding], [sso])
- Sign-in is by work email and password through a managed auth service whose accounts are kept in the UK.
- **Optional second factor:** a 6-digit TOTP (for example Microsoft Authenticator), switched on by an admin under Workspace settings → Sign in and directory. A QR code is shown at the next sign-in.
- **The single sign-on (SSO) password link** is valid for one hour and one use.
- **Removal or SCIM deactivation** ends access at once: every session (on its next request), the **API keys the member created** and the **assistants the member approved**. The account can no longer sign in.

### 3.3 SSO ([sso] 1810-1944; [changelog 12-14 Oct, 4 Nov])
- SSO is **per workspace by arrangement**, for **Microsoft Entra ID over SAML 2.0** only. Other identity providers: ask first. There is **no self-service setup**.
- Flow: enter work email → "Continue with your organization" → the identity provider. Stonewake never sees the password. **Only SP-initiated sign-in completes**: the Entra Sign on URL must be `https://app.stonewake.ai/login`, with Relay State and Logout URL left empty.
- **First sign-in** creates the account with the agreed **default role (viewer, analyst or compliance), never admin**. It is written to the audit trail with the role and where the role came from.
- **Role claim mapping:**
  - only values stated in the assertion are read;
  - **unmapped values are ignored and counted**;
  - a mapped role **never drops below the default**;
  - the role is re-read at every sign-in, and a lost value drops the role at the latest at the next sign-in after the session lifetime; old and new roles are audited;
  - **an admin is never changed by a sign-in**, and no claim can make anyone admin.
- **Domain check:**
  - an account lands only in the workspace that owns its email domain, **and** only if it came through that workspace's identity provider with the registered issuer; otherwise it is refused with no workspace;
  - **one workspace per domain**; never public domains such as `gmail.com`;
  - Entra proof: Microsoft public records show the domain belongs to the managed tenant, and the signing certificate was read from that tenant (no DNS needed);
  - other identity providers: a **TXT record `_stonewake-challenge.<domain>`** with the exact value;
  - a change of issuer or identity provider → SSO off until the domain is proven again;
  - **checked at first sign-in and on every request**.
- **Session lifetime:** set between **15 minutes and 24 hours** from the sign-in at the identity provider.
  - Sign-out ends the Stonewake session and then redirects to the identity provider's sign-out (signing out of Microsoft too).
  - **No SAML single logout**: logging out only at the identity provider does not end the Stonewake session before its lifetime runs out.
- **Fail closed:** SSO stays off if any of these is missing: the identity provider, its issuer, the default role, the team, the session lifetime, the identity provider's sign-out address, or at least one proven domain. Switching SSO off ends every SSO session **within a minute**.
- **SSO-only mode:**
  - password and **mail-link** sign-ins are refused, and the login page tells the person to continue with their organization;
  - it ends connector approvals given without an org sign-in (except for break-glass accounts);
  - **break-glass accounts: 0 to 5**; they keep a password (plus TOTP if the second factor is on);
  - with break-glass accounts, the setting applies only while SSO is on and complete; if SSO goes off, password sign-in works again for accounts that have a password;
  - **without break-glass accounts**, password sign-in never reopens by itself; only Stonewake lifts the setting (reason audited), on the same day within support hours, effective within a minute.
- **Carry-over of existing logins** ([sso], [changelog 13 Oct]):
  - At the first Microsoft sign-in a new login is created. If the verified Microsoft email matches **exactly one** other open login, the team, role, alert channels, quiet hours, subscriptions, deal read markers, evaluation-terms acceptance, connector approvals, language, display name and walkthrough state move over.
  - **The admin role is never carried.**
  - The old login is closed unless it is break-glass.
  - With zero or several matches nothing is carried: default role and team.
  - **"API keys belong to your workspace and not to a login, so they keep working"** (see section 8, contradiction with the removal rule).
- **Entra setup facts:**
  - the Identifier (Entity ID) and Reply URL come from the Stonewake contact;
  - claim `user.mail`;
  - **never edit the Name ID** after the first sign-in, because it creates a new login;
  - SHA-256 signature, certificate valid 3 years; add Stonewake's notification email; warn Stonewake before rotating the certificate;
  - send the App Federation Metadata URL;
  - Assignment required = Yes (Global Administrators can still sign in; group assignment needs P1/P2; **nested groups are not assigned**);
  - no DNS record and no directory permission are needed.
- **SCIM 2.0** at `https://api.stonewake.ai/scim/v2`:
  - the token is shown once, and there are **at most 3 unrevoked tokens**;
  - mappings `userName`, `active`, `externalId`; **groups are not provisioned**; the cycle runs about every 40 minutes;
  - created users get the SSO role and team, **never admin**, and their domain must be verified;
  - deactivate or delete → access ends at once; reactivation → sign in again, with **no old sessions restored**;
  - SCIM touches **only accounts it provisioned**; never admins or break-glass accounts; **never removes the last admin**;
  - every token issued or revoked is audited.
- **Assistants (Claude, ChatGPT) approved through SSO:**
  - they keep reading while the person signs in by SSO at least once every **7 days**, and stop at the latest **7 days + 1 hour** after the last SSO sign-in;
  - they pause within a minute if SSO is off or incomplete; a different identity provider or a dropped email domain also pauses them;
  - Workspace settings shows Active / Paused / Ended with the reason in plain words;
  - the approver or an admin can end one. [F6 (MCP via assistants)]
- **Admins see SSO read-only.** They can change only the second-factor setting and SCIM tokens. The audit CSV covers the whole retention. A SIEM can collect it with an **audit-scope key**.

### 3.4 SharePoint and Teams ([sharepoint] 1948-2073) [other, with F1/F3 documents and F6]
- **Embed:**
  - admin-listed **exact** site origins only;
  - wildcard (`*.sharepoint.com`), a path, a port, or `http` → refused;
  - OneDrive `-my.sharepoint.com` needs a separate entry;
  - the list starts empty, and changes are audited before and after;
  - embed URL `https://app.stonewake.ai/embed/<embed id>` (a random id); iframe `width="100%" height="900"`;
  - the popup must be allowed; a sandbox that blocks popups breaks sign-in.
- **SPFx app `stonewake.sppkg`:**
  - SharePoint obtains a token for "Stonewake API" with `Workspace.Read`, accepted **only from the SSO-proven tenant, only on `/v1`**;
  - the token is mapped to a login by the **Microsoft object id, never by email**; no login → a short notice and no data;
  - CORS allows only the tenant's own SharePoint origin;
  - after revocation a token lives at most **2 hours**; OneDrive addresses are refused.
- **Documents over `/v1`** (with the reports scope) [F1, F3, F6]:
  - deal report and **deal committee pack** (by deal id from `GET /v1/deals`), e.g. `GET /v1/deals/<id>/pack.pdf?locale=de`;
  - counterparty report and pack (by registry id from `GET /v1/entities`; `GET /v1/entities/{entity_id}/pack.pdf`);
  - **company profile** (graph node id from `GET /v1/search`);
  - packs and profile take `locale=de|en`, otherwise the workspace pack language;
  - plus pptx: `GET /v1/deals/{deal_id}/deck.pptx` and `GET /v1/nodes/{node_id}/risk-deck.pptx` ([changelog 4 Nov]);
  - answers: 200 `application/pdf` with `Content-Disposition` filename; 401 / 403 (no scope) / 404 (unreadable id) / 429 / 503 + `Retry-After`;
  - **no model call on download**;
  - audited as `report_generated` / `pack_generated` with the key; profiles and packs that print officers or owners also write `v1_person_read`.
- **Library delivery:**
  - an Entra app with Graph **`Sites.Selected`** + write on one site; the secret is sealed;
  - each library belongs to one team, and documents are rendered with that team's rights;
  - the check writes `Stonewake connection check.txt`;
  - schedule: daily or **Monday 06:00 UTC**, plus Deliver now;
  - per library per day: at most **25 documents and 100 uploads**; libraries are delivered sequentially; a delivery is capped at **10 minutes**;
  - retries at **+30 minutes then +4 hours**, never after the next scheduled run; **3 consecutive failures** stop it until an admin rechecks;
  - audit rows `library_document_delivered` (size + SHA-256), `library_document_failed` and `library_delivery_failed`;
  - a sensitivity label blocks replacement;
  - Disconnect asks for confirmation and revokes the secret.

---

## 4. Data handling, coverage, citations

### 4.1 Hosting and processors ([data-handling], [api-security], `site/privacy.md`) [other]
- **Hosting:** a dedicated server in **Finland** (DB, API, audit trail, MCP, dashboard, docs and website). A **US CDN** serves the dashboard, docs and site pages. The **auth provider keeps accounts in the UK** but is "established in a country" **without an EU adequacy decision** (SCCs Art. 46(2)(c)).
- **LLM routing:**
  - **Standard route:** the LLM stores prompts in the US and may process them in the US, Europe, Asia or Australia. Embeddings are processed in the US. Fallback 1 is in a non-adequacy country. Fallback 2 is in another one, **except calls about a natural person, which never go to the second fallback**.
  - **EU route** (by contract): every LLM call stays in the EU, and **a call that cannot be served there fails** rather than going to another provider.
- **Audit records of models:**
  - the audit trail records the provider and model that **answered** each LLM call (`model` column; several joined with `+`; `meta.served_models`, `served_providers`, `planned_models`; `unknown` if not known);
  - the AI controls page shows 30-day counts ([changelog 19 Oct]). [F2, F1]
- **No training on customer data.** Audit rights: DPA clause 10; DORA clause 12.1.
- **Retention:**
  - while the arrangement is active; **30-day wind-down** export (ToS 12.3);
  - **no single whole-workspace export**;
  - deletion per DPA clause 9, confirmed in text form;
  - **audit-trail entries survive** (identifiers only, except feedback reports, whose text and email are removed after **180 days**);
  - screenings: the bank's agreed horizon, or until erased; **every screening or dossier on a person is erasable on demand**.
- **Privacy retention table** (`site/privacy.md` §9):
  - server logs 30 days (failed requests 90 days);
  - **backups at most 7 days**;
  - insolvency publications naming a person at most **180 days**;
  - social posts **1 year + 30 days** (YouTube 30 days);
  - monthly feedback 12 months;
  - capital-market notices up to **1825 days** (`site/public-records-notice.md`).
- **Exports for offboarding:** PDF reports (deals, counterparties, companies, countries, screenings, dossiers), committee packs, Excel (Deal Book, countries, research runs), the audit log CSV, and `/v1` records.

### 4.2 Persons and sole traders ([data-handling], [ai-act]) [F2, F3, F5, F6]
- **Scores apply only to organisations and countries.**
- **Sole-trader detection:** a German natural-person legal form, `e.K.`/`e.U.` in the firm name, or a sole-proprietor form or category in GLEIF. On conflict, the German register extract decides; without it, any source that says "natural person" decides, and the disagreement is recorded. A sole trader gets **no score, status, status change, risk alert, news tone or social sentiment**, but its register facts, insolvency notices and news are read like a company's.
- **Person data switch:** officers, shareholders, beneficial owners and listed persons, with citations, on the dashboard, API and MCP. **None in the sandbox or on public pages.**
- **Objections:** a person who objects is no longer shown on any surface (but `site/public-records-notice.md` says register publicity "generally prevails" for current facts; see section 8). A person who leaves a sanctions list is **deleted in the same update**, together with its earlier versions, name keys and decisions.
- **Person purposes:** `cdd` or `edd` only. `other` → 422 for persons ([changelog 1 Nov]). Employment, recruitment or tenant → 422, and a stored row with one gets `purpose_held` and never runs ([changelog 4 Nov]).
- **Person-off workspace:** "Person screening is not available in this workspace." ([changelog 17 Oct]).
- **Erasure** ([changelog 18 Oct]):
  - erasing a person dossier erases its screening, and vice versa;
  - it also erases debt-register lookups;
  - while a run may still write: "This dossier cannot be erased yet. Try again in a few minutes.";
  - a company dossier: "Only a dossier on a person can be erased.";
  - German UI → German messages.

### 4.3 Citations [F1-F4]
- Findings cite the public origin **down to the quoted passage**. `snippet` is the passage that backs the claim, the same on `/v1` and in the dashboard ([changelog 31 Oct]).
- A relationship that cannot cite its record "never renders" (`site/home.md`). If something "cannot be dated, it reads as stale".
- Where a page blocks crawlers, the source is a labelled provider snippet (`site/about.md`) or "an index extract" (`site/home.md`).
- `POST /v1/citations/resolve` resolves citations, including sanctions entries' `published_fields` (`path`, verbatim `value`).
- **German insolvency citations link only the portal start page** (operator rule) with the court, case number and day. FIRDS citations carry `locator`, ISIN, register and an absolute `deep_link`. `register` is required on citations in OpenAPI.
- Links that differ only in letter case count as **one source** ([changelog 29 Oct]).

### 4.4 Coverage numbers ([coverage] 2143-2226, as read 21 Sep 2026 unless dated)
- **Countries [F4]:**
  - `GET /v1/countries`: **245 jurisdictions in 9 regions**. `site/countries.md` lists exactly 245 across Europe, Turkey, CIS & Central Asia, GCC, Middle East, North Africa, Sub-Saharan Africa, Asia-Pacific and Americas.
  - **215 carry a composite score** "from 31 October 2026".
  - A country is scored only if the components with data carry **≥ half the weight**. **A missing component never counts as safe.** Unscored countries read **"Not scored"** with `risk_reason` `below_coverage_floor`.
  - `GET /v1/countries/{iso3}` gives the components with weight, raw value and dataset-edition citation.
  - **Points formula:** a row's points = risk (0-100) × weight ÷ (weight of the rows with data in its `part`) × (weight of the part) ÷ (weight of the parts with data). The parts are **country assessments** and **list standing**. **List standing = 30 of 100 points** for every country ([changelog 31 Oct]).
  - `contribution` = `normalized` × `weight` ÷ (weight of the rows with data), **rounded half up to 1 decimal** ([changelog 30 Oct]). This is a great API arithmetic check.
  - `risk.gaps[]` has `reason` and `sentences`; `sources` lists the datasets feeding the country, with licence and attribution; `on_record: false` marks an indicator with no value.
- **Reference datasets** (`GET /v1/reference/datasets`, **12** as of 31 Oct 2026) [F4]:
  - `ti_cpi` (TI, annual), `wb_wgi` (World Bank, annual), `oecd_cre` (OECD, on change);
  - `fatf_call_for_action` and `fatf_increased_monitoring` (each plenary);
  - `eu_aml_high_risk` (EC, on change);
  - `country_sanctions` (OFAC/EU/UNSC curated, weekly);
  - `eba_transparency` (annual);
  - `fdic_call_report` (quarterly, added 12 Oct);
  - `uk_pillar3` (semiannual, added 15 Oct);
  - `us_eia860m` (monthly);
  - `uk_repd` (DESNZ, quarterly).
  - Row fields: `dataset_id`, publisher, licence, attribution, refresh rhythm, `active_edition`, last verified, **`state`** (`update_being_checked` | `newer_edition_expected` | `verified` | `not_verified`), and **`stale: true`** when overdue, which is **not hidden**.
- **Bank borrowers** [F3, F5]:
  - Scored on CET1, NPL/noncurrent loans and leverage, from the first official source:
    - EBA (EU/EEA, by LEI);
    - FDIC (US, by LEI or RSSD; **US bank holding companies such as JPMorgan Chase & Co. are not in it**);
    - UK Pillar 3 KM1/CR1 for 6 groups (HSBC Holdings, Barclays, NatWest Group, Standard Chartered, Santander UK Group Holdings, Nationwide) and 6 operating banks (Santander UK plc, HSBC UK Bank plc, HSBC Bank plc, Barclays Bank UK PLC, Barclays Bank PLC, National Westminster Bank).
  - **Gaps:** Lloyds Banking Group, Lloyds Bank plc and Standard Chartered Bank each say why. NatWest Bank has no liquidity row. Barclays Bank PLC's leverage is sub-consolidated.
  - A UK figure is scored until **9 months after its reference date** or until the edition is older than its cadence allows. Figures are shown **as printed** (14.1% stays 14.1%); the NPL ratio is computed to 2 decimals.
  - A US "noncurrent loan ratio" (90+ days past due + nonaccrual) is **never called NPL**.
  - **Liquidity is a gap for everyone except the UK KM1 banks.** A bank with no source reads as a gap, never as healthy.
- **Research sources** [F5]:
  - `GET /v1/monitoring/catalog`: an export-finance desk has **15 entries, all ECAs, checked daily**; `added` marks those added.
  - `GET /v1/monitoring/targets`: `active`, `scheduled_cadence_seconds`, `next_run_at`/`last_run_at`, `last_error`.
  - `GET /v1/monitoring/sources`: every source with `active` and `cadence_seconds`; switched-off sources stay listed.
  - Not added = catalogued, not researched.
- **News, screening, social** [F2, F5]:
  - news comes from **GDELT every 15 minutes**, in English plus machine translation from about **65 languages**;
  - adverse-media screening searches the web **in English**; person screening in **English + German**;
  - **social media is not read today** (`source.enabled: false`).
- **Registers** [F3]:
  - Most of the register catalog is **not live**. **There is no live German commercial-register lookup over the API.**
  - Handelsregister is queried only on a person's lookup or open, or on a change signal for a held company (4 signals: a GLEIF fact change for watched companies; a record leaving the GLEIF copy; a court strike-off or merger announcement; new documents or another notice). Signals older than 30 days and LEI renewals do not count. **No timetable re-checks** (the portal's terms forbid them). The portal limit is **60 requests per hour**.
  - `Registerbekanntmachungen`:
    - `Löschungsankündigung` → `status_changed` "strike off announced by the register court" + **red**;
    - §395 → "the register court announced the deletion of an entry", **not red** if the text is read on day one;
    - UmwG → "merger, division or change of legal form announced";
    - other notices → `new_filing`;
    - at most 3 texts opened per day.
  - **German insolvency** (insolvenzbekanntmachungen.de):
    - single lookups only, for companies a workspace asked about: an active exposure, opened in the dashboard within the last week, or in a screening or dossier within 180 days;
    - `insolvency_lookup` states: `pending` → `current`, `not_requested`, `not_looked_up` (off);
    - no nationwide coverage; proceedings before 26 June 2018 are visible only for 2 weeks after publication.
  - **EU ETS** is catalogued, not live. **SOGC (Swiss)** is not an official publication.
  - `GET /v1/nodes/{node_id}/financing` states its coverage per source.
  - Register watch `GET /v1/watches` runs weekly or daily; `register_unscheduled` is set for German companies.
- **Public funding** [F3]:
  - `GET /v1/nodes/{node_id}/public-funding` and MCP `company_public_funding`; State aid from TAM (**Germany only**; PL/RO/ES/SI are not in TAM and not read). It **lists no State aid until switched on**.
  - Matching uses VAT, register number + court, or LEI; a name alone never matches. Persons and sole traders are not served.
  - Amounts are granted, not paid; tax aid is kept as a range.
- **Sanctions** [F2, F5]:
  - **6 lists:** EU FSF, UK, OFAC SDN + non-SDN (since 30 Sep), SECO (since 5 Oct), UN (since 13 Oct); read once a day.
  - A designation binds only through an identifier the list states (LEI, **first 8 characters of a BIC**, register number + country; the AI Act page adds a BE/CZ/LV/NO VAT that is the register number).
  - **A name alone is "for review", never a match.** A list that is off or was **not checked within 48 hours** reads **"Not checked", never clear**.
  - **No PEP list.** The org check runs only once the team adds the sanctions list check to its config (**off by default**).

### 4.5 AI involvement ([ai-act] 2230-2259) [F1, F2]
- Stonewake is the provider of a **non-high-risk** AI system. The bank is the deployer. Annex III 5(b) does not apply. A deployer that repurposes the system takes on provider obligations (Art. 25).
- **Deal summary:** `summary_lines`, 3 lines **generated by fixed rules, not a model**, each with `citations` (field, finding, verbatim quote). This replaced `memo` and `memo_generated_at` ([changelog Sept]).
- **Deal briefing:** model-drafted, `drafted_by: "model"`, plus `sources`, `drafted_at` and `text`. A sentence is dropped if:
  - a digit number is missing from the sources;
  - a company, agency, place, nationality or month is missing (only when **every source is in English**);
  - an ECA is given the wrong nationality.

  Agency aliases are OK (Allianz Trade = Euler Hermes). **Relations between facts are not checked.** Reports and packs print the briefing as the executive summary, or say "none".
- **Screening `rationale`** is described in OpenAPI as machine drafted.
- **News alert check:** a model (**Claude Haiku 5.5**) answers yes, no or unsure with quotes. A deterministic gate keeps "yes" only if the quotes appear **verbatim in ≥ 2 publishers' articles** and the type matches the theme mapping. If the check cannot run, **no alert** is sent. The model can hold an alert back but cannot raise one. The result is in the event's `check` field ([changelog 13 Oct]). [F5]

---

## 5. Accessibility ([a11y] 2295-2317) [F1-F5 UI]

**Target: WCAG 2.1 level AA.** The statement is dated 2 Sep 2026 and was updated 12 Oct 2026. It covers the dashboard and the documentation.

**Claims to verify:**
- Contrast: **body and secondary text ≥ 5.6:1 on every surface**; **status colours ≥ 4.6:1 on their washes** (Red, Amber and Green badges on tinted backgrounds). Measure with a contrast tool on deal scores, screening category colours, portfolio statuses and country risk.
- **Native buttons and links only**, with no click handlers on plain containers. Use axe or a DOM scan for `div[onclick]`, `role` misuse, and keyboard reachability of every row, filter and tab.
- **A focus ring is always visible**, in the accent colour, on the element or on the card hosting it. Tab through the Deal Book, filters, the screening result, the Network view and the Countries list.
- **Escape closes** the entity digest, the full-screen network view and the first-run tour. Test that focus returns to the trigger.
- ARIA roles and labels on navigation, dialogs, status messages and **icon-only controls**.
- **Polite live regions announce export and report outcomes.** Trigger an Excel or PDF export and check the announcement with a screen reader or the accessibility tree.
- Decorative icons are hidden from assistive technology.
- `lang` is declared (EN and DE on the docs). **PDFs declare `de-DE` or `en-GB` and a title** such as `Unternehmensprofil · BayWa Aktiengesellschaft` ([changelog 31 Oct]). Check the PDF metadata. A German deck declares German text.
- `prefers-reduced-motion` is respected by transitions.

**Known gaps** (the vendor admits these failures; good to log as confirmed findings):
- no external audit; **no automated a11y check in the release gate**;
- **many form fields are labelled only by their placeholder** or the surrounding text (WCAG 1.3.1, 3.3.2, 4.1.2);
- **the network graph is a canvas with no text alternative** (1.1.1); the data is in the entity profile cards [F3];
- **no skip-to-content link** (2.4.1).

**Other a11y-related items:**
- The ToS explicitly allows screen readers (4(j)).
- The API keys card "fits a phone" ([changelog 4 Nov]): check reflow at 320 px (1.4.10).
- Deal Book cells must not widen their column, and the Value cell shows a hover reason. **A hover-only reason is a 1.4.13 / keyboard issue** ([changelog 4 Nov]). [F1]
- Feedback goes to `contact@stonewake.ai` with subject "Accessibility", or through Report an issue.

---

## 6. Changelog: recent behaviour changes (bug-prone) ([changelog] 2321-2478)

Entries are newest first. Watch for **churn** (the same thing changed several times in a few days). The dates line up with the competition: today is 4 Nov 2026, and **13 entries landed on 4 Nov**.

### 6.1 November 2026
- **HIGH [F4][F6] 4 Nov:** the country page and Country Brief (EN/DE) **no longer print the "computed without" line**, and the Brief summary no longer reads one. `gaps` on `GET /v1/countries/{iso3}` and MCP `country_profile` still carry `reason` and `sentences`. A blank OECD category reads the table's own note on the OECD tile.
- **[F5] 4 Nov:** members can opt into **alert emails** themselves in Settings (lowest severity; the address from their sign-in; every alert class the team holds). Switching off stops every alert mail. Emails have an HTML part and plain text, a footer explaining how to switch off, and the same monthly limits. The delivery log names channels in words.
- **HIGH [F4][F6] 4 Nov:** MCP `country_profile` **without `iso3`** returns the index of all countries in whole rows within the **50,000-byte output cap**, with rows carrying `risk_reason`. `output_cap` names the countries served and `next_offset`; there is a new `offset` argument. Test paging completeness: there should be 245 countries.
- **HIGH [F1][F3] 4 Nov:** EDD Dossiers, Signals and Reports appear in the sidebar; "Start EDD dossier" is on a company page. **Download deck** (fixed rules, no model) appears on the deal, counterparty and held-company pages. New endpoints `GET /v1/deals/{deal_id}/deck.pptx` and `GET /v1/nodes/{node_id}/risk-deck.pptx` require the reports scope and are audited.
- **HIGH [F4] 4 Nov:** the Countries page names its sources. An unscored country reads **"Not scored"** with a reason (`risk_reason` `below_coverage_floor`). `on_record: false` marks an indicator with no value. The workbook says "No value on record" or "Not scored" instead of a blank cell. The **Global Freedom Score** covers 197 countries, including Turkey, the UK and Germany.
- **HIGH [F5] 4 Nov:** **a credit review record exists from the day a company joins the book**:
  - the adder owns the first review, due **1 year later**;
  - "Added to the book" appears on the page;
  - `added` appears in `GET /v1/portfolio/{exposure_id}/reviews` and MCP `exposure_review_history`;
  - the reviews-due list still counts it as **never reviewed**;
  - "No score yet" with no accounts → `no_status_reason: no_accounts` on `GET /v1/nodes/{node_id}/risk` and MCP `entity_risk_profile`.
- **HIGH [F1][F5] 4 Nov:** a new **Following tab** in the Deal Book lists followed deals plus companies, brands, persons and topics, with the newest update and tone. "Follow a name" adds one. **Monitoring became a settings page** (pause/resume). Old **Sentiment tab URLs redirect to Following**: test the redirects. The API is unchanged (`GET /v1/deals` followed deals plus `GET /v1/monitoring/targets`).
- **[other] 4 Nov:** SCIM at `/scim/v2`; deactivation kills sessions, keys and assistants; optional TOTP second factor.
- **HIGH [F6] 4 Nov:** the **audit log export** (dashboard, `GET /v1/audit-log.csv`, MCP `audit_log_export`) window grows from **366 to 3653 days**, with a new **`team` column after `actor`**. Rules:
  - values are identifiers only;
  - an email appears only on rows for invited, removed or first-SSO members;
  - `actor=stonewake_operator`;
  - timestamps end in `Z`;
  - a screening started by a dossier logs `screening_requested`, `origin` dossier, `dossier_id`.
- **HIGH [F6] 4 Nov:** `GET /v1/me` → `key` {`id`, `name`, `role`, `scopes`, `expires_at`}; `key` is null for a person. Admin Members page; the API keys card shows role, scopes and expiry and fits a phone. **AI controls, SharePoint libraries and connected assistants are on for every workspace.** A user with a given password must set their own.
- **HIGH [F1] 4 Nov:** deal evidence:
  - the briefing keeps only sentences whose names appear in the (English) sources, and never gives an ECA the wrong nationality;
  - an update reads **Verified** only if its quotes state every figure and month; otherwise **Reported**;
  - a Verified stored value (e.g. "exceeding EUR 1bn") reads confirmed;
  - an update about another transaction no longer joins the deal;
  - a page is a source only if it names the project or a party;
  - **sources from disinformation-network outlets** carry `reliability` and `reliability_label`, show a warning, and never count toward confirmation.
- **HIGH [F4] 4 Nov:** **the coverage % is removed**: `risk_coverage` leaves `GET /v1/countries` and `coverage` leaves `risk`, replaced by `gaps`. The workbook drops its coverage column and the deal deck drops its coverage row. An OECD country with no category shows the table note verbatim. **Kosovo CPI (TI code KSV) now reaches Kosovo (XKX).** These fields were added on 31 Oct and removed on 4 Nov, so check for leftover fields and stale clients.
- **HIGH [F1] 4 Nov:** **Deal Book order** (dashboard, `GET /v1/deals`, MCP `deal_book`, workbook, country pages): **financing window first**, in the order Financing open → Early stage → Not confirmed, for every team and under All teams. Inside a window, real estate closest to sale or refinance comes first, then the highest score.
  - **This is a fix for a 3 Nov regression** in which the real-estate rung came before the window and unconfirmed real-estate deals sat above every other desk's open financings.
  - The Value cell shows one dollar figure or is empty with a reason on hover. Source wording stays under Key facts. **No cell widens its column.**
- **HIGH [F1] 4 Nov:** UK/US energy deals carry `project_records` (UK REPD or EIA 860M: status, planned month vs first reported, edition, link). Hermes Category A and supported-project pages are new sources.
- **HIGH [F1] 4 Nov:** the **Institution involved** filter lists ECA-named deals plus every registry institution with deal counts, **multi-select**, mapped to a repeated `eca` param. A converted dollar figure names its rate, the rate's day and the source ("Rate and source"). Another desk's stage reads with its label.
- **HIGH [F1] 4 Nov:** **a party appears once**:
  - `parties[].roles` and `also_named`; `unnamed_roles` lists `exporter` when no exporter or EPC is named;
  - roles `offtaker` and `processing_partner` are never buyers;
  - a bare EXIM resolves by context (US EXIM);
  - the `eca` filter is multi-agency, matches any role, and **an agency's count on Institutions must equal what its filter finds** (a good consistency test);
  - "Hermes cover" also finds "Euler Hermes"; KfW IPEX is its own entry;
  - a deal's countries come only from its own lines.
- **HIGH [F1] 4 Nov:** **a bound or range Value is never a point figure**:
  - `contract_value_usd` is empty; `contract_value_bound`, `contract_value_usd_min` and `contract_value_usd_max` are set;
  - sort, `min_value_usd`, the value floor and the totals use the bound;
  - rounding goes to the last place the source states (**GBP 82m → 109000000**), with `contract_value_conversion.rounded_to`;
  - `527 633,67 EUR` now converts; `contract_value_usd_unread` explains a missing figure;
  - the workbook has a `locale` param.
- **HIGH [F3] 4 Nov:** **Companies House officers appear on the first visit** (with a "being read" state; "lists none" plus the check day). `GET /v1/nodes/{node_id}/company` → `officers`. The ownership chain (`GET /v1/nodes/{node_id}/ownership-chain`, MCP `ownership_chain`) lists `register_owners`: every PSC including ceased ones with dates, and **non-UK orgs by name, where the chain ends** (not on a "no PSC" statement). For a company with no filed accounts, `GET /v1/nodes/{node_id}/financials/coverage` states the made-up-to date, type, next due, overdue and read time. The dossier country matrix counts every reader, and the Financing pillar is shown.
- **HIGH [F2] 4 Nov:** **a legacy screening** (from before list results were stored):
  - `official_lists.basis = not_stored`, `as_of` = the screening's own time;
  - lists switched on later read "**Not checked at the time**", else "**No result on record from the time**";
  - the read-time comparison is a separate `recheck` block (an annex in the report);
  - the report prints each category verdict with its decision state, date and decider;
  - **every `/v1` timestamp is in UTC with `Z`**;
  - `verdicts_awaiting_decision`; drafts are marked; old rows with no purpose read "Not recorded";
  - **employment, recruitment or tenant purposes → 422**, and `purpose_held`;
  - a German page downloads a German report with the machine-drafted text in English, labelled as such.
- **HIGH [F1] 4 Nov:** the deal report and pack print the briefing as the executive summary (or "none"). The ECA cover framework prints **Hermes rows only if the deal names Hermes**. The German pack uses DIN 5008 amounts (`82 Mio. GBP`); others stay as the source wrote them (`S$391.9m`).
- **[other] 4 Nov:** the trust pages were updated (backups, DPA, providers, governing law, exports).
- **HIGH [F2] 4 Nov:** person screenings, dossiers, targets and watches now use **every search provider**.
- **HIGH [F1] 3 Nov:** the Deal Book reads the deal's own words to fill gaps:
  - "financing closed" or "cover provided" → **Financing set**, held back unless a quote holds it open;
  - a date in the summary ages the deal ("No movement since 2010");
  - **`score_band` is never "Strong fit" outside the mandate**;
  - a PF desk holds back works lots ("Works contract, no financing need");
  - the real-estate-first order (reverted on 4 Nov);
  - **dashboard cursors minted before the change → 400**; `/v1` and MCP use `limit`/`offset`.
- **HIGH [F2] 3 Nov:** the screening look-back window now applies to the **matter date**, not the page date:
  - each finding has `window`, `matter_year` and `marks`;
  - a matter older than `window_years` decides no verdict; a stored verdict resting only on such matters is withheld with a dated note;
  - a finding is cited under **every category it names** (Bribery is no longer "Nothing found" beside a bribery order under Litigation);
  - a category holding only old matters reads **green** with an explanatory sentence;
  - an org's green citing an in-window adjudicated outcome of the subject or a named subsidiary → **amber**, naming the subsidiary;
  - **a red whose every finding is undated is capped at amber**;
  - a finding with no year is marked, not withheld; "conviction + acquittal" in one passage says so; near-duplicate findings fold;
  - a public function is marked with a sentence to assess PEP status under the bank's own procedure;
  - **a dossier reuses a complete screening of the same company, purpose and window from the last 24 hours** and says so.
- **HIGH [F1] 2 Nov:** `contract_value_usd` converts nearly every currency:
  - SDR and AfDB UA at the IMF SDR value of 29 Oct (`currency` `XDR`);
  - official parities (pataca);
  - US Treasury rates of 30 Sep (TWD, UZS);
  - currency names and signs: FCFA/CFAF, TL, KSh, USh, TSh, Kz, QR, kwanzas, naira, quetzales, Sri Lankan rupees, New Taiwan dollars;
  - **ambiguous "shillings" or "dinars" with no country → no conversion**.
- **[F3][F5] 2 Nov:** the accounts-overdue signal no longer names a date that has already passed as the next due date. Example text: "latest annual accounts to 2024-12-31; legal date 2026-04-30 passed, computed under section 325 (4) HGB; no newer accounts on record yet, filing indexes can lag".
- **HIGH [F6] 2 Nov:**
  - the errors page lists `validation_failed`, `internal_error` and `service_unavailable`;
  - `GET /v1/search` / `search_companies` `limit` counts **companies**, so persons after them no longer set `truncated`;
  - the `eca` filter finds the source spelling, **unlike `q`**;
  - `GET /portfolio/book-events` uses the list envelope with an exact `total`;
  - the API reference files refuse unknown or repeated params with 422.
- **HIGH [F1] 1 Nov:** merged deals carry the follow, dismissal and next step (follow > dismissal > untriaged; a dismissal as duplicate or historical carries nothing). No `reopen_suggested` event on merged or pool-dismissed deals.
- **HIGH [F3] 1 Nov:** financing and financials changes:
  - `debt_position` = short-term + long-term debt, and coverage names the missing one;
  - matured FIRDS instruments are counted in `terminated_excluded` and served with `include_matured=true` with `terminated_on`; an instrument under two issuers is closed for neither;
  - `total_equity` and `non_controlling_interests`; **total assets = total liabilities + total equity** (an arithmetic check); `note`; `derived: true` for German/Swiss computed liabilities;
  - equity ratio, negative equity and **Altman Z''** use total equity;
  - portfolio top signals lead with red-cap signals; windows are spelled out ("in the last 36 months"); the sector context names the Kreis.
- **HIGH [F4] 1 Nov:** FATF per 30 Oct: **Bulgaria, Côte d'Ivoire, DRC and Monaco left increased monitoring**; the call for action is still DPRK, Iran and Myanmar. The country page and Brief list only components with data, and the coverage line names the missing ones (that line was removed again on 4 Nov). The OECD checks no longer read high-income OECD, euro-area or euro micro-states as **green** (not applicable).
- **HIGH [F3][F5] 1 Nov:** filing-deadline rules for the accounts-overdue signal:
  - SEC: 60, 75 or 90 days by filer category; 4 months for a foreign private issuer; next business day if the deadline falls on a weekend or holiday; overdue only after the **15-day** NT grace.
  - UK: 9 months after the ARD for private companies and LLPs, 6 months for public companies; no date if the ARD changed after the held record.
  - ESEF / German listed parents: due 4 months after year end (TD Art 4(1), §325(4) HGB, DTR 4.1.3R), but **overdue only 1 year + 30 days** after the next FY end.
  - The SEC filer category is shown in plain words.
  - Companies House periods that are not 12 months (e.g. 18 months) are not read as annual turnover, profit or employees.
  - `stale_line` when a figure is more than 18 months older than the position's newest.
- **HIGH [F2] 1 Nov:** person purposes are `cdd`/`edd` only; `other` → 422 whatever `purpose_note` says. Earlier person records with `other` stop.
- **HIGH [F5] 1 Nov:** status naming: **"No score yet" = `insufficient`** (formerly "Insufficient data" in packs and decks), and **"Not yet assessed" = `not_assessed`**. The Portfolio page distinguishes them under its tiles.
- **HIGH [F3][F6] 1 Nov:** `GET /v1/nodes/{node_id}/company` and MCP `company_overview` with `locale=de` return the German risk block: `label`, `value_display`, `note` and `coverage_line` (e.g. "EBIT zu Zinsaufwand"). **Codes stay unchanged.**
- **HIGH [F1][F5] 1 Nov:** `tracking_scheduled_seconds` on a deal (null if following adds no check). A schedule of **≥ 30 days** reads "Checked once in this workspace" with no next check.
- **HIGH [F3][F5] 1 Nov:** **one company = one record**:
  - SEC filers are joined to LEI/register records via ISIN → CUSIP → ticker (SEC fails-to-deliver files) → CIK, with name agreement;
  - **adding a company under its other record → 409** naming the held company; the import row reads `in_book` or `duplicate`;
  - a joined second entry leaves the book: "Same company as another entry";
  - `merged_into` on nodes and events; `other_node_id` on financials coverage;
  - book import accepts every identifier type (e.g. `ra_ra000406`, ISIN); a failed checksum → `invalid`.

### 6.2 October 2026 (selected; all touch the flows)
- **HIGH [F1] 31 Oct:** a pool dismissal earns one reopen suggestion. `from_pool` and `dismissed_in_pool`. "Update research" runs once with no schedule change.
- **HIGH [F2] 31 Oct:** **a natural person is never rated**:
  - a person screening holds lists plus findings only ("Findings only");
  - category review and summary regeneration for a person → **422**;
  - old verdicts are served nowhere;
  - the `subject` filter ignores accents, case and spacing.
- **HIGH [F4] 31 Oct:** the country score uses the **OECD category table valid 16 Oct 2026** (previously news-based agency ratings). Missing components pass their weight to others within the part; list standing is 30/100. `part` is added per row. The **British Virgin Islands are unscored** (list standing only). Scores mostly moved **up a few points**.
- **HIGH [F6][F1][F3] 31 Oct:** strict validation everywhere:
  - unknown params are refused on dashboard routes too; a duplicated single param → 422;
  - `country_code` (deals) and `iso3` (screenings) must be alpha-3 **plus `XKX`**, upper case, so `ZZZ`, `CL` and `deu` → 422;
  - `edge_types` (`/network`), `connector_id` (`/records`) and `group` (`/events`) must exist, and an empty value → 422;
  - an empty or malformed `team` → 422;
  - **`GET /v1/entities/{node_id}/risk` is retired → 404 for every id** (use `/v1/nodes/{node_id}/risk`);
  - the tender mapping 422 is at `mapping`;
  - MCP refuses the same values before sending, and its schemas list the enums.
- **HIGH [F6] 31 Oct:** **one list envelope** everywhere: `items`, `limit`, `offset`, `total`. Dashboard lists no longer stop at 100 or 500 rows. `next_cursor` is null only on the last page. Deprecated fields: `pct` → `pct_value`, the `entity_class` object → `entity_class_detail`, `value_numeric` → `value_number`. A sole-trader row has no `entity_class`. `GET /v1/search` sets `truncated` when it fills `limit`.
- **HIGH [F3] 31 Oct:** register vocabulary:
  - `company_status` is a closed code list (`active`, `active_proposal_to_strike_off`, `in_liquidation`, `unknown`, ...) with `company_status_label` and the untruncated `company_status_source`; it was previously cut at 24 characters, e.g. `Live but Receiver Manage`;
  - `label` is never a GLEIF previous name (`MIZRAHI TEFAHOT BANK LTD`);
  - ELF `63KS` = Unternehmergesellschaft (haftungsbeschränkt);
  - **beneficial owners are `beneficial_owner_of`, never `shareholder_of`**; edges carry `role_code`, `role_label` and `role`;
  - overseas entities carry their home `country_iso3`.
- **HIGH [F1] 31 Oct:** value rules:
  - ranges and multiple amounts get no dollar figure;
  - **ECB rates of 29 Oct** (GBP about 1.33, previously 1.10); AUD/CAD/SGD/HKD are no longer read as USD;
  - unknown `stage`/`sector`/`status`/`window`/`region` → 422 (previously an empty book); `team` param;
  - **every `/v1` timestamp is UTC `Z`** (some previously carried the Berlin offset);
  - `briefing` no longer turns null with a small `timeline_limit`;
  - a 422 reaches MCP as `invalid_request`.
- **HIGH [F1] 31 Oct:** a numeric date (`20/02/2019`) dates a deal; an ambiguous one (`05/03/2019`) dates nothing; **deals with no activity for more than 12 months are held back**; real-estate teams hold back non-property deals (`score_reasons`).
- **HIGH [F1] 31 Oct:** `q` = **every word anywhere on the row** (all words), and a quoted phrase is matched exactly. `AU$259 million` with `US$168 million` beside it keys 168 million. One country name; no language tags in party names; a page date of `06/04/2025` that the page writes as 4 June reads as 4 June.
- **HIGH [F3][F6] 31 Oct:** search finds FIRDS ISINs (e.g. Tel Aviv), register numbers with punctuation (`52-001807-8`), and `Amtsgericht München, HRB 177273`. `&`=`und`=`and`=`+`. The group's parent is listed before its subsidiary. Non-Latin script gives exact matches or no hits. `limit` counts companies. On deals, `q` matches whole words only and fills `q_matched`.
- **HIGH [F1] 31 Oct:** `contract_value_usd` is given to the cent; `contract_value_conversion`; `value_note`; multi-country phrases split into `countries` 1:1 with `countries_iso3`; EXIM linking; AfDB is no longer linked to ADB; `GET /v1/deals/parties/binding-queue` → `pool_unbound`/`pool_note`.
- **HIGH [F1][F3] 31 Oct:** a German pack (`locale=de`) is German throughout, including the file name. **Every PDF declares its language and title**. `earlier_line` reads "1 earlier period, 31 Dec 2023" (fixes the plural and range bug).
- **[F5] 30 Oct:** `scheduled_cadence_seconds` = `next_run_at` − `last_run_at`, which may differ from `cadence_seconds`.
- **HIGH [F4][F1] 30 Oct:** a country's deals are only the **default-visible** rows. `deals_held_back`; `deal_count` on `GET /v1/countries` and `GET /v1/geography/summary` excludes held-back deals. Country detail `sources`; dataset `state`. The previous OECD category is shown only if it differs. Delisting `citation_note` example: `No longer listed from 2026-09-18, recorded in edition 2026-10`. The **contribution arithmetic** rule (see 4.4); all scores were recomputed once.
- **[F3][F6] 29 Oct:** `connected_sources` lists every register whole, GLEIF included. Tender `deadline_passed`; an amount **≤ 1,000** is treated as not stated. **The guides no longer claim that an id from the other id space answers `not_found`, "because both are whole numbers and such an id can name another record"**: entity ids and node ids are both integers and can collide. **Mixing id spaces is an excellent bug hunt.** [F3]
- **[F3][F5] 29 Oct:** `gap_words` / `coverage_line` read "the register's notices and filings are not yet read in full". Exporter or EPC matching.
- **HIGH [F1] 29 Oct:** a letter of interest keeps the day it was first reported; a wiki entry dates nothing; `outside_markets_held`; case-only link differences count as one source; corroboration test text "Cited by 3 pages, not corroborated by a primary source or two trade press titles"; "no buyer confirmed"; ECAs are never exporters; "Chinese banks" is never a party.
- **HIGH [F6] 26 Oct:** custom workspace ceilings; per-IP ceilings for unauthenticated traffic; `-32029`.
- **HIGH [F6] 25 Oct:** the `Bearer` scheme is case-insensitive and whitespace-trimmed on `/v1`, where `/v1` previously returned 401 while MCP accepted the same header.
- **HIGH [F6] 25 Oct:** person ceilings of 2,190 reads / 60 writes; the person `rate_limited` message is the same as a key's.
- **HIGH [F6] 25 Oct:** **MCP revision `2026-07-28`**:
  - `server/discover`; `resultType`; `_meta` server identity; cache hints `ttlMs` and `cacheScope`;
  - new error codes and HTTP mapping (see 2.2); earlier revisions keep their sessions;
  - tool args are checked against declared bounds in every mode;
  - `deal_book` `region` and `timeline_limit`; `portfolio_overview` paging;
  - `alert_deliveries.event_id` and `tender_matches.match_id` up to 2^63−1;
  - **output cap 50,000 bytes** (first rows whole, valid JSON, `output_cap` with offset; `company_network` keeps the centre plus the first neighbours and `truncated: true`; `country_profile` keeps the first deals plus `deals_total`).
- **HIGH [F6] 24 Oct:**
  - the OpenAPI document declares every refusal;
  - NUL → 422;
  - `q`/`eca` are literal (`%`, `_`);
  - `GET /v1/runs` ties are ordered by `run_id`, so **pages never overlap** (a paging test);
  - a person 429 on downloads carries Retry-After;
  - PDF 503 → `server_busy`;
  - `alerts/deliveries` is filtered.
- **HIGH [F1] 21 Oct:** the window "Financing closed" is renamed **"Financing set"** (`score_window_label`), but **the `score_window` value and the `window` filter stay `financing_closed`**. `state_label` distinguishes "Signed or closed" from "Cover agreed".
- **HIGH [F1] 20 Oct:** demotions are short phrases in `score_reasons` ("Country not stated", "Own bank lends", "No movement since 1 Apr 2025"), never "demoted". `lowered` bool; `score_hidden`.
- **[other] 20 Oct:** set-password link rules (see 3.2).
- **HIGH [F2][F6] 19 Oct:** the audit `model` column names the model that answered.
- **HIGH [F2] 18 Oct:** person dossier and screening erasure rules (see 4.2).
- **HIGH [F1] 18 Oct:** **automatic deduplication**: the Possible duplicates card is gone. `GET /v1/deals/merge/suggestions` is **deprecated and returns an empty page for everyone**. **MCP `deal_duplicates` is retired → unknown-tool error.** The 17 Oct entries describing the card are superseded.
- **[F5] 17 Oct:** a person target blocked by the monthly screening allowance waits until month end. `next_run_at` = the first moment of next month (UTC); `last_error` `screening_allowance_reached`.
- **[other] 17 Oct:** Tenders page; tender → Deal Book in one step.
- **HIGH [F2] 17 Oct:** the person switch applies everywhere; refusal text "Person screening is not available in this workspace."; `sole_trader` on social endpoints.
- **[other] 16 Oct:** tender matches from uploads (`portal_notice`, `decided_by`). **Groundwork, not live:** own sources (e-Vergabe, Vergabe.NRW, vergabe.bayern; North Data via `GET /v1/licensed-data/facts` and MCP `licensed_facts`).
- **[F3][F5] 16 / 15 / 13 Oct:** UK Pillar 3 and FDIC bank ratios (see 4.4).
- **[F5] 15 Oct:** persons can be followed like companies (`node_type` `person` on `GET /v1/news/companies`, `/social/companies`, MCP `company_news`/`company_social`); the person access record.
- **[F6] 15 Oct:** audit CSV columns: `ts, action, actor, target_type, target_id, run_id, model, meta` (plus `team` after `actor` since 4 Nov).
- **[other] 14 Oct:** SSO-only mode with no break-glass account. **Groundwork:** NewsAPI.ai as a second source (`second_source_articles`).
- **[F5] 13 Oct:** **news alerts** for serious events (insolvency, fraud, cyberattack or breach, lawsuit, layoffs, industrial accident, strike) from GDELT themes plus the model check. One story in any language is one event. Alerts arrive **within minutes**; **phone only for critical events**. `events` and `check` on `GET /v1/news/companies/{node_id}` and MCP `company_news`. **Groundwork:** social monitoring (`source.enabled: false`).
- **[F2][F5] 13 Oct:** UN list switched on (6 lists).
- **HIGH [F6] 12 Oct:** id bounds (see 1.4).
- **HIGH [F2] 10 Oct:** **org screening colour check**:
  - a model check runs on each drafted category colour; on disagreement a second model is asked; the **majority of 3 wins, and three different answers → amber**;
  - an incomplete check never lowers the colour;
  - **Sanctions exposure is red** if a list names the org by an identifier its own register entry carries, **and also red if the lists could not be read**;
  - `rationale` is the reason if it passes the fixed checks, otherwise a fixed sentence;
  - `coverage_note` covers uncategorised findings.
- **HIGH [F1][F2] 10 Oct:** the "confirm/verify/check/review" sanitiser (see 2.1). `action` on events names the bank's own next step. Binding queue `GET /v1/deals/parties/binding-queue` (matching stays in the dashboard).
- **HIGH [F3][F5] 8 Oct:** insolvency lookups for every company a person asks about (`not_requested` replaces `not_in_portfolio`). **A company opened in the Network view or screened with no current assessment is assessed on the spot** (`risk_state`, `risk_reason`; `exposure_id` null on `GET /v1/risk-assessments/{id}`). **API/MCP never start an assessment.**
- **HIGH [F3][F6] 5 Oct:** person data unified:
  - persons appear in search after companies;
  - `GET /v1/nodes/{node_id}/network` and MCP `company_network` (officers, shareholders, BOs, every edge cited; `limit` caps the neighbours);
  - natural-person owners in the ownership chain;
  - `node_type` on every node.
- **[F2] 5 Oct:** SECO list (also vessels); "Not checked" until its first read.
- **HIGH [F1] 4 Oct:**
  - the first summary line explains a missing Value; the buyer reads "reported and not confirmed";
  - bracketed names such as `Fribourg Transport Authority (TPF)` are confirmed only when quoted verbatim;
  - MW/MWh mismatch rule (1GW/4GWh vs 100MW/400MWh);
  - **value floor**: hold back below `value_floor_usd`, defaulting to 1/10 of the ticket minimum: **USD 5m for EF, USD 10m for PF**. Deals with no Value are not held back. `£100,000` gets a sort key.
- **[F2] 4 Oct:** sanctions org, vessel and aircraft entries carry all fields (`published_fields` path/value); fields that can name a person are replaced by `published_note` on the API.
- **[F3][F6] 1 Oct:** search ranks short names and acronyms first (VW, Haspa); a 2-letter query is answered only on an exact short name. `insolvency_lookup` introduced.

### 6.3 September 2026
- **[F3][F5] 30 Sep:** whole-edition registers stay "drained" when no new edition appears. `source_dark` after the refresh interval plus a **6-hour grace**; an SEC EDGAR edition **more than 5 days old** counts as nothing.
- **HIGH [F2] 30 Sep:**
  - **Conflicting evidence:** if two category verdicts disagree on charged, penalised or convicted, both are withheld and one `rationale` starts "Conflicting evidence";
  - a sentence resting only on pre-window findings is withheld, with a dated sentence;
  - a dismissed verdict is excluded.
- **[F1] 30 Sep:** `briefing` introduced (groundwork; null until switched on; initially only digits were checked).
- **HIGH [F2] 30 Sep:** **`official_lists` first** in the screening result:
  - deterministic, computed **at read time**;
  - states: `listed`, `name_match_awaiting_review`, `name_match_reviewed`, `no_entry_found` (with edition and time), `not_checked` (with reason);
  - exact normalised name key ("other spellings, **word orders** and transliterations are not found"; this conflicts with the AI Act page, see 8);
  - the report is titled "Due diligence screening" once a list has been compared;
  - an Excel "Official lists" sheet sits before "Screenings";
  - **no DOB or nationality anywhere**.
- **[F2][F5] 30 Sep:** the 4 lists switched on; `GET /v1/sanctions/person-candidates` and MCP `sanctions_person_candidates` (`lists`, `lists_not_checked`, `persons_compared`); the review queue opens from the portfolio page.
- **[F2] 30 Sep:** the report cover counts findings with verbatim quotes (primary source, or trade press on 2 domains; search excerpts are not counted). The identity chip shows unconfirmed matches and **no longer prints "Identity confirmed"**. Coverage notes have no counts.
- **HIGH [F1] 30 Sep:**
  - **`sort`**: `score|value|last_activity|stage|name|first_seen|latest_update` + **`direction` `asc|desc`**; rows with no value come **last in both directions**; the default is `priority`; unknown values → 422;
  - `latest_update` and `has_unseen_update`;
  - Value fields: `value_status` (`confirmed`/`reported`), `value_text` (source currency), `value_note`, `value_finding_id` and `value_basis` (never the largest figure, project cost or programme size);
  - `last_event_at` rules; `event_date` is never in the future; **the stale window dropped from 18 to 12 months**.
- **HIGH [F2] 26 Sep:**
  - `rationale` cites `[f<id>]` tokens of its own `finding_ids`; **a finding capped as unverified has no entry in `findings`**, which can look like a dangling citation;
  - `rationale_withheld`;
  - `coverage_line` "a completed screening awaits analyst confirmation"; `gap_reason` `screening_stale`.
- **[F1] 26 Sep:** `event_date` parses "Aug. 6, 2026" and "June 28th, 2021"; a maturity or deadline is never an event date; `buyer` = the first buyer party; `contract_value_raw` is null when it holds no amount.
- **[F3][F5] Sept (undated):**
  - EBA bank ratios;
  - `paid_register_excluded` (US charges and insolvency petitions; PACER) is terminal and counts in `explained_share`, not `seen_share`; the note names the statute (e.g. § 12 GBO);
  - `POST /v1/portfolio/import` preview (MCP `portfolio_import_preview`, 17th tool);
  - Companies House charges green-row rules; `attrs.history_backfill`;
  - **`memo` was removed in favour of `summary_lines`**;
  - credit-monitoring gaps (`state`, `gap_reason`, `grade`, `seen_share`, `explained_share`, `reachable_share`, `coverage_line`); "Insufficient" decided on `reachable_share`; an amber floor on grade A/B holds;
  - node streaming with a 60-second cut-off;
  - `/records` paging;
  - offsets above the max → 422;
  - MCP `company_records` (16th tool, ≤ 25 per page).
- **[F5] 22 Sep:** status changes name their cause; the **first assessment is an addition, not a change**; `status_changes_30d` vs `transitions_30d`; the credit review record; `reviews_overdue`; `GET /v1/portfolio/{exposure_id}/reviews`.

### 6.4 August 2026 (foundations)
- 27 Aug: OpenAPI servers and licence.
- 25 Aug: German site under `/de`.
- 23 Aug: RateLimit headers; docs as markdown (`.md` or `Accept: text/markdown`); sitemap and robots.
- 21 Aug: sign-in fails closed with no role or team.
- 15 Aug: admins manage keys.
- 14 Aug: MCP with 15 tools; explorer at `api.stonewake.ai/docs`.
- 13 Aug: `/v1` opens; MCP at `mcp.stonewake.ai`.

---

## 7. From the public site (`site/`)

### 7.1 Product areas and claims to check
Source: `site/home.md` (identical to `#agents`, `#demo`, `#network` and `#portfolio`), plus `de.md`, `about.md`, `press.md` and `docs.md`.
- **Surfaces:**
  - dashboard: `app.stonewake.ai` (login at `/login`);
  - API: `api.stonewake.ai/v1`, base URL `https://api.stonewake.ai`, plain JSON over HTTPS;
  - MCP: `https://mcp.stonewake.ai/`;
  - docs: `docs.stonewake.ai`, with German under `/de`, `llms.txt` and `llms-full.txt`, and every page as `.md`.
  - The public site is also served as markdown, and `stonewake.ai/llms.txt` says "when to use Stonewake and how to call it".
- **Deal Book [F1]:**
  - pipeline Watch → Extract (in "the page's own words, never a paraphrase") → Verify ("The quote must still stand in the source's published text, or it is labelled an index extract") → Score (**"Six weighted components, tuned to your mandate"**, a 0-100 relevance score per `site/methodology.md`) → Deliver ("ranked Deal Book, a cited summary per deal, **Excel in one click**").
  - Test: every quote is labelled verified or "index extract"; the score breakdown has 6 components; the Excel export works.
- **Credit monitoring [F5]:** "Every exposure is scored against published rules; no model decides it." "Every move shows the record behind it." "**365×** your portfolio re-checked 365 times a year" (daily); `about.md`: "Stonewake rechecks the book every day". Statuses: Red, Amber, Green, plus No score yet and Not yet assessed.
- **Network [F3]:** "A relationship that cannot cite its record never renders." "If we cannot date it, it reads as stale."
- **Country risk [F4]:** "An explainable composite from **seven components**, each cited. Missing data reads as missing, never as safe." **245 jurisdictions**, "every value cited". (The docs describe more datasets plus two parts; see 8.)
- **Adverse media [F2]:** "**Nine categories over five years. Red, Amber or Green.** It does not replace sanctions or PEP screening." "Drafts · an analyst confirms · 2 more categories." Test: 9 categories present, a default 5-year window, R/A/G, and analyst confirm/dismiss.
- **Coverage view [F5]:** "A vetted source catalog... the rest stay listed as catalogued. **The whole book exports as one workbook.**"
- **Agents [F6]:** "Connect Claude, Cursor or your own agents through a hosted MCP server and a read-only API." "**No endpoint an agent can call changes anything inside your workspace.**" "**A failed usage meter refuses the request.**"
- **Procurement claims:**
  - "Data, the API and the MCP server run on a dedicated server in the EU";
  - "Every screening and credit review decision is recorded as made and **never edited**" (test: audit is append-only; a credit review history is "append only" per [changelog 22 Sep]);
  - "Fixed rules set statuses that your team acknowledges."
- **About and press:**
  - "50+ hours saved every week" is an **estimate** (100 counterparties × 30 minutes weekly);
  - in pilot with "a leading German bank";
  - operated from Kleinmachnow near Berlin; sold directly with no signup and no public price;
  - desks: export finance, project finance, commercial real estate;
  - `docs.md` calls the API "credit monitoring, entity risk, and counterparty and country intelligence for export finance teams".
- **Monitoring briefs** (`monitoring.md`, `monitoring_about.md`, `monitoring_feed.xml.md`) [other/F5]:
  - the public feed currently has **1 brief**: "SACE backs $200 million buyer credit for VinFast Vietnam" (EF · VNM · 21 Sep 2026);
  - Atom feed at `/monitoring/feed.xml`;
  - claims: briefs are published only after automated verification ("no path to publication around the verifier"), restated in their own words (no source wording reproduced); each shows published and updated dates and the **number of sourced facts**; licence attribution lines are reproduced verbatim; briefs are **withdrawn and their URLs stop resolving** when a source's retention ends.
- **Countries pages** (`countries.md`, `countries_germany.md`) [F4]:
  - **245 entries**, ISO3 + name + flags (sanctions programmes, FATF increased monitoring (18 listed), FATF call for action (IRN, PRK, MMR), EU AML list) and register-event counts. Examples: GBR 378,557; USA 189,833; DEU 6,714; EST 4,001; CYM 2,678; CAN 2,134; LVA 2,000. **VGB: FATF + EU AML, 404 events (unscored per the changelog).**
  - Sources: Commission Delegated Regulation (EU) 2016/1675; FATF lists; OFAC/EU/UN (curated).
  - **Germany page:**
    - OECD "Not reviewed or classified." (2026);
    - CPI rank 10, CPI 77 (2025);
    - WGI 2025: control of corruption 81.90, government effectiveness 82.80, political stability 69.30, regulatory quality 76.40, rule of law 85.10, voice and accountability 86;
    - ECA: Hermes cover (Euler Hermes AG);
    - "**No openly licensed company register for Germany is under Stonewake monitoring**" (see 8);
    - ~30 further sources (thru.de PRTR, Marktstammdatenregister, Bundesbank, EBA PSD2, ESMA, Insolvenzbekanntmachungen, many ALKIS/flood/land-value WFS, BaFin RSS, EU ETS, Destatis, Regionalatlas, BA statistics, VGR, Zensus 2022), each with an attribution line;
    - "Germany holds no active listing";
    - no composite score is shown on the public page.
  - Test: the public page values match `GET /v1/countries/DEU`, and the attribution lines are intact (the CPI must be **unmodified**, CC BY-ND).
- **Institutions** (`institutions.md`) [F3]: 27 public profiles: AfDB, ADB, Atradius DSB, Berne Union, Bpifrance, CESCE, Sinosure, EBRD, EIB, EDC, KEXIM, US EXIM, EKN, EGAP, Finnvera, Hermes AGA, IDB, IFC, JBIC, K-SURE, MIGA, NEXI, OECD Export Credits Secretariat, Paris Club, SACE, UKEF, World Bank. The changelog says AfDB is its own registry institution (an old ADB link was repaired); test that this is the case.
- **Other content hubs** [other]:
  - `calculators.md`: 8 items (debt yield, DSCR, DSRA, interest coverage, LLCR, LTC, LTV, OECD CRC explainer);
  - `compare.md`: 12 items (vs AlphaSense, Bloomberg, Factiva, IJGlobal, Proximo, Sayari, TXF, ...);
  - `faq.md`: 3;
  - `guides.md`: 4;
  - `hubs.md`: 8;
  - `indexes.md`: 4;
  - `methodology.md`: 5 (adverse media; citations, "stable public URLs and verbatim quotes"; country composite "0-100 scores"; data residency; Deal Book scoring "0-100 relevance score from **six weighted, tenant-tuned components**");
  - `research.md`: 5;
  - `solutions.md`: 5;
  - `trust.md`: 5 policies, including a corrections policy;
  - `blog.md`: **205 articles** (11 Aug to 11 Sep 2026; `blog_feed.xml.md` has the same 205 with desk categories EF 130, PF 81, CRE 42 and nothing new);
  - `contact.md`: corrections go to contact@ with the URL and the supporting source;
  - `imprint.md`: v1.1, effective 27 Oct 2026; **sole proprietorship of Luca Diaz Hilterscheid**, Märkische Heide 5, 14532 Kleinmachnow; DDG §5; MStV §18(2).
- **Legal pages** [other]:
  - `terms.md` v1.4 (27 Oct 2026); `privacy.md` v1.23 (4 Nov 2026); `public-records-notice.md` v1.10 (4 Nov 2026).
  - The privacy policy says the **website has no analytics or tracking** and stores nothing on the device, except CDN challenge cookies during an attack. The **dashboard stores the session plus a few preferences** (e.g. tour completed). Test for third-party trackers on the site and dashboard.
  - The **demo form keeps per-IP counts in memory** (abuse protection), so the form has a rate limit.
  - Privacy names social platforms (X, LinkedIn, TikTok, Instagram, YouTube, Reddit, Threads) and a US social data provider, while the docs say social media is not read today.
  - The supervisory authority is LDA Brandenburg.
- **Public records notice:** sources include Äriregister (EE), BORME (ES), Bundesnetzagentur EEG awards and Kraftwerksliste, Companies House, TAM/Kohesio/FTS, GLEIF, Handelsregister, Insolvenzbekanntmachungen, DAX/MDAX/SDAX IR notices, the Latvian UR, ONRC (RO), the Register of Overseas Entities (2025 Open Ownership snapshot), RPVS (SK, including a "public official" flag), Skatteetaten (NO), SOGC and thru.de. Disambiguation data kept: partial DOB for UK PSCs, birth year plus postcode for NO, DOB and hashed code for EE, partial DOB plus masked code for LV, full DOB and address for SK.

### 7.2 Glossary (`site/glossary.md`: "107 terms"; 107 entries confirmed)
One line each, condensed from the site definitions. Tag [F1] for deal and ECA terms, [F2] for screening, [F3] for ownership, [F4] for country.
- **Advance payment guarantee:** secures repayment of a contract mobilisation advance (usually a reducing demand guarantee). [F1]
- **Adverse media screening:** review of public news and open sources for financial crime or serious misconduct linked to a customer or owner. [F2]
- **Banker's acceptance:** a time draft accepted by a bank; an unconditional promise to pay at maturity.
- **Basel III:** the Basel Committee's post-crisis capital, leverage and liquidity standards. [F3 bank ratios]
- **Beneficial ownership:** the natural persons who ultimately own or control a legal person. [F3]
- **Berne Union:** the international association of export credit and investment insurers. [F1]
- **Bid bond:** tender security compensating the employer if a winning bidder fails to honour its bid.
- **Bookrunner:** the syndication role controlling primary distribution and final syndicate composition.
- **Borrowing base:** a collateral-derived ceiling on revolving advances.
- **Buyer credit:** bank or official financing to an overseas buyer so the exporter is paid upfront. [F1]
- **Buyer credit guarantee:** ECA cover of a bank loan to an overseas buyer. [F1]
- **Cap rate:** stabilised NOI ÷ property value or price.
- **Cash sweep:** surplus project cash applied to mandatory prepayment.
- **Cash waterfall:** the contractual order in which project revenues are applied.
- **CIRR:** the OECD Arrangement minimum fixed rate for officially supported export credits, per currency. Set monthly, effective on the 15th; base rate (government bond yield) + margin; maturity = drawdown + ½ repayment + ½ frequency, floored at 3 years and capped at 10 (`glossary_cirr.md`). [F1]
- **COD (commercial operation date):** construction complete and ready for commercial operation.
- **Commercial risk:** non-payment through buyer insolvency or protracted default.
- **Common terms agreement:** shared reps, undertakings and defaults across PF facilities.
- **Completion guarantee:** sponsor support backing project completion through construction.
- **Comprehensive cover:** ECA protection against both commercial and political risk.
- **Confirmed letter of credit:** an LC with a second bank's irrevocable undertaking added.
- **Construction loan:** credit to build or rehabilitate structures.
- **Country risk:** the risk that a sovereign or host environment prevents external debt repayment. [F4]
- **Covenant breach:** failure to meet a loan undertaking; often an event of default.
- **Cross default:** a default on other debt is a default under this facility.
- **Currency inconvertibility:** inability to convert or transfer hard currency due to government action. [F4]
- **Customer due diligence:** the AML process of identifying and verifying customers and BOs. [F2]
- **Debenture:** an instrument creating security over company assets (fixed and floating charges). [F3]
- **DSCR:** cash flow available for debt service ÷ scheduled principal + interest. World Bank form: (net income after tax + depreciation + interest) ÷ total debt service (`glossary_dscr.md`).
- **DSRA:** a reserve account sized to cover a period of debt service.
- **Debt yield:** NOI ÷ loan amount, in %.
- **Demand guarantee:** an independent undertaking to pay on a complying demand (URDG 758).
- **Direct agreement:** a tripartite contract giving lenders notice, cure and step-in rights.
- **Documentary collection:** bank handling of documents for payment or acceptance (URC 522).
- **EBRD:** European Bank for Reconstruction and Development. [F3 institutions]
- **ECA premium:** the ECA's fee for cover, floored by OECD minimum premium rates. [F1]
- **EIB:** the EU's lending arm. [F3]
- **EPC contract:** a turnkey engineering, procurement and construction agreement. [F1 parties]
- **Equator Principles:** a voluntary E&S risk framework for project finance.
- **EXIM (US):** the official US ECA. [F1]
- **Export credit agency (ECA):** a public body supporting national exports with insurance, guarantees or financing. [F1]
- **Export credit guarantee:** official ECA cover against non-payment.
- **Export credit insurance:** official or private cover indemnifying against non-payment.
- **Expropriation risk:** loss from host-government deprivation of ownership or control. [F4]
- **Facility agent:** the administrative bank between borrower and syndicate.
- **Factoring:** assignment of receivables to a factor.
- **FATF:** the Financial Action Task Force, the AML/CFT standard setter. [F4 lists]
- **Financial close:** the point when documents are signed, CPs are met and funding is available. [F1 "Financing set"]
- **Fixed and floating charge:** security over specific assets plus a fluctuating class. [F3 charges]
- **Force majeure:** an extraordinary impediment preventing performance.
- **Forfaiting:** without-recourse discounting of an exporter's receivables.
- **Hermes cover (Hermesdeckung):** German federal export credit guarantees. [F1: "Hermes cover" label; Euler Hermes alias]
- **IFC:** the World Bank Group private-sector financier. [F3]
- **Independent engineer:** the lenders' technical adviser.
- **Intercreditor agreement:** ranking, waterfall and enforcement among creditors.
- **Interest coverage ratio:** income ÷ interest cost. [F5 signal "interest cover"]
- **Interest make up:** official rate support letting banks offer fixed CIRR loans.
- **ISP98:** ICC International Standby Practices (Publication 590).
- **KYB:** CDD applied to legal-person customers. [F2]
- **KYC:** identifying and verifying customers and BOs. [F2]
- **LEI:** a 20-character ISO 17442 code for legal entities (GLEIF). Level 1 is "who is who"; Level 2 is "who owns whom" (`blog_what-the-lei-is-in-credit-risk.md`). [F3: book import validates LEI check digits]
- **Letter of credit:** an irrevocable bank undertaking against complying documents.
- **Limited recourse:** defined sponsor support; repayment mainly from project cash flows.
- **LLCR:** NPV of CFADS over the remaining loan life ÷ outstanding debt.
- **LTC:** loan ÷ total property cost.
- **LTV:** loan ÷ market value.
- **Lockbox account:** a lender-controlled rent collection account.
- **Mandated lead arranger:** the bank structuring and syndicating the loan. [F1 parties]
- **Material adverse change:** a significant deterioration treated as a default or drawstop.
- **MIGA:** the World Bank Group insurer of non-commercial risks. **MIGA cover:** its PRI and credit enhancement.
- **National content requirements:** the minimum home-country content an ECA requires.
- **Negative pledge:** a ban on granting security to other creditors.
- **NOI:** gross property income − operating expenses.
- **Non-recourse:** no sponsor guarantee; repayment from project or property cash flows only.
- **OECD Arrangement:** disciplines on officially supported export credits of 2 years or more. [F1]
- **OECD CRC:** categories 0-7 setting minimum premiums. [F4: OECD row of the country score; high-income countries "no category"]
- **Offtake agreement / Offtaker:** a buyer committed to purchase output. [F1: role `offtaker`, never a buyer]
- **Pari passu:** ranking equally.
- **Paris Club:** the informal group of official bilateral creditors. [F3 institutions]
- **Performance bond:** contract performance security (often URDG 758).
- **Political risk insurance (PRI):** cover for non-commercial risks.
- **Project finance:** limited-recourse lending repaid from project cash flows. [F1 PF desk]
- **PLCR:** NPV of CFADS over the remaining project life ÷ debt.
- **PSC register:** UK people with significant control. [F3: `register_owners`, ownership chain]
- **Restructuring vs rescheduling (Paris Club):** reduction vs changed payment terms.
- **Retention bond:** a guarantee replacing cash retention.
- **Risk participation:** an unfunded transfer of credit risk.
- **Sanctions screening:** checking parties against official lists. [F2 `official_lists`]
- **Security package / security agent:** collateral and support securing lender claims.
- **Security trustee:** holds and enforces shared security.
- **SPV:** a ring-fenced project company.
- **Sponsor:** the equity party behind a project or CRE borrower.
- **Standby letter of credit:** an independent undertaking payable on default.
- **Step-in rights:** lenders' right to perform under key contracts to cure a default.
- **Sub participation:** the economics of a loan transferred while the grantor stays lender of record.
- **Supplier credit:** deferred payment terms from exporter to buyer.
- **Syndication:** arranging a loan among multiple lenders.
- **Tied vs untied financing:** official support conditioned on home-country procurement, or not.
- **Transfer risk:** capital or exchange controls block remittance. [F4]
- **UCP 600:** ICC rules for documentary credits.
- **UKEF:** the UK ECA. [F1]
- **UBO:** the natural person who ultimately owns or controls an entity (only natural persons). EU threshold: 25% + 1 share or more than 25%. UK PSC bands: >25-50%, >50-<75%, ≥75%; changes notified within 14 days (`glossary_ubo*.md`). [F3]
- **Untied loan guarantee:** ECA cover for a loan not tied to procurement.
- **URDG 758:** ICC Uniform Rules for Demand Guarantees.

### 7.3 Claims from the site that a test could check
- [F4] **245** jurisdictions in the API vs 245 on `site/countries.md`; **9 regions**; "every value cited" (no indicator without a citation); "missing never as safe" (unscored countries show "Not scored", never green).
- [F4] FATF flags on the public page agree with the API after the 1 Nov FATF update: **BGR, MCO and COD carry no "FATF increased monitoring" flag** (consistent today); **Côte d'Ivoire appears as "Ivory Coast"** (name mismatch vs docs).
- [F4] Kosovo `XKX` is accepted by filters and has a CPI ([changelog 4 Nov]).
- [F1] "Every quote checked or labelled", "Excel in one click", "six weighted components", "a cited summary per deal" (`summary_lines` has 3 lines, each with a citation).
- [F2] "Nine categories over five years", R/A/G, analyst confirms.
- [F3] "A relationship that cannot cite its record never renders": every edge in `/network` carries a citation.
- [F5] Daily re-check ("365×"). This conflicts with "We never re-check a portfolio on a timetable" for the German register ([coverage]).
- [F6] Read-only for agents; "failed usage meter refuses" (`quota_unavailable`).
- [other] security.txt expiry 2027-08-11 and policy URL; the `/de` versions of pages exist; every docs page answers `.md`.

---

## 8. Confusing or contradictory points (log these as bugs, or ask about them)

1. **Empty page vs 404 for an id filter that names nothing** [F6]. [errors] says "never an empty page"; [changelog 12 Oct] says "an empty page for a list filter" when an out-of-range id is used. 31 Oct fixed only specific filters (`profile_id`, tender deal id). Test every id filter with 0, -1, 2147483648 and a valid-but-foreign id.
2. **400 and 409 are undocumented statuses** [F1, F5]. Neither is in the [errors] table (400 for an old cursor on 3 Nov; 409 for a duplicate company on 1 Nov). Is the envelope present, and what is the code?
3. **API keys on member removal** [F6, other]. [sso] Existing logins says "API keys belong to your workspace and not to a login, so they keep working". [sso] and [changelog 4 Nov] say removal revokes "the API keys the member created". Test whether a key survives a carry-over (it should) and whether it dies on removal (it should).
4. **The ToS forbids automated UI access and "probe or scan"** (`site/terms.md` 4(g), 4(j)), while the security disclosure gives a safe harbour for good-faith research. The organisers must clarify what is allowed.
5. **"Data residency EU"** (`site/home.md`, `about.md`, `press.md`) vs: US CDN; the UK auth store held by a provider **established in a non-adequacy country**; the LLM storing prompts in the US; fallbacks in non-adequacy countries; search providers "without such a safeguard" (`site/privacy.md` §8). Also, `privacy.md` §6 says the LLM provider is "established in Ireland". [other]
6. **Social media** [F5]. [coverage] and [changelog 13 Oct] say "Social media is not read today. No social source is switched on". But `privacy.md` §4/§7/§9, `public-records-notice.md` (platforms named; "It also reads the public social media posts") and [ai-act] ("follows a natural person ... in news and social media") describe it as active. The Following tab shows "tone where public posts are read". Expect `source.enabled: false`.
7. **Sanctions name matching and word order** [F2]. [changelog 30 Sep] says an exact normalised key where "other spellings, **word orders** ... are not found". [ai-act] says a screened person is compared by "exact name in **any word order**". Test "Ivan Petrov" vs "Petrov Ivan".
8. **Sanctions identifiers** [F2]. [coverage] lists LEI, BIC-8 and register number + country. [ai-act] adds Belgian, Czech, Latvian and Norwegian VAT numbers that are register numbers.
9. **Objection handling** [F3]. [data-handling]: "A person who objects is no longer shown ... on any of these surfaces". `public-records-notice.md`: for current register facts "register publicity generally prevails". These may not apply to the same cases.
10. **Country score components** [F4]. Home page: "seven components". Docs: 12 reference datasets (some feed bank ratios and sectors), "two parts" (country assessments + list standing at 30/100), plus the new Global Freedom Score (197 countries, 4 Nov). What counts as the seven?
11. **Coverage-related fields churned within 4 days** [F4, F6]. On 31 Oct `risk_coverage`, `coverage` and `part` were added along with a workbook coverage column. On 1 Nov the coverage line named the missing components. On 4 Nov `risk_coverage` and `coverage` were removed, the line was dropped from the page and Brief, and the column and deck row were dropped. Check for stale UI or clients and inconsistent German translations.
12. **Coverage page dates** [F4]. "Counts were read ... on 21 September 2026", yet "215 ... carry a composite country risk score from 31 October 2026" and datasets were "as read on 31 October 2026". The 245/215 numbers may differ live: "When the live API and this page disagree, the API is right."
13. **Deal Book order churn** [F1]. Window-first (before) → real-estate first (3 Nov) → window-first again (4 Nov). Also "Financing closed" was renamed "Financing set" for display, but the `window=financing_closed` value is unchanged. Cursors from before 3 Nov → 400.
14. **Merge or duplicates churn** [F1]. 17 Oct added the Possible duplicates card, `merge/suggestions` and `deal_duplicates`. 18 Oct removed all three: the endpoint returns an **empty page for everyone** (not 404 or 410) and the MCP tool → unknown tool. Test the deprecated endpoint's envelope and headers.
15. **German insolvency lookup scope churn** [F3, F5]. 1 Oct: anyone with interest. 4 Oct: portfolio only (`not_in_portfolio`). 8 Oct: anyone who asked (`not_requested` replaces `not_in_portfolio`). Check that no stale state values remain.
16. **Id spaces** [F3, F6]. Entity ids (`/v1/entities`) and graph node ids (`/v1/nodes`) are both integers and "such an id can name another record" ([changelog 29 Oct]). The retired `GET /v1/entities/{node_id}/risk` read the wrong id space. Feed an entity id to a node route and the reverse; data from an unrelated company must never come back under the wrong label.
17. **Roles list in the ToS** (`terms.md` 3.3: analyst, viewer, administrator) omits **compliance**, which is in [onboarding].
18. **Disclosure acknowledgement time.** [disclosure] gives no SLA; [support] says 3 business days. Also, `contact.md` sends security reports to the "contact named in security.txt" (the same address).
19. **Provider identity.** [terms-of-use] says "the provider is Stonewake, seated in Germany". `imprint.md` and `privacy.md` say it is a **sole proprietorship** of a named individual. The ToS liability cap is 12 months of fees.
20. **Backups.** "Backed up every night ... encrypted" (docs) vs "Backups: at most seven days" retention (`privacy.md` §9). This is consistent but worth knowing for restore questions.
21. **Germany register** [F3, F4]. `countries_germany.md` says "No openly licensed company register for Germany is under Stonewake monitoring". [coverage] says it queries handelsregister.de on lookups and reads Registerbekanntmachungen, and that "German companies appear in the graph where a public dataset names them". It also says there is "no live lookup against the German commercial register over the API" while the dashboard does query it. This creates an API-vs-UI parity gap for German companies (flow 6).
22. **"365× re-checked" / "rechecks the book every day"** (site) vs "We never re-check a portfolio on a timetable" (German register) and weekly register watches ([coverage]). [F5]
23. **The person-screening second fallback rule** says "a call about a natural person never goes to the second" fallback, but **the first fallback is in a non-adequacy country**. Not testable black-box; note only.
24. **Rationale citations** [F2]. `[f<id>]` tokens may cite a finding that has **no entry in `findings`** (capped as unverified). A UI that links tokens may render broken links. Decide whether this is a bug.
25. **Public brief vs deal data** [F1]. The single public brief says "$200 million buyer credit ... arranged by three international banks". Compare it with the Deal Book's Value/`value_status` for the same deal if visible (value-bound and confirmation logic).
26. **SharePoint app reads as a viewer** even for admins/compliance, while a `/v1` key "reads exactly its one team". Compliance users see all teams in the dashboard but not via the app. Expected, but confusing.
27. **The MCP tool count drifts:** 15 tools at launch, then `company_records` was the "sixteenth", `portfolio_import_preview` the "seventeenth", and many more were added later (`company_network`, `company_overview`, `company_social`, `tender_export_preview`, `licensed_facts` (groundwork), `deal_binding_queue`, `sanctions_person_candidates`, `exposure_review_history`, `audit_log_export`, `company_public_funding`, `country_profile`, `deal_book`, `entity_risk_profile`, `screening_lookup`, `company_news`, `company_events`, `company_financing`, `company_financials`, `ownership_chain`, `portfolio_overview`, `tender_matches`, `alert_deliveries`, `search_companies`, `search_stonewake_docs`), while `deal_duplicates` was retired. Verify against `tools/list`.

---

## 9. Priority tests per flow (errors, rate limits, security, performance, accessibility)

### F1: Deal Book (search and filter, open deal with summary and sources, export)
- **Errors:**
  - unknown `stage`/`sector`/`status`/`window`/`region`/`sort`/`direction` → 422 `literal_error` listing the allowed values;
  - `country_code=deu|ZZZ|CL` → 422 while `XKX` passes;
  - a duplicated `sort` → 422 `value_error`;
  - a misspelt filter → `extra_forbidden`, **never a wider list**;
  - a foreign or nonexistent `deal_id` → 404 identical to "not found";
  - `limit`/`offset` bounds (offset 2^63 → 422);
  - a stale dashboard cursor → 400 (is there an envelope?);
  - `GET /v1/deals/merge/suggestions` → empty page;
  - the deal PDF/pack/deck: 401 / 403 (no reports scope) / 404 (another team's deal) / 503 `server_busy` with Retry-After.
- **Rate limits:** a person's 60 per minute on PDF downloads (429 with `Retry-After` + `retry_after_seconds`); a streamed download cut short by a statement timeout (check file integrity and size).
- **Security:**
  - `q`/`eca` literal handling of `%`, `_`, quotes, brackets and SQL-meta characters;
  - `q` whole-word semantics; XSS payloads in `q` reflected in the UI (search box, `q_matched`);
  - sanitiser: no "please verify/confirm" clauses in `briefing`/`ask`;
  - `has_unseen_update` null for keys;
  - pool deals leak no other workspace's triage;
  - the `Content-Disposition` filename is safe (German file names, special characters).
- **Data correctness (bug-prone):**
  - window-first ordering, no real-estate-first regression;
  - "Financing set" label vs `financing_closed` value;
  - bound/range Values never point figures (`contract_value_bound`/`_min`/`_max`), GBP 82m → 109000000;
  - ECB/IMF/Treasury rates named in `contract_value_conversion`;
  - "shillings" converts to nothing;
  - stale window of 12 months; value floor USD 5m (EF) / 10m (PF);
  - a party appears once (`roles`, `also_named`), offtaker never a buyer;
  - the `eca` multi-filter count equals the Institutions count;
  - Verified vs Reported; disinformation sources (`reliability_label`) never confirm;
  - `summary_lines` = 3 lines each with a citation;
  - the pack prints the briefing or "none", Hermes rows only when Hermes is named, DIN 5008 in German;
  - `sort` with no-value rows last in both directions.
- **Performance:** `GET /v1/deals` latency with filters and sort at ≤ the `RateLimit` pace; PDF/pack/deck render time; Excel workbook export time; MCP `deal_book` near the 50 KB `output_cap`.
- **Accessibility:**
  - table keyboard navigation and focus ring;
  - the multi-select Institution filter is operable by keyboard and labelled (watch for placeholder-only labels);
  - **the hover-only Value reason** must be reachable by keyboard and screen reader;
  - the export outcome is announced by a polite live region;
  - status colour contrast ≥ 4.6:1;
  - PDF `lang` and title.

### F2: Screenings (company background check, read result with sources)
- **Errors:**
  - person purpose `other` → 422; employment/recruitment/tenant → 422; with person data off → "Person screening is not available in this workspace.";
  - review or summary regeneration on a person screening → 422;
  - unknown `iso3` on `GET /v1/screenings` → 422;
  - a foreign `screening_id` → 404;
  - dossier erase messages ("cannot be erased yet", "Only a dossier on a person can be erased.").
- **Rate limits:** a person's write ceiling (60 per minute) on screening starts; the monthly screening allowance (`screening_allowance_reached`) is a quota, not a 429.
- **Security:**
  - no person verdict, score or summary anywhere (API, MCP, PDF, Excel, audit CSV);
  - no DOB or nationality of listed persons served;
  - `published_note` replaces person-capable fields;
  - the `subject` filter ignores accents and case, with no injection;
  - the person access record has ids only;
  - sandbox → canonical 404 for persons.
- **Data correctness:**
  - `official_lists` is first with 6 lists and states `listed` / `name_match_awaiting_review` / `name_match_reviewed` / `no_entry_found` / `not_checked`;
  - a list not checked within 48 hours → "Not checked", never clear;
  - a name alone never counts as `listed`;
  - Sanctions exposure is red when the lists cannot be read;
  - look-back window by matter date (`window`, `matter_year`, `marks`);
  - a finding is cited under every category it names;
  - an all-undated red is capped at amber;
  - "Conflicting evidence" handling;
  - `[f<id>]` tokens resolve (or are explainably capped);
  - `rationale_withheld`;
  - the legacy screening `basis: not_stored` + `recheck`;
  - a dossier reuses a screening within 24 hours;
  - 9 categories × 5 years, R/A/G (site claim);
  - the report title "Due diligence screening" and the cover counts.
- **Performance:** time from screening start to complete result; read-time `official_lists` computation latency (deterministic, no model); report PDF render.
- **Accessibility:**
  - category colours conveyed by more than colour (text labels);
  - contrast;
  - focus order through findings and citations;
  - the confirm/dismiss controls are native buttons;
  - the screening form fields have programmatic labels (known gap);
  - the screening report PDF declares its language.

### F3: Network and Institutions (company profile, financing, ownership chain)
- **Errors:**
  - unknown `edge_types`, `connector_id` or `group` → 422;
  - `nace` unreadable on `/sector-context` → 422;
  - a retired `GET /v1/entities/{id}/risk` → 404;
  - **an entity id used on a node route and the reverse** (id-space collision);
  - a large company on `GET /v1/nodes/{id}` → 503 `server_busy` (Retry-After) under concurrency, 60-second stream cut-off;
  - `/records` paging (`records_total`, per-register counts).
- **Rate limits:** a person's 60 per minute on the company profile PDF; keyed reads of large nodes count normally.
- **Security:**
  - persons served only when person data is on (search `node_type` person, `/network` edges, `register_owners`);
  - canonical 404 otherwise and in the sandbox;
  - `v1_person_read` written on a profile PDF;
  - no cross-tenant leak from insolvency lookups (`insolvency_lookup` state is per workspace).
- **Data correctness:**
  - `company_status` closed codes + untruncated `company_status_source`;
  - `beneficial_owner_of` vs `shareholder_of`;
  - every edge cited, with no uncited relationship rendered;
  - Companies House officers on the first visit;
  - the ownership chain ends at a named non-UK org;
  - `merged_into` / one company one record (409 on a duplicate add);
  - financing `debt_position` (short + long), `terminated_excluded` with `include_matured=true`, `stale_line`;
  - financials: assets = liabilities + total equity; `derived: true`;
  - accounts-overdue dates (SEC 60/75/90 + 15-day grace, UK 9/6 months, ESEF 4 months / 1 year + 30 days);
  - bank borrowers' CET1/NPL/leverage and liquidity gaps;
  - `locale=de` labels while codes stay unchanged;
  - search: ISIN, punctuated register numbers, `Amtsgericht München, HRB 177273`, `&`=`und`, Hebrew exact-or-nothing, VW/Haspa first, a 2-letter query only for exact short names;
  - the AfDB vs ADB institution split.
- **Performance:** a node with a large record book (UK, US); the network view render with many neighbours (`limit` caps); the ownership chain depth; on-the-spot assessment when a company is first opened in the Network view (UI only; the API never triggers it).
- **Accessibility:**
  - **the network canvas has no text alternative** (known gap; confirm and log it);
  - check that the entity profile cards expose the same data accessibly;
  - **Escape closes the full-screen network view and the entity digest**, with focus returned;
  - no skip link (known).

### F4: Countries (risk score and indicators)
- **Errors:**
  - `GET /v1/countries/{iso3}` with `deu`, `DE`, `ZZZ` or `XKX` (valid);
  - extra params → 422;
  - the MCP `country_profile` `iso3` and `offset` bounds (`-32602`).
- **Rate limits:** the index read is cheap; MCP `country_profile` index paging via `next_offset` must cover all **245** countries without loss or duplication.
- **Security:** read-only; the datasets' attribution and licence lines are preserved (CPI CC BY-ND unmodified); no person data at all.
- **Data correctness:**
  - 245 countries / 9 regions / ~215 scored;
  - **unscored → "Not scored" + `risk_reason` `below_coverage_floor`**, never shown as safe;
  - BVI unscored;
  - **recompute `contribution` = `normalized` × `weight` ÷ Σ weight of rows with data, rounded half up to 1 decimal**;
  - list standing is 30/100;
  - `gaps` has `reason` + `sentences`;
  - `on_record: false`;
  - `risk_coverage` and `coverage` are **absent** (removed 4 Nov) and there is no "computed without" line on the page or Brief;
  - OECD table note text for unclassified countries (Germany "Not reviewed or classified.");
  - FATF list membership after 30 Oct (BGR, CIV, COD, MCO off increased monitoring; DPRK, IRN, MMR on call for action);
  - the Kosovo CPI;
  - `deal_count` excludes held-back deals + `deals_held_back`;
  - dataset `state` and `stale: true`;
  - the Global Freedom Score covers 197 countries;
  - public `site/countries` flags match the API;
  - the EN and DE Country Brief match.
- **Performance:** a countries workbook export; a Country Brief PDF render (counts toward the PDF ceiling?); the full index response time.
- **Accessibility:**
  - score and colour legend contrast;
  - the table has proper headers;
  - the "Not scored" text is visible, not just a colour;
  - the workbook has no blank cells ("No value on record");
  - the Brief PDF language tag.

### F5: Monitoring and Portfolio (add company, receive updates)
- **Errors:**
  - adding a duplicate company → **409** naming the held one (an undocumented status: check the envelope);
  - book import preview `POST /v1/portfolio/import` (body ≤ 2,000,000 bytes → 413 above; rows `in_book` / `duplicate` / `invalid` for a bad LEI checksum; `dry_run` always true);
  - `since` without an offset on `/portfolio/transitions` → 422;
  - `last_error` `screening_allowance_reached` on targets.
- **Rate limits:**
  - person writes 60 per minute when adding many companies in the UI;
  - the alert email monthly limits;
  - MCP `portfolio_overview` paging `limit` / `offset`.
- **Security:**
  - a viewer cannot add to monitoring (analyst+);
  - **the evaluation rule: no bank figures** (leave facility and amount columns empty);
  - the alert email goes only to the sign-in address; switching off stops all mail;
  - `alerts/deliveries` shows no withheld sole-trader or person alerts;
  - register re-check results are invisible to other workspaces;
  - a sole trader has no status, score or tone.
- **Data correctness:**
  - the first assessment is an **addition, not a change** (`status_changes_30d` vs `transitions_30d`);
  - the review record from day one (`added`, due in 1 year, still counted "never reviewed");
  - "No score yet" = `insufficient`, "Not yet assessed" = `not_assessed`, `no_status_reason: no_accounts`;
  - `scheduled_cadence_seconds` = `next_run_at` − `last_run_at`; `tracking_scheduled_seconds`; ≥ 30 days reads "Checked once in this workspace";
  - catalog: 15 ECA entries for EF, with `added`;
  - sources switched off stay listed;
  - the Following tab vs Monitoring settings, **with old Sentiment URLs redirecting**;
  - news alerts only after the check (≥ 2 publishers, verbatim quotes), within minutes of GDELT; **no alert if the check cannot run**; `check` field;
  - social `source.enabled: false`;
  - the person sanctions review queue opens from the portfolio page;
  - insolvency `pending` → `current` within minutes of opening.
- **Performance:**
  - time from adding a company to its first assessment and first status;
  - the alert latency claim ("within minutes" of GDELT's 15-minute file);
  - portfolio page load with a large book;
  - the import preview with a large CSV (paging `limit` / `offset`).
- **Accessibility:**
  - the alert feed and status tiles (contrast ≥ 4.6:1, text labels);
  - the import file upload control has a programmatic label;
  - the import outcome is announced (live region);
  - pause/resume toggles are native, keyboard-operable controls;
  - the first-run tour closes with Escape.

### F6: Same data via API and MCP (read-only)
- **Parity tests:**
  - for one deal, company, country and screening, compare the dashboard, `/v1` and the MCP tool (`deal_book`, `company_overview`/`entity_risk_profile`, `country_profile`, `screening_lookup`, `ownership_chain`, `company_financing`/`company_financials`, `company_events`, `audit_log_export`);
  - the same fields, the same order (window-first), the same timestamps (UTC `Z`), the same 422 reasons (MCP `invalid_request` / `-32602`);
  - known parity gaps: German register live lookup (UI only); on-the-spot assessment (UI only); `has_unseen_update` null for keys.
- **Errors:**
  - the full envelope table, fixed messages and `retry_after_seconds`;
  - the 422 detail limits (10 entries + `too_many_errors`, 32,768 bytes, `loc` 64 bytes / `msg` 2,048 bytes cut with `...`, never echoes the input);
  - id bounds (0, -1, 2147483648, 2^63);
  - offset bounds;
  - 405 on non-GET (except the 3 POST previews);
  - 413 at 1,000,001 bytes (body may be empty);
  - MCP JSON-RPC codes (`-32700`, `-32600`, `-32601` (HTTP 404 on the new revision, 200 on the old), `-32602`, `-32020`, `-32022`, `-32001`, `-32029`), `server/discover`, `resultType`, `_meta`, `ttlMs`/`cacheScope`, the 50,000-byte `output_cap` with `next_offset`.
- **Rate limits:**
  - `RateLimit-Policy` on every `/v1` response (including 401/404/429);
  - `RateLimit` / `X-RateLimit-*` on keyed responses, with `Remaining == r` and `Retry-After == t` on `rate_limited`;
  - daily quota `Retry-After` to midnight UTC;
  - `quota_unavailable` with no Retry-After;
  - MCP results carry `retry_after_seconds` in the result body, not headers;
  - MCP per-IP limit of 60 per minute for `initialize`/`tools/list`.

  Do all of this with a **low custom ceiling agreed with Stonewake**, not by flooding production.
- **Security:**
  - a key works only on `/v1` and MCP (a dashboard route refuses it like an invalid key);
  - Bearer parsing (case and whitespace accepted, anything else refused);
  - revoked or expired keys, and keys of a removed member → 401 identical body;
  - scopes (`report_downloads`, audit);
  - `GET /v1/me` key details;
  - IDOR via 404 parity;
  - no model at request time (deterministic: the same request returns the same bytes);
  - the OpenAPI `bearerAuth` matches;
  - CORS from a foreign origin is not readable;
  - assistants approved by SSO stop after 7 days + 1 hour or when SSO is off.
- **Performance:**
  - p50/p95 per endpoint at a steady pace below `r`;
  - large node streaming (60-second cut-off) vs `/records` paging;
  - MCP tool latency vs REST for the same data;
  - pages never overlap (`GET /v1/runs` ordered by `run_id`; `offset` paging stable under inserts);
  - `total` exact in the list envelope.
- **Accessibility:** n/a for API. Do check the docs explorer at `api.stonewake.ai/docs` and `docs.stonewake.ai` (WCAG 2.1 AA, EN/DE `lang`) if UI testing extends to the docs.
