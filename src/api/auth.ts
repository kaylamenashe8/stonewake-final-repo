import { env } from '../config/env';

/**
 * Stonewake API key for the Finalist 4 workspace (viewer role), from `.env` / GitHub secrets.
 * The value is never logged; a missing key fails fast with the variable name only.
 */
export function apiKey(): string {
  const key = env.STONEWAKE_API_KEY;
  if (!key) throw new Error('STONEWAKE_API_KEY is not set (see .env.example); API tests need the Finalist 4 key.');
  return key;
}
