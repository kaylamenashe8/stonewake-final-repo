import type { BrowserContextOptions } from '@playwright/test';
import { env, hasCredentials } from '../../../src/config/env';

/** TEST_USER / TEST_PASSWORD from .env or CI secrets only (F2, F9). Never log these values. */
export const credentials = {
  available: hasCredentials,
  user: env.TEST_USER ?? '',
  password: env.TEST_PASSWORD ?? '',
} as const;

/** A browser context with no session, for tests that exercise the sign-in form itself. */
export const signedOut: BrowserContextOptions['storageState'] = { cookies: [], origins: [] };
