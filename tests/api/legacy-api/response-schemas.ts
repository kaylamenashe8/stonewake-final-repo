import { z } from 'zod';

/**
 * zod contracts for the responses the legacy API tests (api 1-10) read.
 * Shapes mirror src/api/schemas on agent/api (not on master yet); they live here, in this lane's
 * owned path, so the two branches do not collide. Move the imports to src/api/schemas once it merges.
 */

/** Portfolio row statuses documented for `GET /v1/portfolio`, sorted (api 6 compares sorted keys). */
export const PORTFOLIO_STATUSES = [
  'amber',
  'green',
  'insufficient',
  'not_assessed',
  'red',
  'sole_trader',
] as const;

/** `GET /health`: exactly these four keys (strict), values asserted in api 1. */
export const HealthSchema = z.strictObject({
  status: z.string(),
  app: z.string(),
  version: z.string(),
  environment: z.string(),
});

/** Every non-validation error: `{error:{code,message}}` (401 unauthenticated, 404 not_found). */
export const ErrorEnvelopeSchema = z.strictObject({
  error: z.strictObject({ code: z.string().min(1), message: z.string().min(1) }),
});

/** FastAPI-style 422 body: the envelope plus a `detail` list naming the offending parameter. */
export const ValidationErrorSchema = z.strictObject({
  error: z.strictObject({ code: z.string().min(1), message: z.string().min(1) }),
  detail: z
    .array(z.object({ type: z.string(), loc: z.array(z.union([z.string(), z.number()])), msg: z.string() }))
    .min(1),
});

/** A key scoped to some teams must list at least one; an all-teams key may list none. */
export const TeamScopeSchema = z
  .object({
    all_teams: z.boolean(),
    teams: z.array(z.object({ id: z.string(), name: z.string() })),
  })
  .refine((scope) => scope.all_teams || scope.teams.length > 0, {
    message: 'a team-scoped key must list at least one team',
  });

/** `GET /v1/me` for an API key. */
export const MeSchema = z.object({
  credential: z.string(),
  role: z.string().regex(/^[a-z_]+$/),
  team_scope: TeamScopeSchema,
});

/** List routes answer `{items, limit, offset, total}`. */
const listEnvelope = <T extends z.ZodType>(item: T) =>
  z.object({
    items: z.array(item),
    limit: z.number().int(),
    offset: z.number().int(),
    total: z.number().int(),
  });

export const PortfolioRowSchema = z.object({
  id: z.number(),
  label: z.string(),
  active: z.boolean(),
  status: z.enum(PORTFOLIO_STATUSES),
  completeness: z.number().min(0).max(1),
});
export const PortfolioListSchema = listEnvelope(PortfolioRowSchema);

/** `GET /v1/portfolio/summary`: a count per status plus the totals. */
export const PortfolioSummarySchema = z.object({
  statuses: z.record(z.string(), z.number().int()),
  active_exposures: z.number().int(),
  reviews_overdue: z.number().int(),
});

/** Loose: api 7 compares the full list item with the detail body, so extra fields must survive parsing. */
export const EntitySchema = z
  .object({
    id: z.number(),
    slug: z.string(),
    display_name: z.string(),
    kind: z.string(),
  })
  .loose();
export const EntityListSchema = listEnvelope(EntitySchema);

export const CountrySchema = z.object({
  iso3: z.string().regex(/^[A-Z]{3}$/),
  iso2: z.string().optional(),
  name: z.string(),
  region: z.string().optional(),
  risk: z.object({ score: z.number() }).optional(),
});
export const CountryListSchema = z.object({
  regions: z.array(z.unknown()),
  countries: z.array(CountrySchema),
});

export const SearchResultSchema = z.object({
  query: z.string(),
  hits: z.array(z.object({ node_id: z.number(), label: z.string(), score: z.number().min(0).max(1) })),
});
