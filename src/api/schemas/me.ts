import { z } from 'zod';

/** `GET /v1/me` for an API key: one team, viewer role, `read` scope at least. */
export const MeSchema = z.object({
  credential: z.enum(['api_key', 'user']),
  role: z.string().regex(/^[a-z_]+$/),
  team_scope: z.object({
    all_teams: z.boolean(),
    teams: z.array(z.object({ id: z.string().min(1), name: z.string() })),
  }),
  key: z
    .object({
      id: z.string().min(1),
      name: z.string(),
      role: z.string(),
      scopes: z.array(z.string()),
      expires_at: z.string().nullable(),
    })
    .nullable(),
});
export type Me = z.infer<typeof MeSchema>;
