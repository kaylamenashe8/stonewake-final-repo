/**
 * GitHub Pages history index. Run inside a checkout of the gh-pages branch (or the folder you publish).
 * Keeps a manifest (runs.json), adds the current run, prunes to the last N entries (deleting pruned
 * folders) and regenerates index.html listing date, kind, branch, commit, result and link.
 *
 *   tsx scripts/pages-index.ts --site <gh-pages dir> --path runs/<run_id> --kind ci|gate \
 *     --status passed|failed --branch main --commit <sha> [--summary "12 passed, 0 failed"] [--keep 30]
 *     [--run-url <actions run url>]
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { arg } from './run-summary';

export interface PagesEntry {
  path: string;
  kind: 'ci' | 'gate';
  status: 'passed' | 'failed';
  branch: string;
  commit: string;
  date: string;
  summary?: string;
  runUrl?: string;
}

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function renderIndex(entries: PagesEntry[], repo?: string): string {
  const rows = entries
    .map(
      (e) => `<tr class="${e.status}">
  <td>${esc(e.date.replace('T', ' ').slice(0, 16))} UTC</td>
  <td>${e.kind === 'gate' ? 'Stability gate' : 'CI'}</td>
  <td>${esc(e.branch)}</td>
  <td><code>${esc(e.commit.slice(0, 7))}</code></td>
  <td><span class="badge ${e.status}">${e.status === 'passed' ? 'PASS' : 'FAIL'}</span> ${esc(e.summary ?? '')}</td>
  <td><a href="${esc(e.path)}/">report</a>${e.runUrl ? ` · <a href="${esc(e.runUrl)}">run</a>` : ''}</td>
</tr>`,
    )
    .join('\n');
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Test report history</title>
<style>
:root{--bg:#fff;--fg:#1b1f24;--muted:#57606a;--line:#d0d7de;--ok:#1a7f37;--bad:#cf222e}
@media (prefers-color-scheme:dark){:root{--bg:#0d1117;--fg:#e6edf3;--muted:#8d96a0;--line:#30363d;--ok:#3fb950;--bad:#f85149}}
body{margin:0;padding:24px 16px;background:var(--bg);color:var(--fg);font:14px/1.5 system-ui,sans-serif}
main{max-width:1000px;margin:auto}h1{font-size:20px;margin:0 0 4px}p{color:var(--muted);margin:0 0 16px}
.wrap{overflow-x:auto}table{border-collapse:collapse;width:100%}th,td{text-align:left;padding:8px;border-bottom:1px solid var(--line);white-space:nowrap}
th{color:var(--muted);font-weight:600}a{color:inherit}.badge{font-weight:700;font-size:12px;padding:2px 6px;border-radius:4px;color:#fff}
.badge.passed{background:var(--ok)}.badge.failed{background:var(--bad)}
</style></head><body><main>
<h1>Test report history${repo ? ` — ${esc(repo)}` : ''}</h1>
<p>Latest: <a href="latest/">latest/</a> · newest first · last ${entries.length} runs kept</p>
<div class="wrap"><table><thead><tr><th>Date</th><th>Kind</th><th>Branch</th><th>Commit</th><th>Result</th><th>Links</th></tr></thead>
<tbody>
${rows}
</tbody></table></div></main></body></html>
`;
}

function main(): void {
  const site = arg('site', 'gh-pages') ?? 'gh-pages';
  const path = arg('path');
  const keep = Number(arg('keep', '30'));
  mkdirSync(site, { recursive: true });
  const manifestPath = join(site, 'runs.json');
  let entries: PagesEntry[] = existsSync(manifestPath)
    ? (JSON.parse(readFileSync(manifestPath, 'utf8')) as PagesEntry[])
    : [];

  if (path) {
    const entry: PagesEntry = {
      path,
      kind: arg('kind') === 'gate' ? 'gate' : 'ci',
      status: arg('status') === 'failed' ? 'failed' : 'passed',
      branch: arg('branch', 'unknown') ?? 'unknown',
      commit: arg('commit', '') ?? '',
      date: new Date().toISOString(),
      ...(arg('summary') ? { summary: arg('summary') } : {}),
      ...(arg('run-url') ? { runUrl: arg('run-url') } : {}),
    };
    entries = [entry, ...entries.filter((e) => e.path !== path)];
  }

  const kept = entries.slice(0, keep);
  for (const old of entries.slice(keep)) {
    const dir = join(site, old.path);
    if (old.path && !old.path.includes('..') && existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  }
  writeFileSync(manifestPath, JSON.stringify(kept, null, 2));
  writeFileSync(join(site, 'index.html'), renderIndex(kept, process.env.GITHUB_REPOSITORY));
  writeFileSync(join(site, '.nojekyll'), '');
  console.log(`index.html: ${kept.length} entries (pruned ${Math.max(0, entries.length - keep)})`);
}

main();
