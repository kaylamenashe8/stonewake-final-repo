/**
 * Ranked automation test plan on GitHub (PRD: Recon "Automation test plan").
 *
 *   npm run plan:issues -- [--plan docs/TEST_PLAN.json] [-R owner/repo] [--dry-run]
 *       one issue per item ("[T01] title", labels P1-P3 + layer:*), then the pinned
 *       "Automation Test Plan" issue with a task list in suggested order.
 *   npm run plan:issues -- --sync [-R owner/repo]
 *       ticks lines of closed issues in the pinned list (run after merges; CI can call it).
 *   npm run plan:issues -- --export docs/TEST_PLAN.md [-R owner/repo]
 *       markdown table: item, priority, status, test file, PR (Scribe at 20:10, linked from the STP).
 *
 * Idempotent: an item whose "[id]" issue already exists (open or closed) is skipped. Kayla re-ranks by
 * reordering lines in the pinned issue; re-running keeps her order and only appends new items.
 * Pick-up rule for agents: take the highest unchecked line, open a draft PR whose body says "Closes #<n>".
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { parseArgs } from 'node:util';

type Layer = 'ui' | 'api' | 'auth' | 'visual' | 'a11y';
type Priority = 'P1' | 'P2' | 'P3';

export interface PlanItem {
  id: string;
  title: string;
  layer: Layer;
  risk: 'high' | 'medium' | 'low';
  priority: Priority;
  acceptance?: string;
  requirement?: string;
  notes?: string;
}

interface Issue {
  number: number;
  title: string;
  state: 'OPEN' | 'CLOSED';
  url: string;
  isPinned?: boolean;
  body?: string;
  labels: { name: string }[];
  closedByPullRequestsReferences?: { number: number; url: string }[];
}

const PINNED_TITLE = 'Automation Test Plan';
const LABELS: Record<string, { color: string; description: string }> = {
  P1: { color: 'b60205', description: 'Critical path: the flows the product exists for, auth' },
  P2: { color: 'fbca04', description: 'Validation, negative cases, error states' },
  P3: { color: '0e8a16', description: 'Universal layer, secondary features' },
  'layer:ui': { color: '1d76db', description: 'UI end-to-end' },
  'layer:api': { color: '5319e7', description: 'API test (no browser)' },
  'layer:auth': { color: 'd93f0b', description: 'Authentication checklist' },
  'layer:visual': { color: 'c5def5', description: 'toHaveScreenshot' },
  'layer:a11y': { color: 'bfdadc', description: 'axe-core' },
  'test-plan': { color: 'ededed', description: 'Item of the automation test plan' },
  'skipped-bug': { color: '000000', description: 'Closed: fails on a product bug, skipped with its Spira ID' },
  'not-added': { color: 'cccccc', description: 'Closed: could not reach 10/10, not added' },
};

const { values: args } = parseArgs({
  options: {
    plan: { type: 'string', default: 'docs/TEST_PLAN.json' },
    repo: { type: 'string', short: 'R' },
    'dry-run': { type: 'boolean', default: false },
    sync: { type: 'boolean', default: false },
    export: { type: 'string' },
  },
});

const repoArgs = args.repo ? ['-R', args.repo] : [];
const dry = args['dry-run'];

function gh(cmd: string[], input?: string): string {
  return execFileSync('gh', [...cmd, ...repoArgs], {
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    ...(input ? { input } : {}),
  }).trim();
}

// eslint-disable-next-line @typescript-eslint/no-unnecessary-type-parameters -- typed JSON.parse wrapper
function ghJson<T>(cmd: string[]): T {
  return JSON.parse(gh(cmd) || 'null') as T;
}

const itemTitle = (i: PlanItem): string => `[${i.id}] ${i.title}`;
const idOf = (title: string): string | undefined => /^\[([A-Za-z0-9_-]+)\]/.exec(title)?.[1];
const isPlanItem = (i: Issue): boolean => Boolean(idOf(i.title)) && i.labels.some((l) => l.name === 'test-plan');

function itemBody(i: PlanItem): string {
  return [
    `**Layer:** ${i.layer} · **Risk:** ${i.risk} · **Priority:** ${i.priority}${i.requirement ? ` · **Requirement:** ${i.requirement}` : ''}`,
    '',
    `**Acceptance:** ${i.acceptance ?? 'passes 10/10 locally with `--repeat-each=10 --retries=0` (1 and 4 workers), lint clean, uses page objects and fixtures, asserts a business outcome'}`,
    ...(i.notes ? ['', i.notes] : []),
    '',
    '---',
    'Pick-up rule: the Coverage/API agent takes the highest unchecked item in the pinned **Automation Test Plan**, opens a draft PR with `Closes #<this issue>`, runs 2-3 self-reviews and its own e2e run, then asks for review.',
    'Product bug: close with label `skipped-bug` and the Spira ID. Cannot reach 10/10: close with label `not-added`.',
  ].join('\n');
}

const PRIORITY_ORDER: Record<Priority, number> = { P1: 0, P2: 1, P3: 2 };
const RISK_ORDER = { high: 0, medium: 1, low: 2 } as const;

function ranked(items: PlanItem[]): PlanItem[] {
  return items
    .map((it, idx) => ({ it, idx }))
    .sort(
      (a, b) =>
        PRIORITY_ORDER[a.it.priority] - PRIORITY_ORDER[b.it.priority] ||
        RISK_ORDER[a.it.risk] - RISK_ORDER[b.it.risk] ||
        a.idx - b.idx,
    )
    .map((x) => x.it);
}

function allIssues(): Issue[] {
  return ghJson<Issue[]>([
    'issue',
    'list',
    '--state',
    'all',
    '--limit',
    '500',
    '--json',
    'number,title,state,url,isPinned,body,labels,closedByPullRequestsReferences',
  ]);
}

function ensureLabels(): void {
  const have = new Set(ghJson<{ name: string }[]>(['label', 'list', '--limit', '200', '--json', 'name']).map((l) => l.name));
  for (const [name, l] of Object.entries(LABELS)) {
    if (have.has(name)) continue;
    gh(['label', 'create', name, '--color', l.color, '--description', l.description]);
    console.log(`  label created: ${name}`);
  }
}

function taskLine(n: number, title: string, done: boolean): string {
  return `- [${done ? 'x' : ' '}] #${n} ${title}`;
}

function pinnedBody(lines: string[]): string {
  return [
    'Ranked automation test plan. **Re-rank by reordering lines** (or changing P1/P2/P3 labels); that is the only edit needed.',
    'Agents always take the highest unchecked line. Lines tick when the issue closes (merge with `Closes #n`, then `npm run plan:issues -- --sync`).',
    '',
    '<!-- plan:start -->',
    ...lines,
    '<!-- plan:end -->',
  ].join('\n');
}

function planLines(body: string): string[] {
  const m = /<!-- plan:start -->\n([\s\S]*?)\n?<!-- plan:end -->/.exec(body);
  return (m?.[1] ?? '').split('\n').filter((l) => /^- \[[ x]\] #\d+/.test(l));
}

function createOrUpdatePinned(issues: Issue[], order: { number: number; title: string }[]): void {
  const pinned = issues.find((i) => i.title === PINNED_TITLE && i.state === 'OPEN');
  const closed = new Set(issues.filter((i) => i.state === 'CLOSED').map((i) => i.number));
  const existing = pinned ? planLines(pinned.body ?? '') : [];
  const present = new Set(existing.map((l) => Number(/#(\d+)/.exec(l)?.[1])));
  const lines = [
    ...existing.map((l) => {
      const n = Number(/#(\d+)/.exec(l)?.[1]);
      return l.replace(/^- \[[ x]\]/, `- [${closed.has(n) ? 'x' : ' '}]`);
    }),
    ...order.filter((o) => !present.has(o.number)).map((o) => taskLine(o.number, o.title, closed.has(o.number))),
  ];
  const body = pinnedBody(lines);
  if (dry) {
    console.log(`\n[dry-run] ${pinned ? `update #${pinned.number}` : 'create + pin'} "${PINNED_TITLE}":\n${body}`);
    return;
  }
  if (pinned) {
    gh(['issue', 'edit', String(pinned.number), '--body-file', '-'], body);
    console.log(`updated pinned #${pinned.number}`);
  } else {
    const url = gh(['issue', 'create', '--title', PINNED_TITLE, '--label', 'test-plan', '--body-file', '-'], body);
    const n = /\/issues\/(\d+)/.exec(url)?.[1] ?? '';
    gh(['issue', 'pin', n]);
    console.log(`created and pinned ${url}`);
  }
}

function syncOrCreate(): void {
  const plan = JSON.parse(readFileSync(args.plan, 'utf8')) as { items: PlanItem[] };
  const items = ranked(plan.items);
  if (!dry) console.log(`acting as GitHub user: ${execFileSync('gh', ['api', 'user', '-q', '.login'], { encoding: 'utf8' }).trim()}`);
  const issues = dry ? safeIssues() : allIssues();
  if (!dry) ensureLabels();
  const byId = new Map(issues.filter(isPlanItem).map((i) => [idOf(i.title) ?? '', i]));
  const order: { number: number; title: string }[] = [];
  let fake = 9000;
  for (const it of items) {
    const found = byId.get(it.id);
    if (found) {
      order.push({ number: found.number, title: itemTitle(it) });
      console.log(`  exists #${found.number} ${itemTitle(it)}`);
      continue;
    }
    const labels = [it.priority, `layer:${it.layer}`, 'test-plan'];
    if (dry) {
      fake += 1;
      console.log(`[dry-run] create issue "${itemTitle(it)}" labels=${labels.join(',')}`);
      order.push({ number: fake, title: itemTitle(it) });
      continue;
    }
    const url = gh(['issue', 'create', '--title', itemTitle(it), '--label', labels.join(','), '--body-file', '-'], itemBody(it));
    const n = Number(/\/issues\/(\d+)/.exec(url)?.[1]);
    console.log(`  created #${n} ${itemTitle(it)}`);
    order.push({ number: n, title: itemTitle(it) });
  }
  createOrUpdatePinned(issues, order);
}

/** In --dry-run, read issues if gh/repo are reachable, otherwise plan from scratch. */
function safeIssues(): Issue[] {
  try {
    return args.repo ? allIssues() : [];
  } catch {
    return [];
  }
}

