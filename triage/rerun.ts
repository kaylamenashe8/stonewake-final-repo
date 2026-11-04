import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { FailedTestEx } from './report';
import { countResults, parseReport } from './report';
import { OUT_DIR, findFiles, slug, writeJson } from './util';
import { isMain } from './util';

/**
 * Rung 1 (D4): rerun each failed test alone 3× with retries 0 and full trace.
 * Passes at least once → flaky (stop). Fails 3/3 → deterministic (continue up the ladder).
 */
export interface RerunResult {
  passed: number;
  failed: number;
  /** A fresh failing attempt (with trace), when one exists. */
  freshFailure?: FailedTestEx;
  error?: string;
}

export function rerunIsolated(f: FailedTestEx, times = 3): RerunResult {
  const dir = join(OUT_DIR, 'rerun', slug(`${f.project}-${f.test}`));
  const json = join(dir, 'results.json');
  const args = [
    'playwright',
    'test',
    `${f.file}:${f.line}`,
    `--project=${f.project}`,
    '--retries=0',
    `--repeat-each=${times}`,
    '--workers=1',
    '--trace=on',
    '--reporter=json',
    `--output=${join(dir, 'test-results')}`,
  ];
  const res = spawnSync('npx', args, {
    env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json, FORCE_COLOR: '0' },
    encoding: 'utf8',
    timeout: 5 * 60_000,
  });
  if (!existsSync(json)) {
    return { passed: 0, failed: 0, error: (res.stderr || res.stdout || 'no report').slice(-2000) };
  }
  const counts = countResults(json, f.file, f.line, f.project);
  const fresh = parseReport(json).find((x) => x.file === f.file && x.line === f.line && x.project === f.project);
  return { ...counts, ...(fresh ? { freshFailure: fresh } : {}) };
}

/* CLI: tsx triage/rerun.ts [report] [max] */
function main(): Promise<void> {
  const src = process.argv[2] ?? 'test-results/results.json';
  const max = Number(process.argv[3] ?? 5);
  const failed = findFiles(src, 'results.json')
    .flatMap(parseReport)
    .filter((f) => f.reportStatus === 'unexpected')
    .slice(0, max);
  const out = failed.map((f) => {
    const r = rerunIsolated(f);
    console.log(`${r.passed}/${r.passed + r.failed} passed  ${f.test}`);
    return { test: f.test, passed: r.passed, failed: r.failed, error: r.error };
  });
  writeJson(join(OUT_DIR, 'rerun.json'), out);
  return Promise.resolve();
}

if (isMain(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
