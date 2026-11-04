import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { BugDraft, Verdict } from './types';
import type { FailedTestEx } from './report';
import { parseReport } from './report';
import { rerunIsolated } from './rerun';
import { FINAL_CONFIDENCE, classify, evidenceFor } from './classifier';
import { MAX_FAILURES as CRAWL_MAX, crawlerDiagnose, type CrawlEvidence } from './crawler-diagnose';
import { MAX_FAILURES as CLAUDE_MAX, claudeDiagnose, hasKey, writeContextPacks, type UndecidedItem } from './claude-diagnose';
import { OUT_DIR, appendStepSummary, findFiles, isMain, readJson, setOutput, slug, writeJson, writeText } from './util';

/**
 * The diagnosis ladder (D4): isolated rerun → rule classifier → crawler → Claude.
 * Each rung runs only for failures the rung below left undecided. Triage never fails the pipeline.
 *
 *   tsx triage/ladder.ts [--reports <dir|file>] [--max 10] [--no-rerun] [--no-crawler] [--no-claude]
 *   tsx triage/ladder.ts --merge-claude      (after claude-code-action wrote triage/out/claude-verdicts.json)
 */
const CRAWLER_FINAL = 0.7;

interface Options {
  reports: string;
  max: number;
  maxRerun: number;
  rerun: boolean;
  crawler: boolean;
  claude: boolean;
  mergeClaude: boolean;
}

function parseArgs(argv: string[]): Options {
  const val = (flag: string, def: string): string => {
    const i = argv.indexOf(flag);
    return i >= 0 ? (argv[i + 1] ?? def) : def;
  };
  return {
    reports: val('--reports', 'test-results'),
    max: Number(val('--max', '10')),
    maxRerun: Number(val('--max-rerun', '5')),
    rerun: !argv.includes('--no-rerun'),
    crawler: !argv.includes('--no-crawler'),
    claude: !argv.includes('--no-claude'),
    mergeClaude: argv.includes('--merge-claude'),
  };
}

