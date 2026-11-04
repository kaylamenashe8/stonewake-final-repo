import { z } from 'zod';

/** JSON-RPC 2.0 success carrying an MCP tool result (`content[]` + `isError`). */
export const McpToolResultSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number()]),
  result: z.object({
    content: z.array(z.object({ type: z.literal('text'), text: z.string() })).min(1),
    isError: z.boolean(),
  }),
});
export type McpToolResult = z.infer<typeof McpToolResultSchema>;

/** JSON-RPC 2.0 error (e.g. -32001 missing or refused key, -32602 bad arguments). */
export const McpErrorSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: z.union([z.string(), z.number(), z.null()]),
  error: z.object({ code: z.number().int(), message: z.string().min(1) }).loose(),
});

/** `tools/list` result: names are enough for contract checks. */
export const McpToolListSchema = z.object({
  jsonrpc: z.literal('2.0'),
  result: z.object({ tools: z.array(z.object({ name: z.string().min(1) }).loose()) }).loose(),
});

/** Registry institution as served by REST `GET /v1/entities/{id}` and MCP `company_profile`. */
export const InstitutionSchema = z.strictObject({
  id: z.number().int(),
  slug: z.string().min(1),
  display_name: z.string().min(1),
  full_name: z.string().nullable(),
  kind: z.string().min(1),
  country: z.string().nullable(),
  aliases: z.array(z.string()),
  groups: z.array(z.unknown()),
  kind_label: z.string(),
  location_label: z.string(),
});
export type Institution = z.infer<typeof InstitutionSchema>;
