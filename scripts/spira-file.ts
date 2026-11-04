/**
 * File product bugs in SpiraTest through its REST API (PRD: "Automated filing").
 *
 *   npm run spira -- --ping                                  test SPIRA_* credentials (GET projects)
 *   npm run spira -- --template                              print a draft block for docs/BUGS.md
 *   npm run spira -- --from-bugs docs/BUGS.md --id DRAFT-01  draft (default): print the payload, no writes
 *   npm run spira -- --from-bugs docs/BUGS.md --id DRAFT-01 --submit
 *   npm run spira -- --from-triage triage/out/verdicts.json [--test <substring>] [--submit]
 *
 * --submit: duplicate check by name → create incident → upload failure screenshot (artifact type 3 =
 * incident) → write SPIRA-<id> back to docs/BUGS.md → print the knownBug(...) line for the test.
 * CI triage only drafts; filing needs Kayla's one-line approval (--submit run by a human).
 *
 * API (verified against https://api.inflectra.com/spira/services/v6_0/RestService.aspx):
 *   base   ${SPIRA_URL}/services/v${SPIRA_API_VERSION}/RestService.svc   (default 6_0; 5_0 and 4_0 share these routes)
 *   auth   `username` + `api-key` headers (the api-key is the user's RSS token, braces included)
 *   GET  projects/{pid}                                → ProjectTemplateId
 *   GET  project-templates/{tid}/incidents/priorities | severities
 *   GET  projects/{pid}/incidents/search?start_row=1&number_rows=500&sort_by=IncidentId  (duplicate check)
 *   POST projects/{pid}/incidents                      { Name, Description, PriorityId, SeverityId, ... }
 *   POST projects/{pid}/documents/file                 { FilenameOrUrl, BinaryData(base64), AttachmentTypeId: 1,
 *                                                        AttachedArtifacts: [{ ArtifactId, ArtifactTypeId: 3 }] }
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import { parseArgs } from 'node:util';
import type { BugDraft, Verdict } from '../triage/types';

export interface SpiraDraft {
  id: string;
  title: string;
  environment?: string;
  preconditions?: string;
  steps: string[];
  expected: string;
  actual: string;
  severity: BugDraft['severity'];
  priority?: string;
  jam?: string;
  screenshot?: string;
  report?: string;
  linkedTest?: string;
}

const { values: args } = parseArgs({
  options: {
    ping: { type: 'boolean', default: false },
    template: { type: 'boolean', default: false },
    'from-bugs': { type: 'string' },
    id: { type: 'string' },
    'from-triage': { type: 'string' },
    test: { type: 'string' },
    submit: { type: 'boolean', default: false },
    'allow-duplicate': { type: 'boolean', default: false },
  },
});

const TEMPLATE = `### DRAFT-01: <Component>: <symptom>
- Environment: <URL>, Chromium <version>, <date>, commit <sha>
- Preconditions: <state needed>
- Steps:
  1. <step>
  2. <step>
- Expected: <expected result>
- Actual: <actual result>
- Severity: high
- Priority: P2
- Jam: https://jam.dev/c/<id>
- Screenshot: test-results/<test-dir>/test-failed-1.png
- Report: https://<user>.github.io/<repo>/runs/<run_id>/#?testId=<id>
- Linked test: tests/e2e/<feature>/<file>.spec.ts
- Spira: pending
`;

// ---------------------------------------------------------------- parsing

function field(block: string, key: string): string | undefined {
  const m = new RegExp(`^\\s*-\\s*${key}\\s*:\\s*(.+)$`, 'im').exec(block);
  const v = m?.[1]?.trim();
  return v && !/<[a-z_ -]+>/i.test(v) ? v : undefined; // template placeholders count as empty
}

function severityOf(s: string | undefined): BugDraft['severity'] {
  const v = (s ?? '').toLowerCase();
  if (v.includes('crit') || v.startsWith('1')) return 'critical';
  if (v.includes('high') || v.startsWith('2')) return 'high';
  if (v.includes('low') || v.startsWith('4')) return 'low';
  return 'medium';
}

export function parseBugsMd(md: string, id: string): SpiraDraft {
  const re = new RegExp(`^###\\s+${id.replace(/[-]/g, '\\-')}\\s*[:—-]\\s*(.+)$`, 'im');
  const head = re.exec(md);
  if (!head) throw new Error(`No "### ${id}: <title>" draft block in BUGS.md (see --template)`);
  const rest = md.slice(head.index + head[0].length);
  const end = rest.search(/^#{2,3}\s/m);
  const block = end === -1 ? rest : rest.slice(0, end);
  const stepsBlock = /^\s*-\s*Steps\s*:\s*\n((?:\s+\d+\..*\n?)+)/im.exec(block)?.[1] ?? '';
  const steps = stepsBlock
    .split('\n')
    .map((l) => l.replace(/^\s*\d+\.\s*/, '').trim())
    .filter((l) => l && !/<[a-z_ -]+>/i.test(l));
  const draft: SpiraDraft = {
    id,
    title: (head[1] ?? '').trim(),
    steps,
    expected: field(block, 'Expected') ?? '',
    actual: field(block, 'Actual') ?? '',
    severity: severityOf(field(block, 'Severity')),
  };
  const opt: [keyof SpiraDraft, string][] = [
    ['environment', 'Environment'],
    ['preconditions', 'Preconditions'],
    ['priority', 'Priority'],
    ['jam', 'Jam'],
    ['screenshot', 'Screenshot'],
    ['report', 'Report'],
    ['linkedTest', 'Linked test'],
  ];
  for (const [k, label] of opt) {
    const v = field(block, label);
    if (v) (draft as unknown as Record<string, string>)[k] = v;
  }
  return draft;
}

