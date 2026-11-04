import { z } from 'zod';

/** `GET /health` (unversioned, no auth). Exact key set per the API docs. */
export const HealthSchema = z.strictObject({
  status: z.literal('ok'),
  app: z.literal('stonewake'),
  version: z.string().min(1),
  environment: z.string().min(1),
});
export type Health = z.infer<typeof HealthSchema>;
