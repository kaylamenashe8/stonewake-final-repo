import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

export const OUT_DIR = resolve(process.env.TRIAGE_OUT ?? 'triage/out');

export function ensureDir(dir: string): string {
  mkdirSync(dir, { recursive: true });
  return dir;
}

export function writeJson(file: string, data: unknown): void {
  ensureDir(dirname(file));
  writeFileSync(file, JSON.stringify(data, null, 2));
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed JSON boundary
export function readJson<T>(file: string): T {
  return JSON.parse(readFileSync(file, 'utf8')) as T;
}

export function writeText(file: string, text: string): void {
  ensureDir(dirname(file));
  writeFileSync(file, text);
}

/** Removes ANSI colour codes Playwright puts in error messages. */
export function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

export function slug(s: string, max = 60): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max);
}

/** Appends markdown to the GitHub job summary when running in Actions. */
export function appendStepSummary(md: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${md}\n`);
}

export function setOutput(name: string, value: string | number): void {
  const file = process.env.GITHUB_OUTPUT;
  if (file) appendFileSync(file, `${name}=${String(value)}\n`);
}

/** Every results.json under a dir (CI shards download as results-<n>/...). */
export function findFiles(root: string, name: string, depth = 6): string[] {
  if (!existsSync(root)) return [];
  if (statSync(root).isFile()) return [root];
  const out: string[] = [];
  const walk = (dir: string, d: number): void => {
    if (d < 0) return;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(p, d - 1);
      } else if (entry.name === name) out.push(p);
    }
  };
  walk(root, depth);
  return out;
}

/** Runs a promise with a hard budget; resolves to the fallback on timeout. */
export async function withBudget<T>(ms: number, work: Promise<T>, fallback: T): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<T>((res) => {
    timer = setTimeout(() => {
      res(fallback);
    }, ms);
  });
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}\n…[truncated ${s.length - max} chars]` : s;
}

/** True when the module is the entry point (`tsx triage/x.ts`), false when imported. */
export function isMain(moduleUrl: string): boolean {
  const entry = process.argv[1];
  if (!entry) return false;
  try {
    return resolve(entry) === resolve(new URL(moduleUrl).pathname);
  } catch {
    return false;
  }
}
