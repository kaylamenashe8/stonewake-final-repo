#!/usr/bin/env node
// PreToolUse(Bash) gate: nothing reaches a PR until `npm run pre-pr` passed on the exact commit.
// Blocks `git push`, `gh pr create`, `gh pr ready` (exit 2 = tool call refused, message goes back to the agent).
// Evidence: <worktree>/.agents/review/<branch>.json {sha, passed} (written by scripts/pre-pr.mjs).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';

const raw = await new Promise((ok) => {
  let d = '';
  process.stdin.on('data', (c) => (d += c)).on('end', () => ok(d));
});
let p = {};
try {
  p = JSON.parse(raw);
} catch {
  process.exit(0);
}
const cmd = String(p.tool_input?.command ?? '');
const gated = /\bgit\s+(-C\s+\S+\s+)?push\b|\bgh\s+pr\s+(create|ready)\b/.test(cmd);
if (p.tool_name !== 'Bash' || !gated) process.exit(0);
if (/\bgit\s+push\b[^;&|]*--(delete|tags)\b/.test(cmd)) process.exit(0);

const git = (cwd, ...a) => execFileSync('git', ['-C', cwd, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
// Directory the command acts in: the last `cd X` before the gated part, or `git -C X`, else the session cwd.
let cwd = p.cwd ?? process.cwd();
const before = cmd.split(/\bgit\s+(?:-C\s+\S+\s+)?push\b|\bgh\s+pr\s+(?:create|ready)\b/)[0];
for (const m of before.matchAll(/\bcd\s+("[^"]+"|'[^']+'|[^\s;&|]+)/g)) cwd = resolve(cwd, m[1].replace(/^["']|["']$/g, '').replace(/^~/, process.env.HOME ?? '~'));
const dashC = /\bgit\s+-C\s+(\S+)\s+push\b/.exec(cmd);
if (dashC) cwd = resolve(cwd, dashC[1]);

function block(msg) {
  process.stderr.write(`PR gate: ${msg}\nRules: docs/REVIEW_CHECKLIST.md. Review your diff (2+ passes), tick R1-R19 in .agents/review/<branch>.md, commit, run \`npm run pre-pr\`, then push.\n`);
  process.exit(2);
}

let branch, sha, root;
try {
  root = git(cwd, 'rev-parse', '--show-toplevel');
  branch = git(cwd, 'rev-parse', '--abbrev-ref', 'HEAD');
  sha = git(cwd, 'rev-parse', 'HEAD');
} catch {
  process.exit(0); // not a git dir: nothing to gate
}

// `gh pr ready <n>` from another checkout: gate the PR's own head instead
const readyN = /\bgh\s+pr\s+ready\s+#?(\d+)/.exec(cmd)?.[1];
if (readyN) {
  try {
    const pr = JSON.parse(execFileSync('gh', ['pr', 'view', readyN, '--json', 'headRefName,headRefOid'], {
      cwd: root, encoding: 'utf8', env: { ...process.env, GITHUB_TOKEN: '', GH_TOKEN: '' } }));
    branch = pr.headRefName;
    sha = pr.headRefOid;
  } catch {
    block(`could not read PR #${readyN} to check its evidence.`);
  }
}
if (branch === 'master' || branch === 'main' || branch === 'HEAD') process.exit(0); // master pushes are denied in settings

// Find evidence in this checkout or any sibling worktree (../wt-*)
const key = branch.replace(/[^A-Za-z0-9._-]/g, '-');
const roots = [root, ...(() => {
  try {
    return readdirSync(dirname(root)).filter((d) => d.startsWith('wt-')).map((d) => join(dirname(root), d));
  } catch {
    return [];
  }
})()];
let rec = null;
for (const r of roots) {
  const f = join(r, '.agents', 'review', `${key}.json`);
  if (!existsSync(f)) continue;
  try {
    const x = JSON.parse(readFileSync(f, 'utf8'));
    if (x.sha === sha) rec = x;
  } catch {
    /* unreadable */
  }
}
if (!rec) block(`no pre-pr result for ${branch} @ ${sha.slice(0, 7)}. Every new commit needs a fresh \`npm run pre-pr\`.`);
if (!rec.passed) block(`pre-pr FAILED on ${sha.slice(0, 7)}: ${rec.steps.filter((s) => !s.ok).map((s) => `${s.name} (${s.detail ?? ''})`).join('; ')}. Fix it, commit, rerun.`);
process.exit(0);
