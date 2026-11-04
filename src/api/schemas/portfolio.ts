import { z } from 'zod';
import { listEnvelope } from './common';

/** Minimal `GET /v1/portfolio` row: enough to pick a held company. Full contract is api 5 (Stabilizer). */
export const PortfolioRowSchema = z
  .object({
    node_id: z.number().int(),
    label: z.string().min(1),
    status: z.enum(['green', 'amber', 'red', 'insufficient', 'not_assessed', 'sole_trader']),
  })
  .loose();

export const PortfolioListSchema = listEnvelope(PortfolioRowSchema);
