import { randomUUID } from 'node:crypto';
import type { ApiClient, TimedResponse } from './client';
import { McpToolResultSchema } from './schemas';

/**
 * MCP server (JSON-RPC over streamable HTTP, stateless). Not in the env contract yet: see the CHANGELOG
 * REQUEST for MCP_URL. Calls go through the shared ApiClient, so the same Bearer key and timing apply.
 */
export const MCP_URL = 'https://mcp.stonewake.ai/';

const DATA_BLOCK = /<<<STONEWAKE_DATA\n([\s\S]*)\nSTONEWAKE_DATA>>>/;

/** Sends one JSON-RPC request (legacy form: no version header, no handshake, as the docs allow). */
export async function mcpRequest(
  api: ApiClient,
  method: string,
  params: Record<string, unknown> = {},
): Promise<TimedResponse<unknown>> {
  return api.call('POST', MCP_URL, {
    data: { jsonrpc: '2.0', id: randomUUID(), method, params },
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' },
  });
}

/** A tool result: `isError` plus the JSON between the STONEWAKE_DATA markers (prompt-injection wrapper). */
export function mcpToolPayload(body: unknown): { isError: boolean; data: unknown } {
  const { result } = McpToolResultSchema.parse(body);
  const text = result.content.map((c) => c.text).join('\n');
  const match = DATA_BLOCK.exec(text);
  if (!match?.[1]) throw new Error('MCP tool result has no STONEWAKE_DATA block');
  return { isError: result.isError, data: JSON.parse(match[1]) };
}
