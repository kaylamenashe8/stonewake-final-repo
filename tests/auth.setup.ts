import { mkdirSync } from 'node:fs';
import { test as setup } from '@playwright/test';
import { env, hasCredentials } from '../src/config/env';
import { LoginPage } from '../src/pages/LoginPage';

const authFile = '.auth/user.json';

/**
 * Logs in once and saves storageState for every UI project.
 * Parallel gate: when sign-up exists, switch to one user per worker
 * (test_user+<RUN_ID>-<workerIndex>) via the userFactory — see docs/ARCHITECTURE.md.
 */
setup('authenticate', async ({ page }) => {
  setup.skip(!hasCredentials, 'No TEST_USER/TEST_PASSWORD: running unauthenticated');
  mkdirSync('.auth', { recursive: true });
  const login = new LoginPage(page);
  await login.goto();
  await login.login(env.TEST_USER ?? '', env.TEST_PASSWORD ?? '');
  await login.expectLoggedIn();
  await page.context().storageState({ path: authFile });
});
