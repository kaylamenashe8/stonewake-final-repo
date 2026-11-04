#!/usr/bin/env node
// ITAC Control Center: local dashboard for the Lead (PRD "Control Center").
// Plain Node >= 22, built-ins only. Binds 127.0.0.1. `npm run control-center` -> http://localhost:4000
//
// Data: .agents/status/*.json (agents), gh (PRs, runs, issues), docs/BUGS.md (bugs), docs/TIMELINE.md (clock).
// Every gh call runs WITHOUT GITHUB_TOKEN / GH_TOKEN in env, so gh uses the personal login from hosts.yml.
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { readFileSync, readdirSync, existsSync, writeFileSync, appendFileSync, mkdirSync, statSync } from 'node:fs';
import { join, dirname, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessions as readSessions, gaps as findGaps } from './gaps.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = process.env.REPO_ROOT ?? join(HERE, '..');
const PORT = Number(process.env.PORT ?? 4000);
const HOST = '127.0.0.1';
const STATUS_DIR = join(ROOT, '.agents', 'status');
const INBOX_DIR = join(ROOT, '.agents', 'inbox');
const MERGE_ORDER = ['architect', 'stabilizer', 'ci-infra', 'coverage', 'visual-bonus', 'triage'];
const STALE_MS = 10 * 60 * 1000;
const CACHE_MS = 20 * 1000;
const STATES = ['working', 'blocked', 'review', 'done', 'paused'];

// ---------- process helpers ----------
function cleanEnv() {
  const env = { ...process.env };
  delete env.GITHUB_TOKEN;
  delete env.GH_TOKEN;
  return env;
}

function run(cmd, args, { timeout = 30_000 } = {}) {
  return new Promise((resolve, reject) => {
    execFile(cmd, args, { cwd: ROOT, env: cleanEnv(), timeout, maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || '').toString().trim().split('\n').slice(-3).join(' ');
        reject(new Error(`${cmd} ${args.slice(0, 3).join(' ')}: ${msg}`));
      } else resolve(stdout.toString());
    });
  });
}

let repoCache = null;
async function repo() {
  if (process.env.REPO) return process.env.REPO;
  if (repoCache) return repoCache;
  const out = await run('gh', ['repo', 'view', '--json', 'nameWithOwner', '-q', '.nameWithOwner'], { timeout: 15_000 });
  repoCache = out.trim();
  return repoCache;
}

/** GitHub's refusal to review your own PR (wording varies by API). */
const OWN_PR = /own pull request|Review cannot be requested from pull request author|Can not (approve|request changes on) your own/i;

const cache = new Map();
async function gh(args, { json = true, fresh = false } = {}) {
  const r = await repo();
  const full = [...args, '-R', r];
  const key = full.join('\u0000');
  const hit = cache.get(key);
  if (!fresh && hit && Date.now() - hit.at < CACHE_MS) return hit.value;
  const out = await run('gh', full);
  const value = json ? JSON.parse(out || 'null') : out;
  cache.set(key, { at: Date.now(), value });
  return value;
}
const invalidate = () => cache.clear();

// ---------- parsing ----------
const readText = (p) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
const hm = (d) => {
  const x = new Date(d);
  return Number.isNaN(x.getTime()) ? '' : `${String(x.getHours()).padStart(2, '0')}:${String(x.getMinutes()).padStart(2, '0')}`;
};
const agentKind = (id) => String(id ?? '').replace(/-\d+$/, '');
const title = (id) =>
  String(id)
    .split('-')
    .map((w) => (/^\d+$/.test(w) ? w : w === 'ci' ? 'CI' : w === 'api' ? 'API' : w[0].toUpperCase() + w.slice(1)))
    .join(' ')
    .replace('CI Infra', 'CI/Infra')
    .replace('Visual Bonus', 'Visual/Bonus');

