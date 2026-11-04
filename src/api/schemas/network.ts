import { z } from 'zod';

export const NetworkNodeSchema = z
  .object({
    node_id: z.number().int(),
    node_type: z.enum(['company', 'person']),
    label: z.string(),
  })
  .loose();

/** Every relationship carries its citation (register + source URL). */
export const CitationSchema = z
  .object({
    record_id: z.number().int(),
    connector_id: z.string().min(1),
    register: z.string().min(1),
    source_url: z.url(),
    retrieved_at: z.iso.datetime({ offset: true }).nullable(),
  })
  .loose();

export const NetworkEdgeSchema = z
  .object({
    id: z.number().int(),
    src_node_id: z.number().int(),
    dst_node_id: z.number().int(),
    edge_type: z.string().min(1),
    role_label: z.string().nullable(),
    pct: z.number().nullable(),
    current: z.boolean(),
    citation: CitationSchema,
  })
  .loose();

/** `GET /v1/nodes/{node_id}/network`. */
export const NetworkSchema = z.object({
  center_id: z.number().int(),
  nodes: z.array(NetworkNodeSchema),
  edges: z.array(NetworkEdgeSchema),
  truncated: z.boolean(),
});
export type Network = z.infer<typeof NetworkSchema>;
