/**
 * Slack notifications via Incoming Webhook (D10). Exits 0 silently when SLACK_WEBHOOK_URL is missing,
 * and never fails the job on a Slack error.
 *
 *   tsx scripts/slack-notify.ts run    --results test-results/results.json --heals test-results/heal-report.json --report-url <url>
 *   tsx scripts/slack-notify.ts gate   --dir gate-results --runs 5 --report-url <url>
 *   tsx scripts/slack-notify.ts triage --verdicts triage/out/verdicts.json
 */
import { arg, fmtDuration, readVerdicts, summarize, type Verdict } from './run-summary';
import { computeGate } from './gate-summary';

type Block = Record<string, unknown>;

const ctx = {
  repo: process.env.GITHUB_REPOSITORY ?? 'local',
  branch: process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || 'local',
  sha: (process.env.GITHUB_SHA ?? '').slice(0, 7),
  runUrl: process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL ?? 'https://github.com'}/${process.env.GITHUB_REPOSITORY ?? ''}/actions/runs/${process.env.GITHUB_RUN_ID}`
    : undefined,
};

const section = (text: string): Block => ({ type: 'section', text: { type: 'mrkdwn', text } });
const context = (text: string): Block => ({ type: 'context', elements: [{ type: 'mrkdwn', text }] });
const link = (url: string | undefined, label: string): string => (url ? `<${url}|${label}>` : '');
const links = (reportUrl?: string): string =>
  [link(reportUrl, 'Report'), link(ctx.runUrl, 'Actions run')].filter(Boolean).join(' · ');

function verdictLine(v: Verdict): string {
  const icon = v.classification === 'product' ? ':rotating_light:' : '•';
  const label = v.classification === 'product' ? '*PRODUCT*' : v.classification;
  return `${icon} ${label} (${v.confidence.toFixed(2)}) — ${v.test}\n    _${v.root_cause.slice(0, 180)}_`;
}

function topFailures(failures: { test: string; error: string }[], verdicts: Verdict[]): string {
  return failures
    .slice(0, 3)
    .map((f) => {
      const v = verdicts.find((x) => f.test.includes(x.test) || x.test.includes(f.test));
      return v ? verdictLine(v) : `• ${f.test}\n    _${f.error.slice(0, 160)}_`;
    })
    .join('\n');
}

export function buildRun(): { text: string; blocks: Block[] } {
  const sum = summarize(arg('results', 'test-results/results.json') ?? '', arg('heals', 'test-results/heal-report.json'));
  const reportUrl = arg('report-url');
  if (!sum) return { text: 'CI run: no results', blocks: [section(`:warning: *CI run* — no results found. ${links(reportUrl)}`)] };
  const ok = sum.failed === 0;
  const head = `${ok ? ':white_check_mark:' : ':x:'} *CI ${ok ? 'passed' : 'failed'}* — \`${ctx.branch}\` @ \`${ctx.sha}\``;
  const counts = `*${sum.passed}* passed · *${sum.failed}* failed · *${sum.flaky}* flaky · *${sum.healed}* healed · ${sum.skipped} skipped · ${fmtDuration(sum.durationMs)}`;
  const blocks: Block[] = [section(`${head}\n${counts}`)];
  if (sum.failures.length) blocks.push(section(`*Top failures*\n${topFailures(sum.failures, readVerdicts())}`));
  blocks.push(context(`${ctx.repo} · ${links(reportUrl)}`));
  return { text: `CI ${ok ? 'passed' : 'failed'}: ${sum.passed} passed, ${sum.failed} failed`, blocks };
}

export function buildGate(): { text: string; blocks: Block[] } {
  const gate = computeGate(arg('dir', 'gate-results') ?? 'gate-results', Number(arg('runs', '5')));
  const reportUrl = arg('report-url');
  const rows = gate.rows
    .map((r) =>
      r.missing
        ? `run-${r.run}: :x: no results`
        : `run-${r.run}: ${r.green ? ':white_check_mark:' : ':x:'} ${r.passed ?? 0} passed, ${r.failed ?? 0} failed, ${r.healed ?? 0} healed, ${fmtDuration(r.durationMs ?? 0)}`,
    )
    .join('\n');
  return {
    text: gate.verdict,
    blocks: [
      section(`${gate.green ? ':large_green_circle:' : ':red_circle:'} *${gate.verdict}* — \`${ctx.branch}\` @ \`${ctx.sha}\``),
      section(rows),
      context(`${ctx.repo} · retries 0 · HEAL_MODE=strict · ${links(reportUrl)}`),
    ],
  };
}

export function buildTriage(): { text: string; blocks: Block[] } {
  const verdicts = readVerdicts(arg('verdicts', 'triage/out/verdicts.json'));
  const product = verdicts.filter((v) => v.classification === 'product').length;
  const sorted = [...verdicts].sort(
    (a, b) => Number(b.classification === 'product') - Number(a.classification === 'product') || b.confidence - a.confidence,
  );
  return {
    text: `Triage: ${verdicts.length} failures, ${product} product`,
    blocks: [
      section(`:mag: *Triage* — ${verdicts.length} failure(s), *${product} product*`),
      ...(sorted.length ? [section(sorted.slice(0, 3).map(verdictLine).join('\n'))] : []),
      context(`${ctx.repo} · ${links(arg('report-url'))}`),
    ],
  };
}

async function main(): Promise<void> {
  const mode = process.argv[2] ?? 'run';
  const payload = mode === 'gate' ? buildGate() : mode === 'triage' ? buildTriage() : buildRun();
  const webhook = process.env.SLACK_WEBHOOK_URL;
  if (!webhook) {
    console.log(`SLACK_WEBHOOK_URL not set — skipping Slack (${mode}): ${payload.text}`);
    if (process.argv.includes('--print')) console.log(JSON.stringify(payload, null, 2));
    return;
  }
  try {
    const res = await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    console.log(res.ok ? `Slack ${mode} message sent` : `Slack responded ${res.status} — not failing the job`);
  } catch (e) {
    console.log(`Slack error (ignored): ${(e as Error).message}`);
  }
}

void main();
