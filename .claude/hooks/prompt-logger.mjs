#!/usr/bin/env node
// UserPromptSubmit hook: appends every prompt to docs/AI_LOG.md (redacted). Never blocks: always exit 0.
import { appendFileSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const REDACTIONS = [
  [/sk-ant-[A-Za-z0-9_-]{8,}/g, 'sk-ant-[REDACTED]'],
  [/sk-[A-Za-z0-9_-]{20,}/g, 'sk-[REDACTED]'],
  [/gh[pousr]_[A-Za-z0-9]{10,}/g, 'gh_[REDACTED]'],
  [/github_pat_[A-Za-z0-9_]{10,}/g, 'github_pat_[REDACTED]'],
  [/xox[abprs]-[A-Za-z0-9-]{6,}/g, 'xox-[REDACTED]'],
  [/https:\/\/hooks\.slack\.com\/[^\s"')]+/g, 'https://hooks.slack.com/[REDACTED]'],
  [/((?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*)(\S+)/gi, '$1[REDACTED]'],
];

export function redact(text) {
  return REDACTIONS.reduce((t, [re, rep]) => t.replace(re, rep), String(text));
}

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

try {
  const raw = await readStdin();
  let prompt = raw;
  try {
    const payload = JSON.parse(raw);
    prompt = payload.prompt ?? payload.user_prompt ?? '';
  } catch {
    /* plain text input */
  }
  if (prompt && String(prompt).trim()) {
    const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
    const file = join(root, 'docs', 'AI_LOG.md');
    mkdirSync(dirname(file), { recursive: true });
    if (!existsSync(file)) writeFileSync(file, '# AI log\n\n## Prompt log (auto-appended)\n\n');
    const agent = process.env.CLAUDE_AGENT_NAME ? ` (${process.env.CLAUDE_AGENT_NAME})` : '';
    appendFileSync(file, `### ${new Date().toISOString()}${agent}\n${redact(prompt).trim()}\n\n`);
  }
} catch {
  /* never block the prompt */
}
process.exit(0);
