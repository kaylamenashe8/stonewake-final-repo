import { defineConfig, devices } from '@playwright/test';
import { env, hasCredentials } from './src/config/env';

/**
 * Owned by the Architect (shared file). Other agents request changes via docs/CHANGELOG.md.
 * Gate runs pass --retries=0 and HEAL_MODE=strict on top of this file.
 */
const authFile = '.auth/user.json';

export default defineConfig({
  testDir: './tests',
  testIgnore: ['**/generated/**'], // crawler candidates stay out of CI and the gate until promoted
  fullyParallel: true,
  forbidOnly: env.CI,
  retries: env.CI ? 1 : 0,
  workers: env.CI ? 4 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 7_000,
    toHaveScreenshot: { maxDiffPixelRatio: 0.01, animations: 'disabled', caret: 'hide' },
  },
  reporter: [
    ...(env.CI
      ? ([['blob'], ['github']] as const)
      : ([['list']] as const)),
    ['html', { open: 'never' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['./src/utils/heal-reporter.ts', { outputFile: 'test-results/heal-report.json' }],
  ],
  use: {
    baseURL: env.BASE_URL,
    testIdAttribute: env.TEST_ID_ATTRIBUTE,
    locale: env.LOCALE,
    timezoneId: env.TIMEZONE,
    viewport: { width: 1366, height: 900 },
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 10_000,
    navigationTimeout: 20_000,
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      testIgnore: ['**/api/**', '**/generated/**'],
      use: { ...devices['Desktop Chrome'], ...(hasCredentials ? { storageState: authFile } : {}) },
      dependencies: hasCredentials ? ['setup'] : [],
    },
    {
      name: 'api',
      testMatch: /tests\/api\/.*\.spec\.ts/,
      use: { baseURL: env.API_URL ?? env.BASE_URL },
    },
    {
      name: 'mobile',
      grep: /@mobile/,
      use: { ...devices['Pixel 7'], ...(hasCredentials ? { storageState: authFile } : {}) },
      dependencies: hasCredentials ? ['setup'] : [],
    },
    // Not in the gate. Enable only if time remains (non-goal: cross-browser).
    ...(process.env.ALL_BROWSERS
      ? [
          { name: 'firefox', use: { ...devices['Desktop Firefox'] }, testIgnore: ['**/api/**'] },
          { name: 'webkit', use: { ...devices['Desktop Safari'] }, testIgnore: ['**/api/**'] },
        ]
      : []),
  ],
});