export function draftFromVerdict(v: Verdict, index: number): SpiraDraft {
  if (!v.bug_draft) throw new Error(`Verdict for "${v.test}" has no bug_draft`);
  return {
    id: `TRIAGE-${index + 1}`,
    title: v.bug_draft.title,
    steps: v.bug_draft.steps,
    expected: v.bug_draft.expected,
    actual: v.bug_draft.actual,
    severity: v.bug_draft.severity,
    environment: `${process.env.BASE_URL ?? ''} · Chromium · ${new Date().toISOString().slice(0, 10)} · ${process.env.GITHUB_SHA?.slice(0, 7) ?? 'local'}`,
    linkedTest: v.file,
    ...(v.evidence.find((e) => /\.png$/.test(e)) ? { screenshot: v.evidence.find((e) => /\.png$/.test(e)) } : {}),
  };
}

// ---------------------------------------------------------------- payload

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const link = (u: string): string => `<a href="${esc(u)}">${esc(u)}</a>`;

export function descriptionHtml(d: SpiraDraft): string {
  const parts = [
    d.environment ? `<p><b>Environment:</b> ${esc(d.environment)}</p>` : '',
    d.preconditions ? `<p><b>Preconditions:</b> ${esc(d.preconditions)}</p>` : '',
    `<p><b>Steps to reproduce:</b></p><ol>${d.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`,
    `<p><b>Expected:</b> ${esc(d.expected)}</p>`,
    `<p><b>Actual:</b> ${esc(d.actual)}</p>`,
    '<p><b>Evidence:</b></p><ul>',
    d.jam ? `<li>Jam recording: ${link(d.jam)}</li>` : '',
    d.report ? `<li>Automation report: ${link(d.report)}</li>` : '',
    d.screenshot ? `<li>Failure screenshot: attached (${esc(basename(d.screenshot))})</li>` : '',
    d.linkedTest ? `<li>Linked test: <code>${esc(d.linkedTest)}</code></li>` : '',
    '</ul>',
  ];
  return parts.filter(Boolean).join('\n');
}

// ---------------------------------------------------------------- REST

interface Conn {
  base: string;
  web: string;
  pid: number;
  headers: Record<string, string>;
}

