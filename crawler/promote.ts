/**
 * Promotion filter for crawler candidates (D8, Crawler pipeline step "Filter").
 *   npm run promote -- tests/generated/cart.add.spec.ts [more files] [--apply]
 * Each candidate: static checks (lint, fixtures import, business assertion), then --repeat-each=10
 * --retries=0 with 1 worker and, if clean, with 4 workers. Verdict per the PRD table; every candidate is
 * appended to crawler/out/promotion-report.md. Without --apply, file moves/deletes are printed, not done.
 */
import { spawnSync } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, relative } from 'node:path';
import { parseArgs } from 'node:util';
import type { FailedTest } from '../triage/types';

type Verdict = 'Keep' | 'Flaky' | 'Product bug' | 'Bad test' | 'Parked' | 'Needs triage' | 'Rejected (static)';

interface TestTally {
  title: string;
  line: number;
  passed: number;
  failed: number;
  signatures: string[];
  firstError?: string;
  trace?: string;
  screenshot?: string;
}

const OUT = 'crawler/out';
const REPORT = `${OUT}/promotion-report.md`;
const ATTEMPTS = `${OUT}/regeneration-attempts.json`;
const CONFIG = 'crawler/promote.config.ts';
const REPEAT = 10;

const { values: opts, positionals: files } = parseArgs({
  options: { apply: { type: 'boolean', default: false } },
  allowPositionals: true,
});

function run(cmd: string, args: string[], env: Record<string, string> = {}): { code: number; out: string } {
  const r = spawnSync(cmd, args, { encoding: 'utf8', env: { ...process.env, ...env }, maxBuffer: 64 * 1024 * 1024 });
  return { code: r.status ?? 1, out: `${r.stdout}${r.stderr}` };
}

