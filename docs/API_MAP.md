# API map

> Owner: API agent. Source: organizer API docs (`docs/product/notes-A.md`, from llms-full.txt) + live probes with the Finalist 4 viewer key (2026-11-04 18:30-18:45, GET only).
> Base: `API_URL` = `https://api.stonewake.ai`. Auth: `Authorization: Bearer <STONEWAKE_API_KEY>` (viewer, scopes `read`,`reports`, one team). `/health` is unversioned and public.
> Limits: `x-ratelimit-limit: 600`/min per key (shared by every agent), `RateLimit-Policy` on every `/v1` response. Keep volume low; never probe the limit (ToS 4(g)).

| Endpoint | Method | Auth | Used by UI flow | Priority | Schema | Spec file | Status |
|---|---|---|---|---|---|---|---|
| `/health` | GET | none | - (ops) | P1 (T16) | `src/api/schemas/health.ts` | `tests/api/health.get.spec.ts` | covered |
| `/v1/health` | GET | none | - | P1 (T16, negative) | `ErrorEnvelope` | `tests/api/health.get.spec.ts` | covered (404 by design: docs place health at `/health`) |
| `/v1/me` | GET | bearer | all (team scope) | P1 | `src/api/schemas/me.ts` | used by `tests/api/deals.list.spec.ts`; api 2 (Stabilizer) | partial |
| `/v1/deals` | GET | bearer | F1 Deal Book list, filters, sort | P1 (T17) | `src/api/schemas/deals.ts` `DealListSchema` | `tests/api/deals.list.spec.ts` | covered |
| `/v1/deals/{deal_id}` | GET | bearer | F1 open a deal | P1 (T17) | `DealDetailSchema` | `tests/api/deals.detail.spec.ts` | covered |
| `/v1/screenings`, `/v1/screenings/{id}` | GET | bearer | F2 Screenings | P1 (T18) | `src/api/schemas/screenings.ts` | `tests/api/screenings.list.spec.ts` | covered (envelope + validation; workspace has 0 screenings) |
| `/v1/nodes/{id}/network` | GET | bearer | F3 Network | P1 (T18) | `src/api/schemas/network.ts` | `tests/api/network.get.spec.ts` | covered |
| `/v1/nodes/{id}/ownership-chain` | GET | bearer | F3 Network (ownership) | P1 (T18) | `src/api/schemas/ownership.ts` | `tests/api/ownership.get.spec.ts` | covered |
| `/v1/nodes/{id}/company` | GET | bearer | F3 Network profile | P2 | - | - | open |
| write verbs on `/v1/*` | POST/PUT/PATCH/DELETE | bearer | - (read-only API) | P1 (T19) | `ErrorEnvelope` | - | blocked: live write-verb probes need Kayla's approval |
| `/v1/countries`, `/v1/countries/{iso3}` | GET | bearer | F4 Countries | P2 | - | api 9 (Stabilizer S2) | existing |
| `/v1/portfolio`, `/summary` | GET | bearer | F5 Portfolio | P2 | `src/api/schemas/portfolio.ts` (minimal row) | api 5, 6 (Stabilizer S2); used to pick a held company | existing |
| `/v1/entities`, `/v1/entities/{id}` | GET | bearer | F3 Institutions | P2 | - | api 7, 8 (Stabilizer S2) | existing |
| `/v1/search` | GET | bearer | F3 Network lookup | P2 | - | api 10 (Stabilizer S2) | existing |
| MCP `https://mcp.stonewake.ai/` | POST (JSON-RPC) | bearer | F6 | P2 (T21) | - | - | open |

## Coverage per endpoint
| Endpoint | Happy | Auth (401/403) | Validation (422) | CRUD | 404 | Headers | p50 ms |
|---|---|---|---|---|---|---|---|
| `GET /health` | yes (strict schema) | n/a (public) | n/a | n/a (read-only) | `/v1/health` 404 envelope | content-type, no-store, nosniff, DENY, HSTS; no RateLimit-Policy | ~440 |
| `GET /v1/deals` | yes (schema, limit/offset echo, team scope, no hidden rows, sort score/first_seen asc+desc) | 401 no key | `sort=bogus`, `priority`+`asc`, `limit=101` | n/a (read-only) | - | - | ~500-700 |
| `GET /v1/deals/{id}` | yes (schema, equals list row) | 401 no key | - | n/a | unknown id -> canonical 404 | - | ~550 |
| `GET /v1/deals` filters (T20) | XKX, q=128 accepted | 403 for well-formed foreign `team` | `country_code` DE/deu, `min_value_usd` inf/1e400, `stage`, `team=""`, `q` 129 chars, `offset=-1` | n/a | - | RateLimit-Policy, RateLimit, x-ratelimit-* (keyed); RateLimit-Policy (keyless 401) | ~450 |
| `GET /v1/screenings` | yes (envelope, iso3=DEU) | 401 no key | `iso3=deu`, `subject_type=bogus`, id `abc` | n/a | unknown id -> 404 | - | ~450 |
| `GET /v1/nodes/{id}/network` | yes (centre, no dangling edges, every edge cited, current before closed, edge_types filter) | 401 no key | `edge_types=bogus`, `limit=201` | n/a | unknown node -> 404 | - | ~500 |
| `GET /v1/nodes/{id}/ownership-chain` | yes (root, default params 25/8, echo 50/1) | - | `threshold=0`, `threshold=100.5`, `max_depth=9` | n/a | unknown node -> 404 | - | ~500 |

Notes
- Validation errors are 422 (not 400) with `{error:{code:"validation_failed",message}, detail:[{type,loc,msg}]}`; `loc` names the parameter.
- 401 body is uniform: `{"error":{"code":"unauthenticated","message":"Missing or invalid credentials."}}`.
- 403 "wrong role" is not testable with one viewer key except through write verbs (T19) and scope-gated routes (`/v1/audit-log.csv` needs `audit`; our key lacks it).
- Open question for the judges: docs say a malformed `team` gives 422, but `team=abc` gives 403 `forbidden` (only `team=` empty gives 422). Team-id format is not documented, so not filed as a bug; the spec pins only the well-formed foreign-team 403.
- Network `limit` caps neighbour nodes, not edges (limit=20 -> 21 nodes incl. centre, 22 edges). Docs do not say which; not filed as a bug.
- T18 UI-vs-API parity (same owners/officers on the Network page) is offered to Coverage: pick the node via `heldCompanyNodeId()` (`src/api/live-picks.ts`).
- Response time is logged per call as the `api-timing` annotation (warning only).
