// Agent sessions + gap detection, shared by the Control Center (/api/gaps) and snapshot.mjs (run sheet).
// Sessions come from Claude Code's own transcripts (~/.claude/projects/<repo slug>/), so an agent shows up
// even when it never wrote .agents/status/<agent>.json. Built-ins only.
import { existsSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const ACTIVE_MS = 5 * 60 * 1000; // transcript written in the last 5 min = running
const QUIET_MS = 10 * 60 * 1000;
const LIGHT = new Set(['scribe', 'bug-reporter']); // not counted as heavy
const LANES = [
  // [from HH:MM, until HH:MM, lanes expected to be running or done]
  ['18:20', '19:50', ['architect', 'stabilizer', 'ci-infra', 'triage', 'coverage', 'crawler-generator', 'api', 'bug-reporter', 'scribe']],
  ['19:50', '20:20', ['stabilizer', 'visual-bonus', 'scribe']],
  ['20:20', '20:55', ['scribe']],
];

const slug = (p) => p.replace(/[^A-Za-z0-9]/g, '-');
const hm = (ms) => new Date(ms).toTimeString().slice(0, 5);
const addMin = (t, m) => { const [h, mm] = t.split(':').map(Number); const x = h * 60 + mm + m; return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };

function tail(file, bytes = 64 * 1024) {
  const size = statSync(file).size;
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(Math.min(bytes, size));
  readSync(fd, buf, 0, buf.length, size - buf.length);
  closeSync(fd);
  return buf.toString('utf8').split('\n').filter(Boolean);
}

function lastEntry(file) {
  const lines = tail(file);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      return JSON.parse(lines[i]);
    } catch {
      /* partial first line */
    }
  }
  return {};
}

function firstPrompt(file) {
  const fd = openSync(file, 'r');
  const buf = Buffer.alloc(Math.min(256 * 1024, statSync(file).size));
  readSync(fd, buf, 0, buf.length, 0);
  closeSync(fd);
  for (const l of buf.toString('utf8').split('\n')) {
    try {
      const e = JSON.parse(l);
      const c = e.type === 'user' ? e.message?.content : null;
      if (typeof c === 'string' && !c.startsWith('<')) return c.replace(/\s+/g, ' ').slice(0, 90);
    } catch {
      /* skip */
    }
  }
  return '';
}

/** Lead sessions and their subagents for this repo (and any ../wt-* worktree). */
export function sessions(root, now = Date.now()) {
  const base = join(homedir(), '.claude', 'projects');
  if (!existsSync(base)) return [];
  const dirs = readdirSync(base).filter((d) => d === slug(root) || d.startsWith(slug(join(root, '..', 'wt-'))));
  const out = [];
  for (const d of dirs) {
    const dir = join(base, d);
    for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
      const id = f.replace(/\.jsonl$/, '');
      const mt = statSync(join(dir, f)).mtimeMs;
      if (now - mt > 6 * 3600 * 1000) continue; // today's sessions only
      out.push({ kind: 'lead', id: id.slice(0, 8), agent: 'lead', what: firstPrompt(join(dir, f)), last: hm(mt), lastMs: mt,
        active: now - mt < ACTIVE_MS, worktree: d === slug(root) ? '' : d.split('-wt-')[1] ?? '' });
      const sub = join(dir, id, 'subagents');
      if (!existsSync(sub)) continue;
      for (const m of readdirSync(sub).filter((x) => x.endsWith('.meta.json'))) {
        try {
          const meta = JSON.parse(readFileSync(join(sub, m), 'utf8'));
          const tf = join(sub, m.replace(/\.meta\.json$/, '.jsonl'));
          const smt = existsSync(tf) ? statSync(tf).mtimeMs : statSync(join(sub, m)).mtimeMs;
          const last = existsSync(tf) ? lastEntry(tf) : {};
          const finished = last.type === 'assistant' && last.message?.stop_reason === 'end_turn';
          out.push({ kind: 'subagent', id: m.slice(6, 14), parent: id.slice(0, 8), agent: meta.agentType ?? 'unknown',
            what: meta.description ?? '', last: hm(smt), lastMs: smt, finished,
            active: !finished && now - smt < ACTIVE_MS });
        } catch {
          /* skip unreadable meta */
        }
      }
    }
  }
  return out.sort((a, b) => b.lastMs - a.lastMs);
}

/** Lead-session agents: a session started with "start my <x> agent" counts as lane <x>. */
function laneOf(s) {
  if (s.kind === 'subagent') return s.agent;
  const m = /start (?:my |the )?(ui |api )?(crawler|api|architect|stabilizer|coverage|triage|scribe|ci|visual|bug)/i.exec(s.what);
  if (!m) return null;
  const w = m[2].toLowerCase();
  return { crawler: 'crawler-generator', ci: 'ci-infra', visual: 'visual-bonus', bug: 'bug-reporter' }[w] ?? w;
}

/**
 * Gaps the Lead must act on, worst first. `state` = Control Center /api/state.
 * Each gap: {sev: 'high'|'medium'|'low', area, text, fix}
 */
