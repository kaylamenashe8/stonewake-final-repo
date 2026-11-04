import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import Anthropic from '@anthropic-ai/sdk';
import type { Classification, Verdict } from './types';
import type { FailedTestEx } from './report';
import type { CrawlEvidence } from './crawler-diagnose';
import { readTrace } from './trace';
import { OUT_DIR, isMain, readJson, truncate, writeJson, writeText, slug } from './util';

/**
 * Rung 4 (last resort, D4/D6/D7): Claude reads a context pack and returns a strict JSON verdict.
 * It only diagnoses and proposes. It never pushes. Skips cleanly without ANTHROPIC_API_KEY.
 */
export const MAX_FAILURES = 3;
export const TIMEOUT_MS = 5 * 60_000;
export const MODEL = process.env.CLAUDE_MODEL ?? 'claude-sonnet-5-5';

export interface ContextPack {
  test: string;
  text: string;
  screenshotBase64?: string;
}

export interface UndecidedItem {
  failed: FailedTestEx;
  crawl?: CrawlEvidence;
  prior?: Verdict;
}

function readIf(file: string, max = 8_000): string {
  return existsSync(file) ? truncate(readFileSync(file, 'utf8'), max) : '';
}

/** Page objects and components the spec imports (one level deep). */
function importedSources(specFile: string): { file: string; src: string }[] {
  if (!existsSync(specFile)) return [];
  const src = readFileSync(specFile, 'utf8');
  const out: { file: string; src: string }[] = [];
  for (const m of src.matchAll(/from\s+['"](\.{1,2}\/[^'"]+)['"]/g)) {
    const rel = m[1];
    if (!rel) continue;
    const base = resolve(dirname(specFile), rel);
    const file = [base, `${base}.ts`, join(base, 'index.ts')].find((f) => existsSync(f) && f.endsWith('.ts'));
    if (file && /src\/(pages|components|api|fixtures)/.test(file)) out.push({ file, src: readIf(file, 6_000) });
    if (out.length >= 4) break;
  }
  return out;
}

function gitDiff(): string {
  const sha = process.env.LAST_GREEN_SHA;
  if (!sha || !/^[0-9a-f]{7,40}$/i.test(sha)) return '';
  try {
    return truncate(execFileSync('git', ['diff', `${sha}..HEAD`, '--', 'src', 'tests'], { encoding: 'utf8' }), 12_000);
  } catch {
    return '';
  }
}

export function buildContextPack(item: UndecidedItem): ContextPack {
  const f = item.failed;
  const trace = readTrace(f.tracePath);
  const actions = trace.actions
    .slice(-50)
    .map((a) => `${a.method} ${JSON.stringify(a.params).slice(0, 200)}${a.error ? `  !! ${a.error}` : ''}`);
  const failedNet = trace.network
    .filter((n) => n.status >= 400 || n.status < 0)
    .slice(0, 30)
    .map((n) => `${n.status} ${n.method} ${n.url}`);
  const sections: [string, string][] = [
    ['Failing test', `${f.test}\nfile: ${f.file}:${f.line}  project: ${f.project}`],
    ['Error', truncate(f.stack ?? f.error, 6_000)],
    ['Test source', readIf(f.file)],
    ...importedSources(f.file).map((s): [string, string] => [`Imported: ${s.file}`, s.src]),
    ['Last 50 trace actions', actions.join('\n')],
    ['Failed network calls', failedNet.join('\n')],
    ['Console errors', [...trace.consoleErrors, ...(f.pageErrorsText ? [f.pageErrorsText] : [])].join('\n')],
    ['Page errors', trace.pageErrors.join('\n')],
    ['Aria snapshot at failure (crawler reopen)', item.crawl?.ariaSnapshot ?? ''],
    ['Crawler evidence', item.crawl ? JSON.stringify({ ...item.crawl, ariaSnapshot: undefined }, null, 2) : ''],
    ['Earlier rungs', item.prior ? `${item.prior.rung}: ${item.prior.root_cause} (${item.prior.signature ?? ''})` : ''],
    ['git diff since last green', gitDiff()],
  ];
  const text = sections
    .filter(([, body]) => body.trim())
    .map(([h, body]) => `## ${h}\n\`\`\`\n${body}\n\`\`\``)
    .join('\n\n');
  const shot = f.screenshotPath ?? item.crawl?.screenshot;
  return {
    test: f.test,
    text,
    ...(shot && existsSync(shot) ? { screenshotBase64: readFileSync(shot).toString('base64') } : {}),
  };
}

const SYSTEM = `You are the last rung of a Playwright failure triage ladder. Cheaper rungs (isolated rerun,
rule classifier, crawler) could not decide. Classify the failure as exactly one of:
- flaky: passes sometimes; timing, ordering or shared-state issue in the test.
- automation: the test or framework is wrong (selector, missing step, wrong expectation, data setup).
- product: the application misbehaves (wrong value, error, missing feature) — a real bug to file.
- environment: the product or network was unavailable or rate limited.
Be honest about confidence (0-1). Ground every claim in the evidence given; cite it in evidence[].
proposed_fix: a unified diff against the repo files shown (automation/flaky), or "" if none.
bug_draft: required when classification is product, otherwise omit. Never suggest raising retries or
adding waitForTimeout. Answer only by calling submit_verdict.`;

