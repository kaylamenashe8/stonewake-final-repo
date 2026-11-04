import { z } from 'zod';
import { listEnvelope } from './common';

const iso = z.iso.datetime({ offset: true });

/** One Deal Book row (`GET /v1/deals` item). Only contract fields we rely on; extra fields are allowed. */
export const DealRowSchema = z.object({
  deal_id: z.string().min(1),
  team_id: z.string().min(1),
  team_name: z.string().nullable(),
  name: z.string().min(1),
  summary: z.string().nullable(),
  primary_country_iso3: z.string().regex(/^[A-Z]{3}$/).nullable(),
  countries: z.array(z.string()),
  countries_iso3: z.array(z.string().nullable()),
  sector: z.string().nullable(),
  stage: z.string(),
  status: z.enum(['new', 'tracking', 'dismissed']),
  relevance_score: z.number().min(0).max(100).nullable(),
  value_status: z.enum(['confirmed', 'reported', 'absent']),
  value_text: z.string().nullable(),
  value_basis: z.enum(['financing', 'contract', 'unclassified']).nullable(),
  contract_value_bound: z.enum(['at_least', 'up_to', 'range']).nullable(),
  agencies: z.array(
    z.object({
      name: z.string(),
      kind: z.enum(['eca', 'multilateral', 'dfi', 'development_bank', 'agency', 'bank']).nullable(),
      roles: z.array(z.string()),
    }),
  ),
  lenders: z.array(z.unknown()),
  first_seen_at: iso,
  last_event_at: iso.nullable(),
  score_window: z.string(),
  score_hidden: z.boolean(),
  merged_into: z.string().nullable(),
  has_unseen_update: z.null(), // documented: always null for API keys
});
export type DealRow = z.infer<typeof DealRowSchema>;

export const DealListSchema = listEnvelope(DealRowSchema).extend({
  stale_months: z.number().int().min(0),
  movement_months: z.number().int().min(0),
  outside_markets_held: z.boolean(),
});
export type DealList = z.infer<typeof DealListSchema>;

/** `GET /v1/deals/{deal_id}`: the row plus detail blocks. */
export const DealDetailSchema = DealRowSchema.extend({
  summary_lines: z.array(z.object({ citations: z.array(z.unknown()) }).loose()),
  briefing: z
    .object({
      text: z.string(),
      drafted_by: z.literal('model'),
      sources: z.array(z.object({ url: z.string() }).loose()),
    })
    .loose()
    .nullable(),
  parties: z.array(z.unknown()),
  project_records: z.array(z.unknown()),
  timeline: z.array(z.unknown()),
  timeline_total: z.number().int().min(0),
  sources: z.array(z.unknown()),
});
export type DealDetail = z.infer<typeof DealDetailSchema>;