function dedupe(failed: FailedTestEx[]): FailedTestEx[] {
  const seen = new Set<string>();
  return failed.filter((f) => {
    const k = `${f.project}|${f.file}:${f.line}|${f.test}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

const flakyVerdict = (f: FailedTestEx, passed: number, failed: number, how: string): Verdict => ({
  test: f.test,
  file: f.file,
  line: f.line,
  project: f.project,
  rung: 'rerun',
  classification: 'flaky',
  confidence: 0.9,
  signature: how,
  root_cause: `Flaky: ${how}. Goes to the Stabilizer queue, never a bug.`,
  evidence: [`error: ${f.error.split('\n')[0] ?? ''}`, `passes ${passed} / fails ${failed}`],
  rerun: { passed, failed },
});

function bugDraftFor(v: Verdict, f: FailedTestEx | undefined): BugDraft {
  if (v.bug_draft) return v.bug_draft;
  const title = (f?.test.split(' > ').pop() ?? v.test).replace(/^should /, '');
  return {
    title: `${v.file.split('/').pop()?.replace(/\.spec\.ts$/, '') ?? 'app'}: ${v.signature ?? 'unexpected behaviour'} (${title})`,
    steps: [`Run ${v.file}:${v.line ?? 0} (${v.project ?? 'chromium'})`, 'See the failing step in the trace'],
    expected: 'The flow completes as the test describes',
    actual: (f?.error.split('\n')[0] ?? v.root_cause).slice(0, 300),
    severity: 'medium',
  };
}

function writeOutputs(verdicts: Verdict[], failed: FailedTestEx[]): void {
  const byTest = new Map(failed.map((f) => [`${f.project}|${f.test}`, f]));
  const find = (v: Verdict): FailedTestEx | undefined => byTest.get(`${v.project ?? ''}|${v.test}`);
  writeJson(join(OUT_DIR, 'verdicts.json'), verdicts);

  // Product → bug drafts for scripts/spira-file.ts (CI only drafts; Kayla approves --submit).
  const bugs = verdicts
    .filter((v) => v.classification === 'product')
    .map((v) => {
      const f = find(v);
      return {
        ...bugDraftFor(v, f),
        test: v.test,
        file: v.file,
        line: v.line,
        project: v.project,
        confidence: v.confidence,
        evidence: v.evidence,
        ...(f?.screenshotPath ? { screenshot: f.screenshotPath } : {}),
        ...(process.env.REPORT_URL ? { report: process.env.REPORT_URL } : {}),
      };
    });
  writeJson(join(OUT_DIR, 'bug-drafts.json'), bugs);

  // Automation with confidence ≥ 0.8 → candidate ai-fix PR (opened by Claude in CI, reviewed by the Lead).
  const fixPrs = verdicts
    .filter((v) => v.classification === 'automation' && v.confidence >= FINAL_CONFIDENCE && v.proposed_fix)
    .map((v) => ({
      test: v.test,
      branch: `ai-fix/${slug(v.test.split(' > ').pop() ?? v.test, 40)}`,
      confidence: v.confidence,
      proposed_fix: v.proposed_fix,
      open_fix_pr: true,
    }));
  writeJson(join(OUT_DIR, 'actions.json'), { fixPrs, bugDrafts: bugs.length });

  // Flaky + automation → Stabilizer queue with the cause category.
  const queue = verdicts.filter((v) => v.classification === 'flaky' || v.classification === 'automation');
  writeText(
    join(OUT_DIR, 'stabilizer-queue.md'),
    [
      '# Stabilizer queue (from triage)',
      '',
      ...queue.map(
        (v) =>
          `- [ ] **${v.classification}** \`${v.file}:${v.line ?? 0}\` ${v.test.split(' > ').pop() ?? ''}\n  - cause: ${v.signature ?? v.root_cause}${v.proposed_fix ? `\n  - proposal: ${v.proposed_fix.split('\n')[0] ?? ''}` : ''}`,
      ),
      '',
    ].join('\n'),
  );

  const counts = (c: string): number => verdicts.filter((v) => v.classification === c).length;
  const cell = (s: string): string => s.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 160);
  const md = [
    '## Triage verdicts',
    '',
    `${verdicts.length} failure(s): ${counts('product')} product, ${counts('automation')} automation, ${counts('flaky')} flaky, ${counts('environment')} environment, ${counts('undecided')} undecided.`,
    '',
    '| Test | Verdict | Confidence | Rung | Root cause |',
    '| --- | --- | --- | --- | --- |',
    ...verdicts.map((v) => {
      const name = cell(v.test.split(' > ').slice(-1)[0] ?? v.test);
      const verdict = v.classification === 'product' ? '**PRODUCT**' : v.classification;
      return `| ${name} | ${verdict} | ${v.confidence.toFixed(2)} | ${v.rung} | ${cell(v.root_cause)} |`;
    }),
    '',
    fixPrs.length ? `Fix PR candidates: ${fixPrs.map((p) => `\`${p.branch}\``).join(', ')}` : '',
    bugs.length ? `Bug drafts for Spira: ${bugs.length} (triage/out/bug-drafts.json — run \`npm run spira\` to review)` : '',
  ]
    .filter((l, i, a) => l || a[i - 1])
    .join('\n');
  writeText(join(OUT_DIR, 'summary.md'), md);
  appendStepSummary(md);
  setOutput('failures', verdicts.length);
  setOutput('product', counts('product'));
  setOutput('undecided', counts('undecided'));
  console.log(md);
}