export function gaps(state, sess, now = new Date()) {
  const out = [];
  const add = (sev, area, text, fix) => out.push({ sev, area, text, fix });
  const t = now.toTimeString().slice(0, 5);
  const status = new Map((state.agents ?? []).map((a) => [a.id.replace(/-\d+$/, ''), a]));
  const running = new Map();
  for (const s of sess) {
    const lane = laneOf(s);
    if (lane && s.active) running.set(lane, [...(running.get(lane) ?? []), s]);
  }
  const touched = new Set([...status.keys(), ...sess.map(laneOf).filter(Boolean)]);

  // 1. Expected lanes that never started
  const window = LANES.find(([a, b]) => t >= a && t < b);
  if (window) {
    const missing = window[2].filter((l) => !touched.has(l));
    if (missing.length) {
      const first = missing.includes('architect') ? ' Architect is first in the merge order, so the others will wait on it.' : '';
      add(missing.includes('architect') ? 'high' : 'medium', 'Lanes',
        `Not started since ${window[0]}: ${missing.join(', ')}.${first}`, `Start them in Claude Code (/stabilize, or "start the <lane> agent").`);
    }
  }

  // 2. Running but invisible on the Control Center
  for (const [lane, list] of running) {
    if (lane === 'lead') continue;
    if (!status.has(lane)) {
      add('medium', 'Reporting', `${lane} is running (${list.map((s) => s.what).join('; ')}) but has no status file, so the Agents panel cannot show it.`,
        `Tell it to run: node .claude/hooks/status.mjs ${lane} working "<task>"`);
    }
  }

  // 3. Status says one thing, transcript another
  for (const [id, a] of status) {
    if (a.state === 'blocked') add('high', 'Blocked', `${a.name} is blocked: ${a.ask ?? 'no note'}`, 'Answer it in its session or via Send note.');
    else if (a.stale && !running.has(id)) add('medium', 'Quiet', `${a.name} (${a.state}) last reported ${a.upd} and its session is not active.`, 'Check whether it stopped; restart or mark it done.');
  }

  // 4. Heavy agent limit
  const heavy = [...running.entries()].filter(([l]) => l !== 'lead' && !LIGHT.has(l)).reduce((n, [, v]) => n + v.length, 0);
  if (heavy > 6) add('high', 'Capacity', `${heavy} heavy agents running; the plan allows 6.`, 'Pause the lowest-priority lane.');

  // 5. Review queue
  const prs = state.prs ?? [];
  if (prs.length >= 3) add('medium', 'Review', `${prs.length} PRs waiting for review.`, 'Review now (/review <n>); merge in order Architect → Stabilizer → CI/Infra → Coverage → Visual → Triage.');
  for (const p of prs.filter((x) => x.outside?.length)) add('medium', 'Review', `PR #${p.n} touches files outside ${p.who}'s lane: ${p.outside.slice(0, 3).join(', ')}.`, 'Ask for changes or confirm it is intended.');

  // 6. CI and gates
  const master = (state.runs ?? []).find((r) => r.branch === 'master');
  if (!master) add('high', 'CI', 'No CI run on master yet.', 'Check the Actions tab; run CI on master.');
  else if (master.res === 'fail') add('high', 'CI', `Latest CI run on master failed (${master.at}, ${master.id}).`, `Open ${master.url} and send the failure to Triage.`);
  else if (master.res === 'running' && t > addMin(master.at, 20)) add('medium', 'CI', `CI on master has been running or queued since ${master.at}.`, 'Check runners / githubstatus.com.');
  const gates = state.gates ?? [];
  if (t >= '19:15' && !gates.length) add('high', 'Gate', 'No stability gate run yet; the first gate was due at 19:15.', 'Run /gate parallel.');
  const lastGate = gates[0];
  if (lastGate && lastGate.res === 'fail') add('high', 'Gate', `Latest gate (${lastGate.at}) is red.`, 'Fix only the failing tests, then rerun.');

  // 7. Test plan coverage
  const plan = state.plan ?? [];
  if (!plan.length && t >= '18:20') add('medium', 'Plan', 'No test plan issues yet, so plan coverage cannot be tracked.', 'Enable issues and run npm run plan:issues.');
  const p1Open = plan.filter((i) => i.p === 'P1' && i.st === 'open' && !i.owner);
  if (p1Open.length && t >= '18:40') add('medium', 'Plan', `${p1Open.length} P1 plan items have no owner or PR: ${p1Open.slice(0, 4).map((i) => i.name.match(/\[(T\d+)\]/)?.[1] ?? `#${i.n}`).join(', ')}${p1Open.length > 4 ? '…' : ''}.`, 'Give them to Coverage / API.');

  // 8. Deadlines
  if (t >= '20:00' && t < '20:20') add('high', 'Deadline', 'After 20:00: no new tests may start.', 'Only fix and merge what is in review.');
  if (t >= '20:20') add('high', 'Deadline', 'Code freeze (20:20): no code changes.', 'Final gate and docs only.');

  // 9. Data the Control Center could not read
  for (const e of state.errors ?? []) add('low', 'Data', e, 'See the yellow box in the Control Center.');

  const rank = { high: 0, medium: 1, low: 2 };
  return out.sort((a, b) => rank[a.sev] - rank[b.sev]);
}
