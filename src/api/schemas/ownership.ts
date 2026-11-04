import { z } from 'zod';

/** `GET /v1/nodes/{node_id}/ownership-chain`. `params` echoes the request (defaults threshold 25, max_depth 8). */
export const OwnershipChainSchema = z
  .object({
    root_id: z.number().int(),
    computed_at: z.iso.datetime({ offset: true }),
    params: z.object({ threshold: z.number().gt(0).max(100), max_depth: z.number().int().min(1).max(8), include_persons: z.boolean() }).loose(),
    nodes: z.array(z.object({ node_id: z.number().int(), label: z.string() }).loose()),
    paths: z.array(
      z
        .object({
          hops: z.array(z.unknown()),
          terminal: z.object({ reason: z.string(), wording: z.string() }).loose().nullable(),
        })
        .loose(),
    ),
    coverage: z.object({ verdict: z.string(), wording: z.string() }).loose(),
    register_owners: z.array(z.unknown()),
  })
  .loose();
export type OwnershipChain = z.infer<typeof OwnershipChainSchema>;