const VERDICT_TOOL = {
  name: 'submit_verdict',
  description: 'Submit the single triage verdict for this failure.',
  input_schema: {
    type: 'object' as const,
    required: ['classification', 'confidence', 'root_cause', 'evidence'],
    properties: {
      classification: { type: 'string', enum: ['flaky', 'automation', 'product', 'environment'] },
      confidence: { type: 'number', minimum: 0, maximum: 1 },
      root_cause: { type: 'string' },
      evidence: { type: 'array', items: { type: 'string' } },
      proposed_fix: { type: 'string', description: 'unified diff, or empty' },
      bug_draft: {
        type: 'object',
        required: ['title', 'steps', 'expected', 'actual', 'severity'],
        properties: {
          title: { type: 'string', description: 'component: symptom' },
          steps: { type: 'array', items: { type: 'string' } },
          expected: { type: 'string' },
          actual: { type: 'string' },
          severity: { type: 'string', enum: ['critical', 'high', 'medium', 'low'] },
        },
      },
    },
  },
};

interface ToolInput {
  classification: Classification;
  confidence: number;
  root_cause: string;
  evidence: string[];
  proposed_fix?: string;
  bug_draft?: Verdict['bug_draft'];
}

export function hasKey(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function claudeDiagnose(item: UndecidedItem, client?: Anthropic): Promise<Verdict | null> {
  if (!hasKey()) return null;
  const c = client ?? new Anthropic({ timeout: TIMEOUT_MS, maxRetries: 1 });
  const pack = buildContextPack(item);
  writeText(join(OUT_DIR, 'context', `${slug(item.failed.test)}.md`), pack.text);
  const content: Anthropic.ContentBlockParam[] = [{ type: 'text', text: pack.text }];
  if (pack.screenshotBase64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/png', data: pack.screenshotBase64 } });
  }
  const res = await c.messages.create({
    model: MODEL,
    max_tokens: 4_096,
    system: SYSTEM,
    tools: [VERDICT_TOOL],
    tool_choice: { type: 'tool', name: VERDICT_TOOL.name },
    messages: [{ role: 'user', content }],
  });
  const block = res.content.find((b) => b.type === 'tool_use');
  if (!block) return null;
  const input = block.input as ToolInput;
  const f = item.failed;
  return {
    test: f.test,
    file: f.file,
    line: f.line,
    project: f.project,
    rung: 'claude',
    classification: input.classification,
    confidence: Math.max(0, Math.min(1, input.confidence)),
    root_cause: input.root_cause,
    evidence: input.evidence,
    ...(input.proposed_fix ? { proposed_fix: input.proposed_fix } : {}),
    ...(input.classification === 'product' && input.bug_draft ? { bug_draft: input.bug_draft } : {}),
  };
}

/** Writes the text packs so claude-code-action (CI rung 4) can read them without an API call here. */
export function writeContextPacks(items: UndecidedItem[]): string[] {
  return items.slice(0, MAX_FAILURES).map((item) => {
    const file = join(OUT_DIR, 'context', `${slug(item.failed.test)}.md`);
    writeText(file, buildContextPack(item).text);
    return file;
  });
}

/* CLI (direct-API fallback): tsx triage/claude-diagnose.ts [--from triage/out/undecided.json] */
async function main(): Promise<void> {
  const fromIdx = process.argv.indexOf('--from');
  const from = fromIdx > 0 ? (process.argv[fromIdx + 1] ?? '') : join(OUT_DIR, 'undecided.json');
  if (!hasKey()) {
    console.log('ANTHROPIC_API_KEY not set: Claude rung skipped.');
    return;
  }
  if (!existsSync(from)) {
    console.log(`Nothing to diagnose (${from} not found).`);
    return;
  }
  const items = readJson<UndecidedItem[]>(from).slice(0, MAX_FAILURES);
  const verdicts: Verdict[] = [];
  for (const item of items) {
    try {
      const v = await claudeDiagnose(item);
      if (v) {
        verdicts.push(v);
        console.log(`${v.classification} (${v.confidence.toFixed(2)})  ${v.test}`);
      }
    } catch (e) {
      // Never print request details: they could include headers.
      const why = e instanceof Anthropic.APIError ? `HTTP ${String(e.status)} ${e.name}` : e instanceof Error ? e.name : 'error';
      console.log(`Claude diagnose failed for ${item.failed.test}: ${why}`);
    }
  }
  writeJson(join(OUT_DIR, 'claude-verdicts.json'), verdicts);
}

if (isMain(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(0); // triage never fails the pipeline
  });
}
