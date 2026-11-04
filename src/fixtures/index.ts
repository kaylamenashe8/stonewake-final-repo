import { test as base, expect } from '@playwright/test';
import { ApiClient } from '../api/client';
import { DataFactory } from '../data/factory';
import { Healer } from '../utils/healing';
import { LoginPage } from '../pages/LoginPage';

interface Fixtures {
  healer: Healer;
  data: DataFactory;
  api: ApiClient;
  loginPage: LoginPage;
  /** Console errors and uncaught page errors seen during the test (auto-collected). */
  pageErrors: string[];
}

/**
 * Single import for tests:  import { test, expect } from '../../src/fixtures';
 * Add page objects here as the suite grows (one fixture per page).
 */
export const test = base.extend<Fixtures>({
  pageErrors: [
    async ({ page }, use, testInfo) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
      });
      await use(errors);
      if (errors.length) {
        await testInfo.attach('page-errors.txt', { body: errors.join('\n'), contentType: 'text/plain' });
      }
    },
    { auto: true },
  ],
  healer: async ({ page }, use) => {
    await use(new Healer(page));
  },
  data: async ({}, use, testInfo) => {
    await use(new DataFactory(testInfo.workerIndex, testInfo.title));
  },
  api: async ({ request }, use, testInfo) => {
    const timings: string[] = [];
    await use(new ApiClient(request, (k, ms) => timings.push(`${k}: ${ms}ms`)));
    if (timings.length) testInfo.annotations.push({ type: 'api-timing', description: timings.join('; ') });
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
});

export { expect };