function syncTicks(): void {
  const issues = allIssues();
  createOrUpdatePinned(issues, []);
}

function exportMarkdown(file: string): void {
  const issues = allIssues();
  const pinned = issues.find((i) => i.title === PINNED_TITLE && i.state === 'OPEN');
  const byNumber = new Map(issues.map((i) => [i.number, i]));
  const ordered = pinned
    ? planLines(pinned.body ?? '')
        .map((l) => byNumber.get(Number(/#(\d+)/.exec(l)?.[1])))
        .filter((i): i is Issue => Boolean(i))
    : issues.filter(isPlanItem).sort((a, b) => a.number - b.number);
  const rows = ordered.map((i) => {
    const labels = i.labels.map((l) => l.name);
    const prio = labels.find((l) => /^P[123]$/.test(l)) ?? '-';
    const status =
      i.state === 'OPEN' ? 'open' : labels.includes('skipped-bug') ? 'skipped (product bug)' : labels.includes('not-added') ? 'not added (flaky)' : 'done';
    const pr = i.closedByPullRequestsReferences?.[0];
    let testFile = '-';
    if (pr) {
      try {
        const files = ghJson<{ files: { path: string }[] }>(['pr', 'view', String(pr.number), '--json', 'files']).files;
        testFile = files.map((f) => f.path).find((p) => p.endsWith('.spec.ts')) ?? '-';
      } catch {
        /* PR not readable: leave blank */
      }
    }
    const spira = /SPIRA-\d+/.exec(i.body ?? '')?.[0];
    return `| [${i.title.replace(/\|/g, '/')}](${i.url}) | ${prio} | ${status}${spira ? ` ${spira}` : ''} | ${testFile === '-' ? '-' : `\`${testFile}\``} | ${pr ? `[#${pr.number}](${pr.url})` : '-'} |`;
  });
  const md = [
    '# Automation test plan',
    '',
    `Exported ${new Date().toISOString().slice(0, 16)} UTC from the pinned GitHub issue "${PINNED_TITLE}"${pinned ? ` ([#${pinned.number}](${pinned.url}))` : ''}, in ranked order.`,
    '',
    '| Item | Priority | Status | Test file | PR |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
    '',
  ].join('\n');
  writeFileSync(file, md);
  console.log(`wrote ${file} (${rows.length} items)`);
}

if (args.export) exportMarkdown(args.export);
else if (args.sync) syncTicks();
else syncOrCreate();
