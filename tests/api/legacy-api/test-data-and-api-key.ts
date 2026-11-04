import { env } from '../../../src/config/env';

/**
 * Shared values for the migrated legacy API tests (formerly tests/api.spec.ts).
 * Requests go through the `api` fixture (ApiClient); paths are relative to the `api` project baseURL (API_URL).
 */

/** Error body the API returns for any missing or invalid credential. */
export const UNAUTHENTICATED = {
  error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' },
};

/** Error body for an id that does not exist. */
export const NOT_FOUND = { error: { code: 'not_found', message: 'Resource not found.' } };

/** Well-formed but never-issued key: proves the API checks the key, not just its `swk_live_` shape. */
export const FAKE_LIVE_KEY = 'swk_live_invalid000000000000000000000000';

/** Our workspace key (STONEWAKE_API_KEY from .env / GitHub secrets). Never log it. */
export function apiKey(): string {
  const key = env.STONEWAKE_API_KEY;
  if (!key) throw new Error('STONEWAKE_API_KEY is not set (see .env.example)');
  return key;
}
