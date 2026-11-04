import type { ApiClient } from './client';
import { PortfolioListSchema } from './schemas';

/**
 * A company the key's team holds, picked from the live book (never a hardcoded id).
 * Throws with a clear message when the book is empty so the test fails on the precondition, not later.
 */
export async function heldCompanyNodeId(api: ApiClient): Promise<number> {
  const res = await api.call('GET', '/v1/portfolio', { schema: PortfolioListSchema, params: { limit: 1 } });
  if (res.status !== 200) throw new Error(`No held company: GET /v1/portfolio -> ${res.status}`);
  const row = res.body.items[0];
  if (!row) throw new Error('No held company: the Finalist 4 portfolio is empty');
  return row.node_id;
}
