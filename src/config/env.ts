import { z } from 'zod';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/** Minimal .env loader (no dependency). Real env vars always win over the file. */
function loadDotEnv(file = resolve(process.cwd(), '.env')): void {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (!m?.[1] || line.trimStart().startsWith('#')) continue;
    const key = m[1];
    const value = (m[2] ?? '').replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}
loadDotEnv();

const emptyToUndefined = (v: unknown): unknown => (v === '' ? undefined : v);

const schema = z.object({
  BASE_URL: z.url(),
  API_URL: z.preprocess(emptyToUndefined, z.url().optional()),
  TEST_USER: z.preprocess(emptyToUndefined, z.string().optional()),
  TEST_PASSWORD: z.preprocess(emptyToUndefined, z.string().optional()),
  TEST_ID_ATTRIBUTE: z.preprocess(emptyToUndefined, z.string().default('data-testid')),
  HEAL_MODE: z.preprocess(emptyToUndefined, z.enum(['off', 'log', 'strict']).default('log')),
  RUN_ID: z.preprocess(emptyToUndefined, z.string().default(`local-${Date.now().toString(36)}`)),
  CI: z.preprocess((v) => v === 'true' || v === '1', z.boolean()),
  LOCALE: z.preprocess(emptyToUndefined, z.string().default('en-US')),
  TIMEZONE: z.preprocess(emptyToUndefined, z.string().default('UTC')),
});

export type Env = z.infer<typeof schema>;

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const issues = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
  throw new Error(`Invalid environment (see .env.example):\n${issues}`);
}

export const env: Env = parsed.data;
// Make RUN_ID stable for every worker of this run.
process.env.RUN_ID = env.RUN_ID;

export const hasCredentials = Boolean(env.TEST_USER && env.TEST_PASSWORD);
