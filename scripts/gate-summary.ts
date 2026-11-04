/**
 * Stability Gate summary (D2/D3/D5). Reads N run folders, each holding results.json + heal-report.json:
 *   <dir>/run-1/results.json, <dir>/run-1/heal-report.json, ... <dir>/run-5/...
 * A run is green only with 0 failed, 0 flaky and 0 heals. Prints `GATE: 5/5 GREEN` or the failing runs,
 * writes the table to the job summary and <dir>/gate-summary.json, exits 1 when red.
 *
 *   tsx scripts/gate-summary.ts --dir gate-results [--runs 5] [--report-url <url>] [--mode parallel]
 */
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { arg, fmtDuration, summarize, writeSummary, type RunSummary } from './run-summary';

export interface GateRow extends Partial<RunSummary> {
  run: number;
  green: boolean;
  missing: boolean;
}

export interface GateResult {
  green: boolean;
  greenRuns: number;
  totalRuns: number;
  verdict: string;
  rows: GateRow[];
}

function findFile(dir: string, name: string): string {
  const direct = join(dir, name);
  if (existsSync(direct)) return direct;
  const nested = join(dir, 'test-results', name);
  return existsSync(nested) ? nested : direct;
}

export function computeGate(dir: string, runs: number): GateResult {
  const rows: GateRow[] = [];
  for (let n = 1; n <= runs; n++) {
    const runDir = join(dir, `run-${n}`);
    const sum = summarize(findFile(runDir, 'results.json'), findFile(runDir, 'heal-report.json'));
    if (!sum) {
      rows.push({ run: n, green: false, missing: true });
      continue;
    }
    rows.push({ run: n, missing: false, ...sum, green: sum.failed === 0 && sum.flaky === 0 && sum.healed === 0 });
  }
  const greenRuns = rows.filter((r) => r.green).length;
  const green = greenRuns === runs;
  const red = rows.filter((r) => !r.green).map((r) => `run-${r.run}${r.missing ? ' (no results)' : ''}`);
  const verdict = green ? `GATE: ${runs}/${runs} GREEN` : `GATE: ${greenRuns}/${runs} — RED in ${red.join(', ')}`;
  return { green, greenRuns, totalRuns: runs, verdict, rows };
}

function main(): void {
  const dir = arg('dir', 'gate-results') ?? 'gate-results';
  const runs = Number(arg('runs', '5'));
  const reportUrl = arg('report-url');
  const mode = arg('mode', 'parallel');
  const gate = computeGate(dir, runs);

  const lines = [
    `## Stability Gate (${mode ?? 'parallel'}, retries 0, HEAL_MODE=strict)`,
    '',
    `### ${gate.green ? '✅' : '❌'} ${gate.verdict}`,
    '',
    '| Run | Passed | Failed | Flaky | Skipped | Healed | Duration | Result |',
    '| --- | --- | --- | --- | --- | --- | --- | --- |',
    ...gate.rows.map((r) =>
      r.missing
        ? `| run-${r.run} | – | – | – | – | – | – | ❌ no results |`
        : `| run-${r.run} | ${r.passed ?? 0} | ${r.failed ?? 0} | ${r.flaky ?? 0} | ${r.skipped ?? 0} | ${r.healed ?? 0} | ${fmtDuration(r.durationMs ?? 0)} | ${r.green ? '✅' : '❌'} |`,
    ),
  ];
  if (reportUrl) lines.push('', `Reports: ${reportUrl}`);
  const failures = gate.rows.flatMap((r) => (r.failures ?? []).map((f) => `- run-${r.run}: ${f.test} — ${f.error}`));
  if (failures.length) lines.push('', '### Failures', '', ...failures.slice(0, 30));
  const bugs = gate.rows[0]?.skippedWithBug ?? [];
  if (bugs.length) lines.push('', '### Skipped on known product bugs', '', ...bugs.map((b) => `- ${b.test}: ${b.bug}`));

  writeSummary(lines.join('\n'));
  writeFileSync(join(dir, 'gate-summary.json'), JSON.stringify(gate, null, 2));
  console.log(gate.verdict);
  if (!gate.green) process.exitCode = 1;
}

// Module-type agnostic entry check (works whether the target repo is ESM or CJS).
if (/gate-summary\.ts$/.test(process.argv[1] ?? '')) main();
