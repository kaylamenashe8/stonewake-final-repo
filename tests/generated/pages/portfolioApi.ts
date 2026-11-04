import { z } from 'zod';
import type { ApiClient, TimedResponse } from '../../../src/api/client';
import { env } from '../../../src/config/env';

/** The fields of GET /v1/portfolio/summary this UI check compares; the full contract is the API lane's. */
export const portfolioSummarySchema = z.object({
  statuses: z.record(z.string(), z.number().int().nonnegative()),
  active_exposures: z.number().int().nonnegative(),
});
export type PortfolioSummary = z.infer<typeof portfolioSummarySchema>;

/** GET /v1/portfolio/summary with our workspace key (STONEWAKE_API_KEY; never logged). */
export async function fetchPortfolioSummary(api: ApiClient): Promise<TimedResponse<PortfolioSummary>> {
  const { API_URL, STONEWAKE_API_KEY } = env;
  if (!API_URL || !STONEWAKE_API_KEY)
    throw new Error('API_URL and STONEWAKE_API_KEY must be set (see .env.example)');
  api.setToken(STONEWAKE_API_KEY);
  return api.call('GET', `${API_URL}/v1/portfolio/summary`, { schema: portfolioSummarySchema });
}