/** "Owns (write)" row of .claude/agents/<kind>.md -> { allow: [prefix], except: [prefix] } */
const ownCache = new Map();
function ownedPaths(kind) {
  if (ownCache.has(kind)) return ownCache.get(kind);
  const md = readText(join(ROOT, '.claude', 'agents', `${kind}.md`));
  const row = /\|\s*Owns \(write\)\s*\|\s*([^|\n]+)\|/.exec(md)?.[1] ?? '';
  const except = [];
  const cleaned = row.replace(/\(([^)]*)\)/g, (_, inner) => {
    const m = /except\s+(.+)/i.exec(inner);
    if (m) for (const e of m[1].split(/,|\band\b/)) if (e.trim()) except.push(e.trim());
    return '';
  });
  const allow = cleaned
    .split(',')
    .map((s) => s.trim().replace(/`/g, '').replace(/<[^>]+>\/?/g, ''))
    .filter(Boolean);
  const res = { allow, except };
  ownCache.set(kind, res);
  return res;
}
function outsideOwned(kind, files) {
  const { allow, except } = ownedPaths(kind);
  if (!allow.length) return [];
  const exceptFull = except.map((e) => (e.includes('/') ? e : `docs/${e}`));
  const inside = (f) =>
    allow.some((a) => f === a || f.startsWith(a.endsWith('/') ? a : `${a}/`) || (a.endsWith('/') && f.startsWith(a))) &&
    !exceptFull.some((e) => f === e || f.startsWith(e));
  // docs/CHANGELOG.md is everyone's shared log; status/inbox files are tooling.
  return files.filter((f) => !inside(f) && f !== 'docs/CHANGELOG.md' && !f.startsWith('.agents/'));
}

function field(body, name) {
  const m = new RegExp(`^[\\s>*-]*\\**${name}\\**\\s*[:：]\\s*(.+)$`, 'im').exec(body ?? '');
  return m?.[1]?.trim().replace(/\*\*/g, '') ?? '';
}
function selfReviews(body) {
  const lines = (body ?? '').split('\n');
  const out = [];
  for (const l of lines) {
    const m = /^\s*[-*]\s*(?:\[[ x]\]\s*)?(self[- ]review[^:]*:?\s*.+|e2e[^:]*:\s*.+)$/i.exec(l);
    if (m) out.push(m[1].trim());
  }
  return out.slice(0, 5);
}

function readAgents() {
  if (!existsSync(STATUS_DIR)) return [];
  const out = [];
  for (const f of readdirSync(STATUS_DIR)) {
    if (!f.endsWith('.json')) continue;
    try {
      const s = JSON.parse(readFileSync(join(STATUS_DIR, f), 'utf8'));
      const id = String(s.agent ?? f.replace(/\.json$/, ''));
      const upd = s.updatedAt ?? statSync(join(STATUS_DIR, f)).mtime.toISOString();
      out.push({
        id,
        name: title(id),
        state: STATES.includes(s.state) ? s.state : 'working',
        task: s.task ?? '',
        plan: s.planItem ? `#${String(s.planItem).replace(/^#/, '')}` : '',
        pr: s.pr ? Number(String(s.pr).replace(/^#/, '')) || undefined : undefined,
        ask: s.state === 'blocked' ? s.note || 'Blocked: open the agent for details.' : s.note,
        upd: hm(upd),
        stale: Date.now() - new Date(upd).getTime() > STALE_MS && s.state !== 'done',
      });
    } catch {
      /* skip unreadable status */
    }
  }
  return out;
}

