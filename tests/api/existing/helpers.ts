import type { APIResponse } from '@playwright/test';
import { expect } from '../../../src/fixtures';
import '../../../src/config/env'; // side effect: loads .env into process.env

/**
 * Helpers for the migrated legacy API tests (formerly tests/api.spec.ts).
 * Requests are relative: the `api` project sets baseURL from API_URL.
 */

/** Error body the API returns for any missing or invalid credential. */
export const UNAUTHENTICATED = { error: { code: 'unauthenticated', message: 'Missing or invalid credentials.' } };

/** Portfolio row statuses documented for `GET /v1/portfolio`. */
export const PORTFOLIO_STATUSES = ['amber', 'green', 'insufficient', 'not_assessed', 'red', 'sole_trader'];

/** Bearer header for our workspace key (STONEWAKE_API_KEY from .env / GitHub secrets). Never log it. */
export function authHeaders(): Record<string, string> {
  const key = process.env.STONEWAKE_API_KEY;
  if (!key) throw new Error('STONEWAKE_API_KEY is not set (see .env.example)');
  return { Authorization: `Bearer ${key}` };
}

export async function json<T>(res: APIResponse): Promise<T> {
  return (await res.json()) as T;
}

export interface TeamScope {
  all_teams: boolean;
  teams: { id: unknown; name: unknown }[];
}

/** A key scoped to some teams must list at least one, and every team has a string id and name. */
export function expectValidTeamScope(scope: TeamScope): void {
  expect(typeof scope.all_teams).toBe('boolean');
  expect(Array.isArray(scope.teams)).toBe(true);
  if (!scope.all_teams) expect(scope.teams.length).toBeGreaterThan(0);
  for (const t of scope.teams) {
    expect(typeof t.id).toBe('string');
    expect(typeof t.name).toBe('string');
  }
}

/** FastAPI-style 422 body. */
export interface ValidationError {
  error: { code: string };
  detail: { type: string; loc: (string | number)[]; msg: string }[];
}
