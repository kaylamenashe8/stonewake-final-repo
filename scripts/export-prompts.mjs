#!/usr/bin/env node
// Exports every prompt used during the competition to docs/PROMPTS.md (organizers' requirement, 19:30).
// Source: Claude Code transcripts (~/.claude/projects) of sessions that touched the competition, from 17:25.
// Includes the Lead's prompts and the prompts the Lead delegated to subagents. Secrets are redacted.
// Usage: node scripts/export-prompts.mjs [--since 2026-11-04T15:25:00Z] [--out docs/PROMPTS.md]
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const SINCE = new Date(arg('--since', '2026-11-04T15:25:00Z')); // 17:25 Israel time
const OUT = arg('--out', 'docs/PROMPTS.md');
const PROJECTS = ['-Users-kaylamenashe-workspace-stonewake-final-repo', '-Users-kaylamenashe-workspace-manager-tools'];
const RELEVANT = /stonewake|itac|playwright|recon|stabiliz|crawler|control center|run.sheet|\bpr\b|merge|gate|spira|judge|luca/i;

// ---- redaction: values from .env plus known token shapes ----
const secrets = [];
for (const f of ['.env', '../stonewake-final-repo/.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split('\n')) {
    const v = /^[A-Z0-9_]+=(.+)$/.exec(line.trim())?.[1]?.replace(/^["']|["']$/g, '');
    if (v && v.length >= 6 && !/^https?:\/\/[^/]*stonewake\.ai\/?$/.test(v)) secrets.push(v);
  }
}
const redact = (s) => {
  let t = s;
  for (const v of secrets) t = t.split(v).join('[REDACTED]');
  return t
    .replace(/\b(sk-ant-[A-Za-z0-9_-]{10,}|gh[pousr]_[A-Za-z0-9]{20,}|swk_(live|test)_[A-Za-z0-9]{8,}|xox[abp]-[A-Za-z0-9-]{10,})\b/g, '[REDACTED]')
    // a literal value right after key= / key: (not `GITHUB_TOKEN= cmd`, `$(...)`, placeholders or prose)
    .replace(/(password|passwd|api[_-]?key|token|secret)([:=])(?![\s$<(`'"])[^\s'"`]{6,}/gi, '$1$2[REDACTED]')
    .replace(/hooks\.slack\.com\/services\/\S+/g, 'hooks.slack.com/services/[REDACTED]');
};

// ---- what is a human prompt ----
const NOISE = /^(<|\[SYSTEM NOTIFICATION|Caveat:|This session is being continued)/;
const SCHEDULED = /^Run-sheet status refresh/;
const clean = (s) => s.replace(/<system-reminder>[\s\S]*?<\/system-reminder>/g, '').replace(/<pasted_content[^>]*>/g, '\n> (pasted)\n').replace(/<\/pasted_content[^>]*>/g, '').trim();

const entries = [];
let scheduled = 0;
for (const proj of PROJECTS) {
  const dir = join(homedir(), '.claude', 'projects', proj);
  if (!existsSync(dir)) continue;
  for (const f of readdirSync(dir).filter((x) => x.endsWith('.jsonl'))) {
    const file = join(dir, f);
    if (statSync(file).mtime < SINCE) continue;
    const lines = readFileSync(file, 'utf8').split('\n');
    const sid = f.slice(0, 8);
    const local = [];
    for (const l of lines) {
      let e;
      try { e = JSON.parse(l); } catch { continue; }
      if (!e.timestamp || new Date(e.timestamp) < SINCE) continue;
      if (e.type === 'user' && typeof e.message?.content === 'string' && !e.isMeta) {
        const c = e.message.content;
        if (NOISE.test(c.trimStart())) continue;
        if (SCHEDULED.test(c)) { scheduled++; continue; }
        local.push({ at: e.timestamp, kind: 'prompt', text: clean(c) });
      }
      if (e.type === 'assistant') for (const c of e.message?.content ?? []) {
        if (c.type === 'tool_use' && c.name === 'Agent') local.push({ at: e.timestamp, kind: 'delegated', to: c.input?.subagent_type ?? 'general-purpose', desc: c.input?.description ?? '', text: String(c.input?.prompt ?? '') });
        if (c.type === 'tool_use' && c.name === 'SendMessage') local.push({ at: e.timestamp, kind: 'message', to: 'running agent', desc: c.input?.summary ?? '', text: String(c.input?.message ?? '') });
      }
    }
    // manager-tools holds other work too: keep only that session's competition prompts
    const keep = proj.includes('stonewake') ? local : local.filter((x) => RELEVANT.test(x.text));
    if (!keep.length) continue;
    const label = proj.includes('stonewake') ? `repo session ${sid}` : `manager-tools session ${sid}`;
    for (const x of keep) entries.push({ ...x, session: label });
  }
}
entries.sort((a, b) => a.at.localeCompare(b.at));

const hm = (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jerusalem' });
const quote = (s) => s.split('\n').map((l) => `> ${l}`).join('\n');
const sessions = [...new Set(entries.map((e) => e.session))];
let md = `# Prompts used during the competition

Every prompt Kayla gave Claude Code during the ITAC 2026 Finals (from 17:25, Wed 4 Nov 2026), in time order,
plus the prompts the Lead session delegated to subagents and the messages it sent to running agents.
Exported from the Claude Code session transcripts by \`scripts/export-prompts.mjs\`; secrets are redacted.
Curated highlights and how AI was used: \`docs/AI_LOG.md\`.

- Prompts by Kayla: ${entries.filter((e) => e.kind === 'prompt').length}
- Prompts delegated to subagents: ${entries.filter((e) => e.kind === 'delegated').length}
- Messages to running agents: ${entries.filter((e) => e.kind === 'message').length}
- Sessions: ${sessions.length} (${sessions.join(', ')})
- Not listed: the standing run-sheet refresh prompt that a scheduled job re-sent every 5 minutes${scheduled ? ` (${scheduled}×)` : ''}.

## Key prompts

| Time | Prompt (short) | What it led to |
|---|---|---|
| 17:36 | "Read all of the documentation on the site to fully understand the product" (background only, no crawling) | 3 parallel doc readers → \`docs/product/notes-A/B/C.md\` |
| 17:41 | "Take into account … where we should focus our testing" (the judges' six flows) | Notes re-mapped to flows F1-F6 → \`JUDGES_FOCUS.md\`, plan weighted to them |
| 18:06 | "Start the recon" (with a context hand-off) | \`docs/BASELINE.md\`, 5x flakiness run, failure clusters C1-C5, ranked \`TEST_PLAN.json\` |
| 18:15 | "Send a crawler to try to reproduce this [login] bug first" | Reproduce before filing: max 3 attempts, no lockout, evidence saved |
| 18:23-18:29 | Start the UI crawler, the API agent and two Stabilizers in parallel | Lanes in separate worktrees, one PR per item, 10/10 promotion rule |
| 18:35 | "Run the architect first" | Shared config, env schema, lint baseline (D16) merged before the Stabilizers |
| 18:48 | "Nothing gets pushed to a PR … until the code is reviewed to high standards and passes E2E" | \`docs/REVIEW_CHECKLIST.md\`, \`npm run pre-pr\`, a push hook that enforces both |
| 19:03 | Judges' updates: security testing allowed; social monitoring (Research/Sentiment) | D17, D18, plan items T30-T34, every agent notified |
| 19:10 | Strict reviews of the Stabilizer PRs, then "fix all findings" | zod + ApiClient, account-lockout risk removed, locator and naming fixes |
| 19:22 | "Include a Markdown file with the prompts you used" | This file |

## Full log

`;
for (const e of entries) {
  const who = e.kind === 'prompt' ? 'Kayla' : e.kind === 'delegated' ? `Lead → ${e.to} subagent${e.desc ? ` (${e.desc})` : ''}` : `Lead → running agent (${e.desc})`;
  md += `### ${hm(e.at)} · ${who} · ${e.session}\n\n${quote(redact(e.text))}\n\n`;
}
writeFileSync(OUT, md);
console.log(`${OUT}: ${entries.length} entries from ${sessions.length} sessions, ${scheduled} scheduled refreshes collapsed`);