function conn(): Conn {
  const { SPIRA_URL, SPIRA_USER, SPIRA_API_KEY, SPIRA_PROJECT_ID } = process.env;
  const missing = Object.entries({ SPIRA_URL, SPIRA_USER, SPIRA_API_KEY, SPIRA_PROJECT_ID })
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) throw new Error(`Missing ${missing.join(', ')} (set in .env or GitHub secrets)`);
  const web = (SPIRA_URL ?? '').replace(/\/+$/, '');
  const ver = process.env.SPIRA_API_VERSION ?? '6_0';
  return {
    web,
    base: `${web}/services/v${ver}/RestService.svc`,
    pid: Number(SPIRA_PROJECT_ID),
    headers: {
      username: SPIRA_USER ?? '',
      'api-key': SPIRA_API_KEY ?? '',
      'Content-Type': 'application/json',
      accept: 'application/json',
    },
  };
}

async function api<T>(c: Conn, method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${c.base}/${path}`, {
    method,
    headers: c.headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Spira ${method} ${path} -> ${res.status}: ${text.slice(0, 300)}`); // never logs headers
  return (text ? JSON.parse(text) : null) as T;
}

interface Named {
  Name: string;
  PriorityId?: number;
  SeverityId?: number;
}

async function lookupIds(c: Conn, d: SpiraDraft): Promise<{ PriorityId?: number; SeverityId?: number }> {
  if (process.env.SPIRA_SEVERITY_ID || process.env.SPIRA_PRIORITY_ID)
    return {
      ...(process.env.SPIRA_SEVERITY_ID ? { SeverityId: Number(process.env.SPIRA_SEVERITY_ID) } : {}),
      ...(process.env.SPIRA_PRIORITY_ID ? { PriorityId: Number(process.env.SPIRA_PRIORITY_ID) } : {}),
    };
  const project = await api<{ ProjectTemplateId: number }>(c, 'GET', `projects/${c.pid}`);
  const tid = project.ProjectTemplateId;
  const [prios, sevs] = await Promise.all([
    api<Named[]>(c, 'GET', `project-templates/${tid}/incidents/priorities`).catch(() => []),
    api<Named[]>(c, 'GET', `project-templates/${tid}/incidents/severities`).catch(() => []),
  ]);
  // Spira defaults are "1 - Critical", "2 - High", "3 - Medium", "4 - Low" for both lists.
  const pick = (list: Named[], word: string): Named | undefined => list.find((x) => x.Name.toLowerCase().includes(word));
  const prioWord = { P1: 'high', P2: 'medium', P3: 'low' }[d.priority?.toUpperCase() ?? ''] ?? d.severity;
  const sev = pick(sevs, d.severity);
  const pri = pick(prios, prioWord);
  return {
    ...(sev?.SeverityId ? { SeverityId: sev.SeverityId } : {}),
    ...(pri?.PriorityId ? { PriorityId: pri.PriorityId } : {}),
  };
}

// ---------------------------------------------------------------- write-back