function staticChecks(file: string): string[] {
  const src = readFileSync(file, 'utf8');
  const problems: string[] = [];
  if (!/from\s+['"][./]+(?:[^'"]*\/)?src\/fixtures(?:\/index)?['"]/.test(src))
    problems.push('does not import test/expect from src/fixtures');
  const matchers = [...src.matchAll(/expect(?:\.soft|\.poll)?\([^]*?\)\s*(?:\.not)?\.(to\w+)\(/g)].map((m) => m[1]);
  if (!matchers.some((m) => m && !['toBeVisible', 'toBeHidden', 'toBeAttached'].includes(m)))
    problems.push('asserts visibility only (needs a business outcome assertion)');
  if (/waitForTimeout|force:\s*true|\.only\(/.test(src)) problems.push('hard wait, force or .only');
  const lint = run('npx', ['eslint', '--max-warnings=0', file]);
  if (lint.code !== 0) problems.push(`lint failed:\n${lint.out.trim().split('\n').slice(0, 8).join('\n')}`);
  return problems;
}

interface JsonResult {
  status: string;
  error?: { message?: string; stack?: string };
  attachments?: { name: string; path?: string }[];
}
interface JsonSpec {
  title: string;
  line: number;
  tests: { projectName: string; results: JsonResult[] }[];
}
interface JsonSuite {
  title: string;
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}

function signature(message: string): string {
  // ANSI codes stripped, numbers and quoted values generalised so the same cause groups together.
  return (
    message
      // eslint-disable-next-line no-control-regex -- stripping ANSI colour codes
      .replace(/\u001b\[[0-9;]*m/g, '')
      .split('\n')
      .find((l) => l.trim())
      ?.replace(/\d+ms/g, '<n>ms')
      .replace(/"[^"]{20,}"/g, '"…"')
      .trim()
      .slice(0, 160) ?? 'unknown error'
  );
}

function tally(file: string, workers: number): TestTally[] {
  const jsonFile = `test-results/promote-${basename(file)}-${workers}w.json`;
  mkdirSync('test-results', { recursive: true });
  run(
    'npx',
    ['playwright', 'test', '--config', CONFIG, file, `--repeat-each=${REPEAT}`, '--retries=0', `--workers=${workers}`, '--reporter=json'],
    { PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile, HEAL_MODE: 'strict' },
  );
  if (!existsSync(jsonFile)) return [];
  const report = JSON.parse(readFileSync(jsonFile, 'utf8')) as { suites: JsonSuite[] };
  const byTitle = new Map<string, TestTally>();
  const walk = (s: JsonSuite, path: string[]): void => {
    for (const spec of s.specs ?? []) {
      const title = [...path, spec.title].filter(Boolean).join(' > ');
      const t = byTitle.get(title) ?? { title, line: spec.line, passed: 0, failed: 0, signatures: [] };
      for (const test of spec.tests)
        for (const r of test.results) {
          if (r.status === 'passed') t.passed++;
          else if (r.status !== 'skipped') {
            t.failed++;
            const sig = signature(r.error?.message ?? r.status);
            if (!t.signatures.includes(sig)) t.signatures.push(sig);
            t.firstError ??= r.error?.message ?? r.status;
            t.trace ??= r.attachments?.find((a) => a.name === 'trace')?.path;
            t.screenshot ??= r.attachments?.find((a) => a.name === 'screenshot')?.path;
          }
        }
      byTitle.set(title, t);
    }
    for (const child of s.suites ?? []) walk(child, [...path, child.title.endsWith('.ts') ? '' : child.title]);
  };
  for (const s of report.suites) walk(s, []);
  return [...byTitle.values()];
}

async function triage(file: string, t: TestTally): Promise<'product' | 'automation' | 'environment' | null> {
  // Lane contract: triage/classifier.ts exports classify(failed, evidence) and evidenceFor(failed, rerun).
  try {
    const mod = (await import('../triage/classifier')) as Record<string, unknown>;
    const classify = mod.classify as ((f: unknown, ev: unknown) => { verdict?: { classification?: string } }) | undefined;
    const evidenceFor = mod.evidenceFor as ((f: unknown, rerun?: { passed: number; failed: number }) => unknown) | undefined;
    if (typeof classify !== 'function' || typeof evidenceFor !== 'function') return null;
    const failed: FailedTest & { reportStatus: 'unexpected' } = {
      test: `${relative('tests', file)} > ${t.title}`,
      file,
      line: t.line,
      project: 'chromium',
      error: t.firstError ?? '',
      reportStatus: 'unexpected',
      ...(t.trace ? { tracePath: t.trace } : {}),
      ...(t.screenshot ? { screenshotPath: t.screenshot } : {}),
    };
    const c = classify(failed, evidenceFor(failed, { passed: t.passed, failed: t.failed })).verdict?.classification;
    return c === 'product' || c === 'automation' || c === 'environment' ? c : null;
  } catch (e) {
    console.log(`  triage classifier unavailable (${(e as Error).message.split('\n')[0] ?? ''})`);
    return null;
  }
}

function attempts(): Record<string, number> {
  return existsSync(ATTEMPTS) ? (JSON.parse(readFileSync(ATTEMPTS, 'utf8')) as Record<string, number>) : {};
}

function featureOf(file: string): string {
  return basename(file).split('.')[0] ?? 'misc';
}

function act(desc: string, fn: () => void): string {
  if (opts.apply) fn();
  return opts.apply ? desc : `(dry) ${desc}`;
}

async function promote(file: string): Promise<void> {
  console.log(`\n== ${file}`);
  let verdict: Verdict;
  let action: string;
  let results = '';
  let notes: string[];

  const problems = existsSync(file) ? staticChecks(file) : ['file not found'];
  if (problems.length) {
    verdict = 'Rejected (static)';
    action = 'Fix and resubmit (lint, src/fixtures, page objects, business assertion)';
    notes = problems;
  } else {
    const one = tally(file, 1);
    const allClean = (ts: TestTally[]): boolean => ts.length > 0 && ts.every((t) => t.passed === REPEAT && t.failed === 0);
    const four = allClean(one) ? tally(file, 4) : [];
    results = one.map((t) => `${t.title}: ${t.passed}/${REPEAT} (1w)`).join('<br>');
    if (four.length) results += '<br>' + four.map((t) => `${t.title}: ${t.passed}/${REPEAT} (4w)`).join('<br>');
    notes = [...one, ...four].flatMap((t) => t.signatures);

    if (!one.length) {
      verdict = 'Rejected (static)';
      action = 'No tests ran (syntax/import error?)';
    } else if (allClean(one) && allClean(four)) {
      verdict = 'Keep';
      const dest = `tests/e2e/${featureOf(file)}/${basename(file)}`;
      action = act(`git mv ${file} ${dest}  (then promotion PR; log in docs/AI_LOG.md as AI-generated, human-reviewed)`, () => {
        mkdirSync(`tests/e2e/${featureOf(file)}`, { recursive: true });
        run('git', ['mv', file, dest]);
      });
    } else if ([...one, ...four].some((t) => t.passed > 0)) {
      verdict = 'Flaky';
      action = act(`rm ${file}`, () => {
        rmSync(file);
      });
    } else {
      const worst = one.find((t) => t.passed === 0) ?? one[0];
      const cls = worst ? await triage(file, worst) : null;
      if (cls === 'product') {
        verdict = 'Product bug';
        action = 'Keep, add knownBug(SPIRA-<id>) once filed; bug draft → Bug Reporter (docs/BUGS.md)';
      } else if (cls === 'automation') {
        const a = attempts();
        const n = (a[file] ?? 0) + 1;
        if (n > 1) {
          verdict = 'Bad test';
          action = act(`rm ${file} (regeneration already tried)`, () => {
            rmSync(file);
          });
        } else {
          verdict = 'Bad test';
          action = 'Regenerate once (attempt 1/1), then re-run promote';
          a[file] = n;
          mkdirSync(OUT, { recursive: true });
          writeFileSync(ATTEMPTS, JSON.stringify(a, null, 2));
        }
      } else if (cls === 'environment') {
        verdict = 'Parked';
        action = 'Retry next cycle';
      } else {
        verdict = 'Needs triage';
        action = 'Run `npm run triage:classify` / `npm run diagnose` on it, then re-run promote';
      }
    }
  }

  mkdirSync(OUT, { recursive: true });
  if (!existsSync(REPORT))
    writeFileSync(
      REPORT,
      '# Promotion report\n\nEvery crawler candidate: 10 runs with 1 worker, then 10 with 4 workers, retries 0, HEAL_MODE=strict.\n\n| When | Candidate | Results | Verdict | Action | Failure signatures / notes |\n| --- | --- | --- | --- | --- | --- |\n',
    );
  const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, '<br>');
  appendFileSync(
    REPORT,
    `| ${new Date().toISOString().slice(0, 16)} | \`${file}\` | ${cell(results || '-')} | **${verdict}** | ${cell(action)} | ${cell(notes.join('; ') || '-')} |\n`,
  );
  console.log(`  verdict: ${verdict}\n  action: ${action}${notes.length ? `\n  notes: ${notes.join('\n         ')}` : ''}`);
}

async function main(): Promise<void> {
  if (!files.length) {
    console.error('usage: npm run promote -- tests/generated/<file>.spec.ts [...] [--apply]');
    process.exit(2);
  }
  for (const f of files) await promote(f);
  console.log(`\nreport: ${REPORT}`);
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
