#!/usr/bin/env node
// Agent status writer for the Control Center (.agents/status/<agent>.json).
// CLI:  node .claude/hooks/status.mjs <agent> <working|blocked|review|done|paused> "<task>" [planItem] [pr] [note]
// Hook: Stop / SubagentStop (JSON on stdin). Marks a "working" agent as "review", refreshes updatedAt.
// Never fails the caller: always exit 0.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const STATES = ['working', 'blocked', 'review', 'done', 'paused'];
const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const dir = join(root, '.agents', 'status');

const safeName = (n) => String(n).toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40);

function read(agent) {
  const file = join(dir, `${agent}.json`);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return null;
  }
}

export function writeStatus(agent, patch) {
  mkdirSync(dir, { recursive: true });
  const name = safeName(agent);
  const prev = read(name) ?? { agent: name, state: 'working', task: '' };
  const next = { ...prev, ...patch, agent: name, updatedAt: new Date().toISOString() };
  for (const k of Object.keys(next)) if (next[k] === undefined || next[k] === '') delete next[k];
  next.task ??= '';
  writeFileSync(join(dir, `${name}.json`), JSON.stringify(next, null, 2) + '\n');
  return next;
}

async function readStdin() {
  if (process.stdin.isTTY) return '';
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

try {
  const [agent, state, task, planItem, pr, note] = process.argv.slice(2);
  if (agent) {
    if (state && !STATES.includes(state)) {
      console.error(`status.mjs: unknown state "${state}" (use ${STATES.join('|')})`);
    } else {
      const s = writeStatus(agent, {
        ...(state ? { state } : {}),
        ...(task !== undefined ? { task } : {}),
        ...(planItem ? { planItem } : {}),
        ...(pr ? { pr } : {}),
        ...(note ? { note } : {}),
      });
      console.log(JSON.stringify(s));
    }
  } else {
    // Hook mode
    const raw = await readStdin();
    let payload = {};
    try {
      payload = raw ? JSON.parse(raw) : {};
    } catch {
      payload = {};
    }
    const name =
      process.env.CLAUDE_AGENT_NAME ?? payload.agent_type ?? payload.subagent_type ?? payload.agent_name ?? null;
    if (name) {
      const prev = read(safeName(name));
      const event = payload.hook_event_name ?? '';
      const patch = prev?.state === 'working' && /SubagentStop|Stop/.test(event || 'Stop') ? { state: 'review' } : {};
      writeStatus(name, patch);
    }
  }
} catch {
  /* degrade gracefully */
}
process.exit(0);