function writeBack(file: string, draftId: string, spiraId: string, url: string): void {
  if (!existsSync(file)) return;
  let md = readFileSync(file, 'utf8');
  const head = new RegExp(`^(###\\s+)${draftId}(\\s*[:—-])`, 'm');
  const at = md.search(head);
  if (at !== -1) {
    const bodyStart = md.indexOf('\n', at) === -1 ? md.length : md.indexOf('\n', at) + 1;
    const next = md.slice(bodyStart).search(/^#{2,3}\s/m);
    const end = next === -1 ? md.length : bodyStart + next;
    const block = md
      .slice(at, end)
      .replace(head, `$1${spiraId} (was ${draftId})$2`)
      .replace(/^\s*-\s*Spira\s*:.*$/m, `- Spira: [${spiraId}](${url})`);
    md = md.slice(0, at) + block + md.slice(end);
  }
  // Table rows that mention the draft id get the real id.
  md = md
    .split('\n')
    .map((l) => (l.startsWith('|') && l.includes(draftId) ? l.replace(draftId, `[${spiraId}](${url})`) : l))
    .join('\n');
  writeFileSync(file, md);
}

// ---------------------------------------------------------------- main

async function main(): Promise<void> {
  if (args.template) {
    process.stdout.write(TEMPLATE);
    return;
  }
  if (args.ping) {
    const c = conn();
    const projects = await api<{ ProjectId: number; Name: string }[]>(c, 'GET', 'projects');
    console.log(`Spira OK: ${projects.length} project(s) visible`);
    for (const p of projects) console.log(`  ${p.ProjectId}  ${p.Name}${p.ProjectId === c.pid ? '  <- SPIRA_PROJECT_ID' : ''}`);
    return;
  }

  let draft: SpiraDraft;
  const bugsFile = args['from-bugs'];
  if (bugsFile) {
    if (!args.id) throw new Error('--from-bugs needs --id <draft id>');
    draft = parseBugsMd(readFileSync(bugsFile, 'utf8'), args.id);
  } else if (args['from-triage']) {
    const raw = JSON.parse(readFileSync(args['from-triage'], 'utf8')) as Verdict[] | Verdict;
    const list = (Array.isArray(raw) ? raw : [raw]).filter((v) => v.classification === 'product' && v.bug_draft);
    const idx = args.test ? list.findIndex((v) => v.test.includes(args.test ?? '')) : 0;
    const v = list[idx];
    if (!v) throw new Error(`No product verdict with a bug_draft${args.test ? ` matching "${args.test}"` : ''}`);
    draft = draftFromVerdict(v, idx);
  } else {
    throw new Error('Use --ping, --template, --from-bugs <file> --id <id>, or --from-triage <file>');
  }

  const missing = (['title', 'expected', 'actual'] as const).filter((k) => !draft[k]);
  if (!draft.steps.length) missing.push('steps' as never);
  if (missing.length) throw new Error(`Draft ${draft.id} is missing: ${missing.join(', ')}`);

  const incident = { Name: draft.title, Description: descriptionHtml(draft) };

  if (!args.submit) {
    console.log(`DRAFT (nothing sent). Severity "${draft.severity}", priority "${draft.priority ?? 'from severity'}" resolve to IDs at --submit.`);
    console.log(JSON.stringify({ incident, screenshot: draft.screenshot ?? null, linkedTest: draft.linkedTest ?? null }, null, 2));
    console.log(`\nApprove with: npm run spira -- ${process.argv.slice(2).join(' ')} --submit`);
    return;
  }

  const c = conn();
  if (!args['allow-duplicate']) {
    const existing = await api<{ IncidentId: number; Name: string }[]>(
      c,
      'GET',
      `projects/${c.pid}/incidents/search?start_row=1&number_rows=500&sort_by=IncidentId`,
    );
    const dup = existing.find((i) => i.Name.trim().toLowerCase() === draft.title.trim().toLowerCase());
    if (dup) {
      console.log(`Duplicate: SPIRA-${dup.IncidentId} "${dup.Name}" already exists. Nothing filed (--allow-duplicate to override).`);
      return;
    }
  }

  const ids = await lookupIds(c, draft);
  const created = await api<{ IncidentId: number }>(c, 'POST', `projects/${c.pid}/incidents`, { ...incident, ...ids });
  const spiraId = `SPIRA-${created.IncidentId}`;
  const url = `${c.web}/${c.pid}/Incident/${created.IncidentId}.aspx`;
  console.log(`Filed ${spiraId}: ${url}`);

  if (draft.screenshot && existsSync(draft.screenshot)) {
    await api(c, 'POST', `projects/${c.pid}/documents/file`, {
      FilenameOrUrl: basename(draft.screenshot),
      Description: `Automation failure screenshot (${draft.linkedTest ?? 'test'})`,
      BinaryData: readFileSync(draft.screenshot).toString('base64'),
      AttachmentTypeId: 1,
      AttachedArtifacts: [{ ArtifactId: created.IncidentId, ArtifactTypeId: 3 }],
    });
    console.log(`Attached ${basename(draft.screenshot)}`);
  } else if (draft.screenshot) {
    console.log(`Screenshot not found locally (${draft.screenshot}); attach it manually.`);
  }

  if (bugsFile) writeBack(bugsFile, draft.id, spiraId, url);
  console.log(`\nPaste as the first line of the test${draft.linkedTest ? ` in ${draft.linkedTest}` : ''}:`);
  console.log(`  knownBug('${spiraId}', '${draft.title.replace(/'/g, "\\'")}', '${url}');`);
}

main().catch((e: unknown) => {
  console.error((e as Error).message);
  process.exit(1);
});
