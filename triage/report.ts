import { existsSync } from 'node:fs';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import type { FailedTest } from './types';
import { findFiles, readJson, stripAnsi } from './util';

/* Shapes of Playwright's JSON reporter that triage uses. */
interface JsonAttachment {
  name: string;
  contentType: string;
  path?: string;
  body?: string;
}
interface JsonResult {
  status: string;
  retry: number;
  error?: { message?: string; stack?: string };
  errors?: { message?: string }[];
  stdout?: { text?: string }[];
  attachments: JsonAttachment[];
  errorLocation?: { file: string; line: number };
}
interface JsonTest {
  projectName: string;
  status: 'expected' | 'unexpected' | 'flaky' | 'skipped';
  results: JsonResult[];
}
interface JsonSpec {
  title: string;
  file: string;
  line: number;
  tests: JsonTest[];
}
interface JsonSuite {
  title: string;
  file: string;
  specs?: JsonSpec[];
  suites?: JsonSuite[];
}
export interface JsonReport {
  config: { rootDir: string };
  suites: JsonSuite[];
}

/** A failed test plus the raw text of attachments the classifier reads. */
export interface FailedTestEx extends FailedTest {
  pageErrorsText?: string;
  /** Final status in the source report: unexpected = failed, flaky = passed on retry. */
  reportStatus: 'unexpected' | 'flaky';
}

/**
 * Attachment paths in a CI report are absolute paths on the runner that produced it.
 * When the artifact is downloaded elsewhere, find the same file under the report's directory.
 */
export function resolveAttachment(p: string | undefined, reportFile: string): string | undefined {
  if (!p) return undefined;
  if (existsSync(p)) return p;
  const marker = `test-results${sep}`;
  const norm = p.split('/').join(sep);
  const idx = norm.lastIndexOf(marker);
  if (idx >= 0) {
    const tail = norm.slice(idx);
    for (let dir = dirname(resolve(reportFile)), i = 0; i < 4; i++, dir = dirname(dir)) {
      const candidate = join(dir, tail);
      if (existsSync(candidate)) return candidate;
      const flat = join(dir, tail.slice(marker.length));
      if (existsSync(flat)) return flat;
    }
  }
  // Merged reports name attachments by content hash (<sha1>.zip / .png): find that file anywhere
  // under the downloaded artifacts (e.g. the html report's data/ folder).
  const base = basename(norm);
  if (/^[0-9a-f]{40}\.\w+$/.test(base)) {
    const root = dirname(dirname(resolve(reportFile)));
    const hit = findFiles(root, base, 6)[0];
    if (hit) return hit;
  }
  return undefined;
}

export function parseReport(reportFile: string): FailedTestEx[] {
  const report = readJson<JsonReport>(reportFile);
  const rootDir = report.config.rootDir;
  const out: FailedTestEx[] = [];

  const walk = (suite: JsonSuite, titles: string[]): void => {
    const here = suite.title && suite.title !== suite.file ? [...titles, suite.title] : titles;
    for (const spec of suite.specs ?? []) {
      for (const t of spec.tests) {
        if (t.status !== 'unexpected' && t.status !== 'flaky') continue;
        // For flaky tests the interesting result is the failed attempt; for failures, the last one.
        const failedResults = t.results.filter((r) => r.status !== 'passed' && r.status !== 'skipped');
        const r = failedResults[failedResults.length - 1];
        if (!r) continue;
        const absFile = isAbsolute(spec.file) ? spec.file : join(rootDir, spec.file);
        const file = relative(process.cwd(), absFile) || spec.file;
        const att = (name: string): JsonAttachment | undefined => r.attachments.find((a) => a.name === name);
        const pageErrors = att('page-errors.txt');
        const message = stripAnsi(r.error?.message ?? r.errors?.map((e) => e.message ?? '').join('\n') ?? '');
        out.push({
          test: [file, ...here.filter((s) => s !== spec.file), spec.title].join(' > '),
          file,
          line: spec.line,
          project: t.projectName,
          error: message,
          ...(r.error?.stack ? { stack: stripAnsi(r.error.stack) } : {}),
          ...(resolveAttachment(att('trace')?.path, reportFile)
            ? { tracePath: resolveAttachment(att('trace')?.path, reportFile) }
            : {}),
          ...(resolveAttachment(att('screenshot')?.path, reportFile)
            ? { screenshotPath: resolveAttachment(att('screenshot')?.path, reportFile) }
            : {}),
          ...(r.stdout?.length ? { stdout: r.stdout.map((s) => s.text ?? '').join('') } : {}),
          ...(pageErrors?.body ? { pageErrorsText: Buffer.from(pageErrors.body, 'base64').toString('utf8') } : {}),
          reportStatus: t.status,
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, here);
  };
  for (const s of report.suites) walk(s, []);
  return out;
}

/** Counts passes/failures per test in a report (used by the isolated rerun). */
export function countResults(reportFile: string, file: string, line: number, project: string): { passed: number; failed: number } {
  const report = readJson<JsonReport>(reportFile);
  let passed = 0;
  let failed = 0;
  const walk = (suite: JsonSuite): void => {
    for (const spec of suite.specs ?? []) {
      const abs = isAbsolute(spec.file) ? spec.file : join(report.config.rootDir, spec.file);
      if (relative(process.cwd(), abs) !== file || spec.line !== line) continue;
      for (const t of spec.tests) {
        if (t.projectName !== project) continue;
        for (const r of t.results) {
          if (r.status === 'passed') passed++;
          else if (r.status !== 'skipped') failed++;
        }
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  };
  for (const s of report.suites) walk(s);
  return { passed, failed };
}