export async function runLadder(opts: Options): Promise<Verdict[]> {
  const reports = findFiles(opts.reports, 'results.json');
  if (!reports.length) {
    console.log(`No results.json under ${opts.reports}: nothing to triage.`);
    writeOutputs([], []);
    return [];
  }
  const all = dedupe(reports.flatMap(parseReport));
  // Passed on CI retry: flaky without spending a rerun.
  const verdicts: Verdict[] = all
    .filter((f) => f.reportStatus === 'flaky')
    .map((f) => flakyVerdict(f, 1, 1, 'passed on retry in CI'));
  const failed = all.filter((f) => f.reportStatus === 'unexpected').slice(0, opts.max);
  writeJson(join(OUT_DIR, 'failed.json'), failed);
  console.log(`Triage: ${failed.length} failure(s), ${verdicts.length} flaky-by-retry, from ${reports.length} report(s).`);

  const undecided: { f: FailedTestEx; prior: Verdict; next: 'crawler' | 'claude' }[] = [];
  for (const [i, orig] of failed.entries()) {
    let f = orig;
    // Rung 1: isolated rerun.
    let rerun: { passed: number; failed: number } | undefined;
    if (opts.rerun && i < opts.maxRerun) {
      const r = rerunIsolated(f);
      if (r.passed + r.failed > 0) rerun = { passed: r.passed, failed: r.failed };
      if (r.passed > 0) {
        verdicts.push(flakyVerdict(f, r.passed, r.failed, `isolated rerun passed ${r.passed}/${r.passed + r.failed}`));
        continue;
      }
      // Merged CI reports often lose attachment paths: use the rerun's fresh trace and screenshot.
      const fresh = r.freshFailure;
      if (fresh) {
        f = {
          ...f,
          ...(!f.tracePath && fresh.tracePath ? { tracePath: fresh.tracePath } : {}),
          ...(!f.screenshotPath && fresh.screenshotPath ? { screenshotPath: fresh.screenshotPath } : {}),
          ...(!f.pageErrorsText && fresh.pageErrorsText ? { pageErrorsText: fresh.pageErrorsText } : {}),
        };
      }
    }
    // Rung 2: rule classifier.
    const c = classify(f, evidenceFor(f, rerun));
    const v: Verdict = { ...c.verdict, ...(rerun ? { rerun } : {}) };
    if (c.next === 'stop' || (v.classification !== 'undecided' && v.confidence >= FINAL_CONFIDENCE)) {
      verdicts.push(v);
    } else {
      undecided.push({ f, prior: v, next: c.next === 'claude' ? 'claude' : 'crawler' });
    }
    failed[i] = f;
  }

  // Rung 3: crawler (max 3 failures, 3 minutes each).
  const forClaude: UndecidedItem[] = [];
  let crawled = 0;
  for (const u of undecided) {
    let crawl: CrawlEvidence | undefined;
    if (opts.crawler && u.next === 'crawler' && crawled < CRAWL_MAX) {
      crawled++;
      crawl = await crawlerDiagnose(u.f);
      const cv = { ...crawl.verdict, ...(u.prior.rerun ? { rerun: u.prior.rerun } : {}) };
      if (cv.classification !== 'undecided' && cv.confidence >= CRAWLER_FINAL) {
        verdicts.push({ ...cv, evidence: [...u.prior.evidence, ...cv.evidence], signature: u.prior.signature ?? '' });
        continue;
      }
    }
    forClaude.push({ failed: u.f, prior: u.prior, ...(crawl ? { crawl } : {}) });
  }
  const crawlEvidence = forClaude.flatMap((x) => (x.crawl ? [x.crawl] : []));
  if (crawled) writeJson(join(OUT_DIR, 'crawl-evidence.json'), crawlEvidence);

  // Rung 4: Claude (max 3). In CI, claude-code-action does this from undecided.json + context packs.
  writeJson(join(OUT_DIR, 'undecided.json'), forClaude);
  setOutput('for_claude', Math.min(forClaude.length, CLAUDE_MAX));
  writeContextPacks(forClaude);
  let asked = 0;
  for (const item of forClaude) {
    let v: Verdict | null = null;
    if (opts.claude && hasKey() && asked < CLAUDE_MAX) {
      asked++;
      v = await claudeDiagnose(item).catch(() => null);
    }
    if (v) {
      verdicts.push(v);
      continue;
    }
    const last = item.crawl?.verdict ?? item.prior;
    if (!last) continue;
    const note = opts.claude && !hasKey() ? ' (Claude rung skipped: no ANTHROPIC_API_KEY)' : '';
    // Best available guess stays, with its (low) confidence; the summary shows it as tentative.
    verdicts.push({ ...last, root_cause: `${last.root_cause}${note}` });
  }
  writeOutputs(verdicts, failed);
  return verdicts;
}

/** Folds Claude's verdicts (from claude-code-action or the API fallback) into verdicts.json. */
export function mergeClaude(): Verdict[] {
  const vFile = join(OUT_DIR, 'verdicts.json');
  const cFile = join(OUT_DIR, 'claude-verdicts.json');
  const verdicts = existsSync(vFile) ? readJson<Verdict[]>(vFile) : [];
  const claude = existsSync(cFile) ? readJson<Verdict[]>(cFile) : [];
  const failed = existsSync(join(OUT_DIR, 'failed.json')) ? readJson<FailedTestEx[]>(join(OUT_DIR, 'failed.json')) : [];
  const merged = verdicts.map((v) => {
    // Claude only ever sees the items the lower rungs left undecided (undecided.json).
    const c = claude.find((x) => x.test === v.test && (x.project ?? v.project) === v.project);
    return c ? { ...c, rung: 'claude' as const, evidence: [...v.evidence, ...c.evidence] } : v;
  });
  writeOutputs(merged, failed);
  return merged;
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.mergeClaude) mergeClaude();
  else await runLadder(opts);
}

if (isMain(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error('Triage ladder error:', e instanceof Error ? e.message : e);
    process.exit(0);
  });
}
