import { z } from 'zod';
import { listEnvelope } from './common';

/** `GET /v1/screenings` row. The Finalist 4 workspace holds none today, so only the documented core is pinned. */
export const ScreeningRowSchema = z
  .object({
    screening_id: z.number().int(),
    subject_type: z.enum(['entity', 'country', 'person']),
    worst_verdict: z.string().nullable(),
  })
  .loose();

export const ScreeningListSchema = listEnvelope(ScreeningRowSchema);
export type ScreeningList = z.infer<typeof ScreeningListSchema>;