function changelogFor(kind) {
  const lines = readText(join(ROOT, 'docs', 'CHANGELOG.md')).split('\n').filter((l) => l.includes(`[${kind}`));
  const last = lines.at(-1) ?? '';
  return {
    cause: /cause:\s*([^—]+)/i.exec(last)?.[1]?.trim() ?? '',
    fix: /fix:\s*([^(—]+)/i.exec(last)?.[1]?.trim() ?? '',
  };
}

function parseBugs() {
  const md = readText(join(ROOT, 'docs', 'BUGS.md'));
  const drafts = [];
  const filed = [];
  const blocks = md.split(/^### /m).slice(1);
  for (const b of blocks) {
    const head = /^(DRAFT-\d+):\s*(.+)$/m.exec(b);
    if (!head || head[2].includes('<')) continue; // template placeholder
    const kv = (k) => new RegExp(`^- ${k}:\\s*(.+)$`, 'im').exec(b)?.[1]?.trim() ?? '';
    const spira = kv('Spira');
    const item = {
      key: head[1],
      title: head[2].trim(),
      sev: (kv('Severity') || 'medium').toLowerCase(),
      found: kv('Found by') || '',
      jam: /^https?:/.test(kv('Jam')) && !kv('Jam').includes('<') ? kv('Jam') : '',
      test: kv('Linked test'),
    };
    if (/^SPIRA-\d+/i.test(spira)) filed.push({ ...item, id: spira.match(/SPIRA-\d+/i)[0].toUpperCase() });
    else drafts.push(item);
  }
  // Table rows with a real SPIRA id that have no block
  for (const row of md.split('\n')) {
    const m = /^\|\s*(SPIRA-\d+)\s*\|\s*([^|]+)\|\s*([^|]*)\|\s*([^|]*)\|\s*([^|]*)\|/.exec(row);
    if (m && !filed.some((f) => f.id === m[1]))
      filed.push({ id: m[1], title: m[2].trim(), sev: m[3].trim().toLowerCase() || 'medium', found: m[4].trim(), jam: (/https?:\/\/\S+/.exec(m[5]) ?? [''])[0] });
  }
  return { drafts, filed };
}

const DEFAULT_STOPS = [
  { t: '17:25', l: 'brief' }, { t: '18:00', l: 'recon' }, { t: '18:20', l: 'lanes' }, { t: '19:15', l: 'gate 1', g: 1 },
  { t: '19:50', l: 'integrate' }, { t: '20:00', l: 'gate 2 · cutoff', g: 1 }, { t: '20:20', l: 'freeze · final gate', g: 1 },
  { t: '20:40', l: 'wrap-up' }, { t: '20:55', l: 'submit', g: 1 },
];
function clock() {
  const md = readText(join(ROOT, 'docs', 'TIMELINE.md'));
  const phases = [...md.matchAll(/^\|\s*(\d{2}:\d{2})-(\d{2}:\d{2})\s*\|\s*\d+\s+([^|]+)\|/gm)];
  if (phases.length < 3) return DEFAULT_STOPS;
  const stops = phases.map((m) => ({ t: m[1], l: m[3].trim().toLowerCase() }));
  // PRD gates (bold times in TIMELINE are the gates/cutoffs)
  for (const g of DEFAULT_STOPS.filter((s) => s.g)) {
    const at = stops.find((s) => s.t === g.t);
    if (at) Object.assign(at, { l: g.l, g: 1 });
    else stops.push({ ...g });
  }
  if (!stops.some((s) => s.t === phases.at(-1)[2])) stops.push({ t: phases.at(-1)[2], l: 'submit', g: 1 });
  return stops.sort((a, b) => a.t.localeCompare(b.t));
}

// ---------- state ----------
async function state() {
  const errors = [];
  const safe = async (label, fn, fallback) => {
    try {
      return await fn();
    } catch (e) {
      errors.push(`${label}: ${e.message}`);
      return fallback;
    }
  };
  const agents = readAgents();
  const r = await safe('repo', repo, '');

  const rawPrs = r
    ? await safe('pull requests', () =>
        gh(['pr', 'list', '--state', 'open', '--limit', '50', '--json',
          'number,title,headRefName,labels,isDraft,author,url,body,files,additions,deletions,reviewDecision']), [])
    : [];
  const prs = rawPrs
    .filter((p) => !p.isDraft)
    .map((p) => {
      const agentId = /^agent\/(.+)$/.exec(p.headRefName)?.[1] ?? '';
      const kind = agentKind(agentId);
      const files = (p.files ?? []).map((f) => f.path);
      const labels = (p.labels ?? []).map((l) => l.name);
      const cl = changelogFor(kind);
      const tenten = /\b(10\/10)\b/.exec(p.body ?? '') ? '10/10' : null;
      return {
        n: p.number,
        url: p.url,
        agent: kind || 'unknown',
        agentId,
        who: agentId ? title(agentId) : (p.author?.login ?? 'unknown'),
        p: labels.find((l) => /^P[123]$/.test(l)) ?? 'P3',
        title: p.title,
        issue: Number(/(?:closes|fixes|resolves)\s+#(\d+)/i.exec(p.body ?? '')?.[1]) || null,
        cause: field(p.body, 'cause') || cl.cause,
        fix: field(p.body, 'fix') || cl.fix,
        reviews: selfReviews(p.body),
        tenten,
        files,
        outside: kind ? outsideOwned(kind, files) : [],
        add: p.additions,
        del: p.deletions,
        decision: p.reviewDecision,
      };
    });
  const drafts = rawPrs.filter((p) => p.isDraft).length;

  const runFields = 'databaseId,status,conclusion,headBranch,headSha,createdAt,url,displayTitle';
  const ci = r ? await safe('CI runs', () => gh(['run', 'list', '-w', 'ci.yml', '-L', '8', '--json', runFields]), []) : [];
  const gateRuns = r ? await safe('gate runs', () => gh(['run', 'list', '-w', 'stability-gate.yml', '-L', '3', '--json', runFields]), []) : [];
  const runs = ci.map((x) => ({
    id: `#${x.databaseId}`,
    url: x.url,
    at: hm(x.createdAt),
    branch: x.headBranch,
    sha: x.headSha?.slice(0, 7),
    title: x.displayTitle,
    res: x.status !== 'completed' ? 'running' : x.conclusion === 'success' ? 'pass' : 'fail',
  }));
  const gates = [];
  if (gateRuns[0]) {
    const g = gateRuns[0];
    const view = await safe('gate jobs', () => gh(['run', 'view', String(g.databaseId), '--json', 'jobs']), { jobs: [] });
    const jobs = ['run', 'run', 'run', 'run', 'run'];
    for (const j of view?.jobs ?? []) {
      const m = /run[-\s]?(\d)/i.exec(j.name);
      if (!m) continue;
      const i = Number(m[1]) - 1;
      if (i < 0 || i > 4) continue;
      jobs[i] = j.status !== 'completed' ? 'run' : j.conclusion === 'success' ? 'ok' : j.conclusion === 'skipped' ? 'skip' : 'bad';
    }
    const failed = jobs.map((j, i) => (j === 'bad' ? `run-${i + 1}` : null)).filter(Boolean);
    gates.push({
      id: g.databaseId,
      url: g.url,
      at: hm(g.createdAt),
      mode: /sequential/i.test(g.displayTitle ?? '') ? 'sequential' : 'parallel',
      jobs,
      why: failed.length ? `Failed: ${failed.join(', ')}. Open the run for the gate summary.` : '',
    });
  }

  let plan = [];
  if (r) {
    const issues = await safe('issues', () => gh(['issue', 'list', '--state', 'all', '--limit', '200', '--json', 'number,title,state,labels,assignees,body']), []);
    const pinned = issues.find((i) => /^automation test plan$/i.test(i.title.trim()));
    const order = pinned ? [...(pinned.body ?? '').matchAll(/^\s*- \[[ xX]\]\s*#(\d+)/gm)].map((m) => Number(m[1])) : [];
    const inReview = new Set(prs.map((p) => p.issue).filter(Boolean));
    const byN = new Map(issues.map((i) => [i.number, i]));
    const items = order.length ? order.map((n) => byN.get(n)).filter(Boolean) : issues.filter((i) => i.labels.some((l) => /^P[123]$/.test(l.name)));
    plan = items.map((i) => {
      const labels = i.labels.map((l) => l.name);
      const st = labels.includes('skipped-bug') ? 'skipped-bug' : labels.includes('not-added') ? 'not-added'
        : i.state === 'CLOSED' ? 'done' : inReview.has(i.number) ? 'review' : 'open';
      return {
        n: i.number,
        p: labels.find((l) => /^P[123]$/.test(l)) ?? 'P3',
        name: i.title,
        owner: i.assignees?.[0]?.login ?? prs.find((p) => p.issue === i.number)?.who ?? '',
        st,
        note: (/SPIRA-\d+/.exec(i.body ?? '') ?? [''])[0],
      };
    });
    if (!pinned && r) errors.push('test plan: no pinned "Automation Test Plan" issue yet (run npm run plan:issues)');
  }

  const bugs = parseBugs();
  const out = {
    repo: r,
    gh: r ? `https://github.com/${r}` : '',
    pages: r ? `https://${r.split('/')[0]}.github.io/${r.split('/')[1]}` : '',
    agents,
    prs,
    draftPrs: drafts,
    runs,
    gates,
    plan,
    drafts: bugs.drafts,
    filed: bugs.filed,
    stops: clock(),
    errors,
    at: new Date().toISOString(),
  };
  // Running Claude Code sessions/subagents (incl. ones with no status file) and the gaps the Lead must act on
  const sess = await safe('sessions', async () => readSessions(ROOT), []);
  out.sessions = sess.filter((x) => x.active).map(({ lastMs, ...x }) => x);
  out.gaps = findGaps(out, sess);
  return out;
}

// ---------- actions ----------
const ID = /^[a-z0-9][a-z0-9-]{0,39}$/;
const NUM = /^\d{1,7}$/;
const DRAFT = /^DRAFT-\d{1,4}$/;

function inbox(id, line) {
  mkdirSync(INBOX_DIR, { recursive: true });
  appendFileSync(join(INBOX_DIR, `${id}.md`), `\n- ${new Date().toISOString()} ${line.replace(/\r?\n/g, ' ')}\n`);
}
function setStatus(id, patch) {
  mkdirSync(STATUS_DIR, { recursive: true });
  const file = join(STATUS_DIR, `${id}.json`);
  let prev = { agent: id, state: 'working', task: '' };
  try {
    if (existsSync(file)) prev = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    /* rewrite */
  }
  writeFileSync(file, `${JSON.stringify({ ...prev, ...patch, agent: id, updatedAt: new Date().toISOString() }, null, 2)}\n`);
}

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

const routes = [
  ['POST', /^\/api\/agent\/([^/]+)\/note$/, async ([id], body) => {
    if (!ID.test(id)) throw new HttpError(400, 'Invalid agent id');
    const text = String(body.text ?? '').trim().slice(0, 2000);
    if (!text) throw new HttpError(400, 'Note is empty');
    inbox(id, `NOTE from Lead: ${text}`);
    return { ok: true, message: `Note sent to ${title(id)}` };
  }],
  ['POST', /^\/api\/agent\/([^/]+)\/(pause|resume)$/, async ([id, act]) => {
    if (!ID.test(id)) throw new HttpError(400, 'Invalid agent id');
    inbox(id, act === 'pause' ? 'PAUSE: stop after the current step and wait.' : 'RESUME: continue your plan.');
    setStatus(id, { state: act === 'pause' ? 'paused' : 'working' });
    return { ok: true, message: `${title(id)} ${act === 'pause' ? 'paused' : 'resumed'}` };
  }],
  ['POST', /^\/api\/pr\/([^/]+)\/approve-merge$/, async ([n], body) => {
    if (!NUM.test(n)) throw new HttpError(400, 'Invalid PR number');
    const s = await state();
    const pr = s.prs.find((p) => p.n === Number(n));
    if (!pr) throw new HttpError(404, `PR #${n} is not in the review queue`);
    const blocker = s.prs.find((o) => o.n !== pr.n && MERGE_ORDER.indexOf(o.agent) >= 0 && MERGE_ORDER.indexOf(o.agent) < MERGE_ORDER.indexOf(pr.agent));
    if (blocker && body.force !== true)
      throw new HttpError(409, `Merge order: #${blocker.n} (${blocker.who}) should merge first. Click again to merge anyway.`);
    // Agents open PRs under Kayla's own account, and GitHub refuses a review of your own PR.
    // Then the approval is recorded as a PR comment instead, and the merge goes ahead.
    let via = 'review';
    try {
      await gh(['pr', 'review', n, '--approve'], { json: false, fresh: true });
    } catch (e) {
      if (!OWN_PR.test(String(e?.message ?? e))) throw e;
      await gh(['pr', 'comment', n, '-b', 'Approved by the Lead (Control Center).'], { json: false, fresh: true });
      via = 'comment';
    }
    await gh(['pr', 'merge', n, '--squash'], { json: false, fresh: true });
    invalidate();
    return { ok: true, message: `Merged #${n}${pr.issue ? `. Issue #${pr.issue} closes.` : ''}${via === 'comment' ? ' (approval noted as a comment: own PR)' : ''}` };
  }],
  ['POST', /^\/api\/pr\/([^/]+)\/request-changes$/, async ([n], body) => {
    if (!NUM.test(n)) throw new HttpError(400, 'Invalid PR number');
    const text = String(body.text ?? '').trim().slice(0, 4000);
    if (!text) throw new HttpError(400, 'Write what should change');
    try {
      await gh(['pr', 'review', n, '--request-changes', '-b', text], { json: false, fresh: true });
    } catch (e) {
      if (!OWN_PR.test(String(e?.message ?? e))) throw e;
      // Own PR: a comment carries the request; agents read PR comments before resuming.
      await gh(['pr', 'comment', n, '-b', `Changes requested by the Lead: ${text}`], { json: false, fresh: true });
    }
    invalidate();
    return { ok: true, message: `Asked for changes on #${n}` };
  }],
  ['POST', /^\/api\/gate$/, async (_, body) => {
    const mode = body.mode === 'sequential' ? 'sequential' : 'parallel';
    await gh(['workflow', 'run', 'stability-gate.yml', '-f', `mode=${mode}`], { json: false, fresh: true });
    invalidate();
    return { ok: true, message: `Stability gate started (${mode}). It shows up here within a minute.` };
  }],
  ['POST', /^\/api\/bug\/([^/]+)\/file$/, async ([id]) => {
    if (!DRAFT.test(id)) throw new HttpError(400, 'Invalid draft id (expected DRAFT-NN)');
    const out = await run('npx', ['tsx', 'scripts/spira-file.ts', '--from-bugs', 'docs/BUGS.md', '--id', id, '--submit'], { timeout: 120_000 });
    return { ok: true, message: `Filed ${id}`, output: out.slice(-4000) };
  }],
  ['GET', /^\/api\/pr\/([^/]+)\/diff$/, async ([n]) => {
    if (!NUM.test(n)) throw new HttpError(400, 'Invalid PR number');
    const out = await gh(['pr', 'diff', n], { json: false });
    const lines = out.split('\n');
    return { ok: true, diff: lines.slice(0, 400).join('\n'), truncated: lines.length > 400 };
  }],
];

// ---------- http ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' };

function send(res, status, data, type = 'application/json') {
  const body = type === 'application/json' ? JSON.stringify(data) : data;
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Content-Security-Policy': "default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; script-src 'self' 'unsafe-inline'; connect-src 'self'",
  });
  res.end(body);
}

function sameOrigin(req) {
  const allowed = [`http://localhost:${PORT}`, `http://127.0.0.1:${PORT}`];
  const host = req.headers.host ?? '';
  if (!allowed.some((a) => a.endsWith(`//${host}`))) return false;
  const origin = req.headers.origin;
  return typeof origin === 'string' && allowed.includes(origin);
}

async function readBody(req) {
  let data = '';
  for await (const c of req) {
    data += c;
    if (data.length > 64 * 1024) throw new HttpError(413, 'Body too large');
  }
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', `http://${HOST}:${PORT}`);
  try {
    if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
      return send(res, 200, readFileSync(join(HERE, 'app', 'index.html'), 'utf8'), MIME['.html']);
    }
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, await state());
    for (const [method, re, fn] of routes) {
      const m = re.exec(url.pathname);
      if (!m || method !== req.method) continue;
      if (method === 'POST') {
        if (!sameOrigin(req)) throw new HttpError(403, 'Cross-origin request refused');
        if (!/^application\/json/.test(req.headers['content-type'] ?? '')) throw new HttpError(415, 'Use application/json');
      }
      const body = method === 'POST' ? await readBody(req) : {};
      return send(res, 200, await fn(m.slice(1).map(decodeURIComponent), body));
    }
    if (extname(url.pathname)) throw new HttpError(404, 'Not found');
    throw new HttpError(404, 'Unknown route');
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 502;
    send(res, status, { ok: false, error: e.message });
  }
});

server.listen(PORT, HOST, () => {
  process.stdout.write(`Control Center on http://localhost:${PORT}  (demo: http://localhost:${PORT}/?demo=1)\nRepo root: ${ROOT}\n`);
});
