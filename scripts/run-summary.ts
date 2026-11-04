/**
 * Run summary: reads Playwright's JSON report (+ heal report, + triage verdicts when present) and writes a
 * Markdown job summary. Also exports the report parser used by gate-summary.ts and slack-notify.ts.
 *
 *   tsx scripts/run-summary.ts [--results test-results/results.json] [--heals test-results/heal-report.json]
 *                              [--report-url <url>] [--title "CI run"]
 * Appends to $GITHUB_STEP_SUMMARY when set, otherwise prints to stdout.
 */
import { appendFileSync, existsSync, readFileSync } from 'node:fs';

export interface FailureInfo {
  test: string;
  file: string;
  project: string;
  error: string;
}

export interface RunSummary {
  passed: number;
  failed: number;
  flaky: number;
  skipped: number;
  healed: number;
  durationMs: number;
  failures: FailureInfo[];
  flakyTests: string[];
  skippedWithBug: { test: string; bug: string }[];
}

interface PwResult {
  status: string;
  duration: number;
  errors?: { message?: string }[];
  error?: { message?: string };
}
interface PwTest {
  projectName: string;
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  annotations?: { type: string; description?: string }[];
  results: PwResult[];
}
interface PwSpec {
  title: string;
  file: string;
  tests: PwTest[];
}
interface PwSuite {
  title: string;
  file: string;
  specs?: PwSpec[];
  suites?: PwSuite[];
}
interface PwReport {
  stats?: { duration?: number; expected?: number; unexpected?: number; flaky?: number; skipped?: number };
  suites?: PwSuite[];
}

export interface Verdict {
  test: string;
  classification: string;
  confidence: number;
  root_cause: string;
}

export function arg(name: string, fallback?: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

function readJson(path: string): unknown {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    return undefined;
  }
}

function stripAnsi(s: string): string {
  // eslint-disable-next-line no-control-regex
  return s.replace(/\u001b\[[0-9;]*m/g, '');
}

function walk(suite: PwSuite, path: string[], out: { spec: PwSpec; titlePath: string[] }[]): void {
  const here = suite.title && suite.title !== suite.file ? [...path, suite.title] : path;
  for (const spec of suite.specs ?? []) out.push({ spec, titlePath: [...here, spec.title] });
  for (const child of suite.suites ?? []) walk(child, here, out);
}

export function summarize(resultsPath: string, healsPath?: string): RunSummary | undefined {
  const report = readJson(resultsPath) as PwReport | undefined;
  if (!report) return undefined;
  const specs: { spec: PwSpec; titlePath: string[] }[] = [];
  for (const s of report.suites ?? []) walk(s, [], specs);

  const sum: RunSummary = {
    passed: 0,
    failed: 0,
    flaky: 0,
    skipped: 0,
    healed: 0,
    durationMs: report.stats?.duration ?? 0,
    failures: [],
    flakyTests: [],
    skippedWithBug: [],
  };
  for (const { spec, titlePath } of specs) {
    for (const t of spec.tests) {
      const name = `${spec.file} > ${titlePath.join(' > ')}`;
      if (t.status === 'expected') sum.passed++;
      else if (t.status === 'flaky') {
        sum.flaky++;
        sum.flakyTests.push(name);
      } else if (t.status === 'skipped') {
        sum.skipped++;
        const bug = t.annotations?.find((a) => a.type === 'bug');
        if (bug?.description) sum.skippedWithBug.push({ test: name, bug: bug.description });
      } else {
        sum.failed++;
        const last = t.results[t.results.length - 1];
        const msg = last?.errors?.[0]?.message ?? last?.error?.message ?? 'unknown error';
        sum.failures.push({
          test: name,
          file: spec.file,
          project: t.projectName,
          error: stripAnsi(msg).split('\n').slice(0, 3).join(' ').slice(0, 300),
        });
      }
    }
  }
  if (healsPath) sum.healed = (readJson(healsPath) as { count?: number } | undefined)?.count ?? 0;
  return sum;
}

export function readVerdicts(path = 'triage/out/verdicts.json'): Verdict[] {
  return (readJson(path) as Verdict[] | undefined) ?? [];
}

export function fmtDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s`;
}

export function writeSummary(markdown: string): void {
  const file = process.env.GITHUB_STEP_SUMMARY;
  if (file) appendFileSync(file, `${markdown}\n`);
  else process.stdout.write(`${markdown}\n`);
}

function main(): void {
  const results = arg('results', 'test-results/results.json') ?? '';
  const heals = arg('heals', 'test-results/heal-report.json');
  const reportUrl = arg('report-url');
  const title = arg('title', 'Test run') ?? 'Test run';
  const sum = summarize(results, heals);
  if (!sum) {
    writeSummary(`## ${title}\n\nNo results found at \`${results}\`.`);
    return;
  }
  const status = sum.failed > 0 ? '❌ FAILED' : '✅ PASSED';
  const lines = [
    `## ${title}: ${status}`,
    '',
    '| Passed | Failed | Flaky | Skipped | Healed | Duration |',
    '| --- | --- | --- | --- | --- | --- |',
    `| ${sum.passed} | ${sum.failed} | ${sum.flaky} | ${sum.skipped} | ${sum.healed} | ${fmtDuration(sum.durationMs)} |`,
  ];
  if (reportUrl) lines.push('', `Report: ${reportUrl}`);
  if (sum.failures.length) {
    lines.push('', '### Failures', '', '| Test | Project | Error |', '| --- | --- | --- |');
    for (const f of sum.failures.slice(0, 25))
      lines.push(`| ${f.test} | ${f.project} | ${f.error.replace(/\|/g, '\\|')} |`);
  }
  if (sum.flakyTests.length) lines.push('', '### Flaky (passed on retry)', '', ...sum.flakyTests.map((t) => `- ${t}`));
  if (sum.healed) lines.push('', `### Heals: ${sum.healed} (each must become a committed locator fix before the gate)`);
  if (sum.skippedWithBug.length)
    lines.push('', '### Known product bugs (skipped)', '', ...sum.skippedWithBug.map((s) => `- ${s.test}: ${s.bug}`));
  const verdicts = readVerdicts();
  if (verdicts.length) {
    lines.push('', '### Triage verdicts', '', '| Test | Verdict | Confidence | Root cause |', '| --- | --- | --- | --- |');
    for (const v of verdicts)
      lines.push(`| ${v.test} | ${v.classification} | ${v.confidence.toFixed(2)} | ${v.root_cause.replace(/\|/g, '\\|')} |`);
  }
  writeSummary(lines.join('\n'));
}

// Module-type agnostic entry check (works whether the target repo is ESM or CJS).
if (/run-summary\.ts$/.test(process.argv[1] ?? '')) main();
