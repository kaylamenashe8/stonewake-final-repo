#!/usr/bin/env node
// Writes the run-sheet status snapshot: node control-center/snapshot.mjs <out.json>
// Reads the running Control Center (/api/state) plus Claude Code transcripts, and adds the gaps list.
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sessions, gaps } from './gaps.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] ?? join(ROOT, 'test-results', 'run-sheet-status.json');
const port = process.env.PORT ?? 4000;

let state = { agents: [], prs: [], runs: [], gates: [], plan: [], errors: [] };
try {
  const r = await fetch(`http://127.0.0.1:${port}/api/state`);
  state = await r.json();
} catch (e) {
  state.errors = [`Control Center not reachable on port ${port}: ${e.message}`];
}
const now = new Date();
const sess = sessions(ROOT, now.getTime());
const worktrees = execFileSync('git', ['worktree', 'list', '--porcelain'], { cwd: ROOT }).toString()
  .split('\n\n').filter(Boolean).map((b) => ({
    path: /^worktree (.+)$/m.exec(b)?.[1]?.replace(/^.*\//, '') ?? '',
    branch: /^branch refs\/heads\/(.+)$/m.exec(b)?.[1] ?? '(detached)',
  }));

const snap = {
  at: now.toISOString(),
  hm: now.toTimeString().slice(0, 5),
  repo: state.gh ?? '',
  pages: state.pages ?? '',
  agents: state.agents ?? [],
  sessions: sess.filter((s) => s.kind === 'subagent' || s.active || now - s.lastMs < 60 * 60 * 1000)
    .map(({ lastMs, ...s }) => s),
  worktrees,
  prs: (state.prs ?? []).map((p) => ({ n: p.n, url: p.url, who: p.who, p: p.p, title: p.title, tenten: p.tenten })),
  runs: (state.runs ?? []).slice(0, 5),
  gates: (state.gates ?? []).slice(0, 3),
  plan: {
    total: (state.plan ?? []).length,
    open: (state.plan ?? []).filter((i) => i.st === 'open').length,
    unowned: (state.plan ?? []).filter((i) => i.st === 'open' && !i.owner).length,
  },
  gaps: gaps(state, sess, now),
};
writeFileSync(out, JSON.stringify(snap, null, 2));
console.log(`${out}: ${snap.agents.length} status files, ${snap.sessions.filter((s) => s.active).length} active sessions, ${snap.gaps.length} gaps`);
