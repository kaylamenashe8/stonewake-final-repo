/**
 * Config used only by crawler/promote.ts: same settings as the suite, but it runs tests/generated/
 * (which the main config ignores so candidates never reach CI or the gate). Paths are absolute
 * because Playwright resolves config paths relative to this file's folder.
 */
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from '@playwright/test';
import base from '../playwright.config';

const root = process.cwd();
const auth = resolve(root, '.auth/user.json');
const chromium = base.projects?.find((p) => p.name === 'chromium');
const api = base.projects?.find((p) => p.name === 'api');

export default defineConfig({
  ...base,
  testDir: resolve(root, 'tests/generated'),
  testIgnore: [],
  outputDir: resolve(root, 'test-results/promote'),
  reporter: [['list']],
  projects: [
    {
      name: 'chromium',
      testIgnore: ['**/api/**'],
      use: { ...chromium?.use, storageState: existsSync(auth) ? auth : undefined },
    },
    { name: 'api', testMatch: /[\\/]api[\\/].*\.spec\.ts$/, use: { ...api?.use } },
  ],
});
