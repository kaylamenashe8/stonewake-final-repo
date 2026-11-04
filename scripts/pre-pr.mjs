#!/usr/bin/env node
// Pre-PR gate: `npm run pre-pr`. Must pass on HEAD before any push to a PR branch (enforced by
// .claude/hooks/pr-gate.mjs). Checks: self-review checklist complete, lint, typecheck, E2E.
// Writes .agents/review/<branch>.json = {branch, sha, passed, at, steps[], specs[]}.
import { spawnSync, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();
const root = git('rev-parse', '--show-toplevel');
process.chdir(root);
const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
if (branch === 'master' || branch === 'main') {
  console.error('pre-pr: run this on your agent branch, not on master.');
  process.exit(1);
}
const key = branch.replace(/[^A-Za-z0-9._-]/g, '-');
const dir = join(root, '.agents', 'review');
mkdirSync(dir, { recursive: true });
const sha = git('rev-parse', 'HEAD');
if (git('status', '--porcelain', '--untracked-files=no')) {
  console.error('pre-pr: commit your changes first (the result is stamped on HEAD).');
  process.exit(1);
}

const LEGACY = new Set(['tests/api.spec.ts', 'tests/ui.spec.ts']); // D16: being migrated, not run here
const isSpec = (f) => /^tests\/.+\.spec\.ts$/.test(f) && !f.startsWith('tests/generated/') && !LEGACY.has(f);
const isVisual = (f) => f.startsWith('tests/visual/'); // baselines are Docker-only (D11): run in CI, not here
const SHARED = /^(src\/|playwright\.config\.ts$|package(-lock)?\.json$|tsconfig\.json$|tests\/[^/]+\.setup\.ts$)/;

try {
  git('fetch', '-q', 'origin', 'master');
} catch {
  /* offline: compare with the local ref */
}
const base = git('merge-base', 'HEAD', 'origin/master');
const changed = git('diff', '--name-only', '--diff-filter=AMR', `${base}...HEAD`).split('\n').filter(Boolean);
const specs = changed.filter((f) => isSpec(f) && !isVisual(f) && existsSync(f));
const sharedChanged = changed.some((f) => SHARED.test(f));

const steps = [];
const fail = (name, detail) => {
  steps.push({ name, ok: false, detail });
  finish();
};
function finish() {
  const passed = steps.every((s) => s.ok);
  const rec = { branch, sha, passed, at: new Date().toISOString(), specs, sharedChanged, steps };
  writeFileSync(join(dir, `${key}.json`), JSON.stringify(rec, null, 2) + '\n');
  console.log(`\n== pre-pr ${passed ? 'PASSED' : 'FAILED'} on ${sha.slice(0, 7)} (${branch}) ==`);
  for (const s of steps) console.log(`${s.ok ? 'ok  ' : 'FAIL'} ${s.name}${s.detail ? ` — ${s.detail}` : ''}`);
  if (passed) {
    console.log('\nPaste into the PR body:\n');
    console.log(`## Self-review\nChecklist docs/REVIEW_CHECKLIST.md R1-R19 reviewed (${key}.md), 2+ passes.\n`);
    console.log(`## E2E (pre-pr on ${sha.slice(0, 7)})`);
    for (const s of steps.filter((x) => x.e2e)) console.log(`- ${s.name}: passed`);
    if (!specs.length) console.log('- no spec changed');
  }
  process.exit(passed ? 0 : 1);
}
function run(name, cmd, args, extra = {}) {
  console.log(`\n-- ${name}: ${cmd} ${args.join(' ')}`);
  const r = spawnSync(cmd, args, { stdio: 'inherit', env: { ...process.env, ...extra.env } });
  if (r.status !== 0) fail(name, `exit ${r.status}`);
  steps.push({ name, ok: true, e2e: !!extra.e2e });
}

// 1. Self-review checklist: R1-R19 ticked, written after the last commit was made
const reviewFile = join(dir, `${key}.md`);
if (!existsSync(reviewFile)) fail('self-review', `write ${reviewFile.replace(root + '/', '')} (docs/REVIEW_CHECKLIST.md, "How")`);
const review = readFileSync(reviewFile, 'utf8');
const missing = [];
for (let i = 1; i <= 19; i++) if (!new RegExp(`^\\s*-\\s*\\[x\\]\\s*R${i}\\b`, 'mi').test(review)) missing.push(`R${i}`);
if (missing.length) fail('self-review', `not ticked: ${missing.join(', ')}`);
steps.push({ name: 'self-review checklist R1-R19', ok: true });

// 2. Static checks
run('lint', 'npm', ['run', '-s', 'lint']);
run('typecheck', 'npm', ['run', '-s', 'typecheck']);

// 3. E2E
const pw = (args) => ['playwright', 'test', '--retries=0', ...args];
if (specs.length) {
  run(`changed specs 10/10, 1 worker (${specs.length})`, 'npx', pw(['--repeat-each=10', '--workers=1', ...specs]), { e2e: true });
  run(`changed specs 10/10, 4 workers (${specs.length})`, 'npx', pw(['--repeat-each=10', '--workers=4', '--fully-parallel', ...specs]), { e2e: true });
}
run('@smoke', 'npx', pw(['--grep', '@smoke', '--project=chromium']), { e2e: true });
if (sharedChanged) {
  const migrated = git('ls-files', 'tests').split('\n').filter((f) => isSpec(f) && !isVisual(f) && existsSync(f));
  if (migrated.length) run(`migrated suite once, shared code changed (${migrated.length} files)`, 'npx', pw(migrated), { e2e: true });
}
steps.push({ name: 'E2E', ok: true });
finish();
