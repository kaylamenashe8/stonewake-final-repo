import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import { HEAL_ANNOTATION, type HealRecord } from './healing';

/** Collects `healed` annotations into heal-report.json (race-free: runs in the main process). */
export default class HealReporter implements Reporter {
  private readonly heals: HealRecord[] = [];
  constructor(private readonly options: { outputFile?: string } = {}) {}

  onTestEnd(test: TestCase, result: TestResult): void {
    for (const a of [...test.annotations, ...result.annotations]) {
      if (a.type === HEAL_ANNOTATION && a.description) {
        const rec = JSON.parse(a.description) as HealRecord;
        if (!this.heals.some((h) => h.test === rec.test && h.element === rec.element)) this.heals.push(rec);
      }
    }
  }

  onEnd(): void {
    const file = this.options.outputFile ?? 'test-results/heal-report.json';
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ count: this.heals.length, heals: this.heals }, null, 2));
  }
}
