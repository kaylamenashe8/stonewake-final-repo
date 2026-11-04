/** Shared triage contract (D4). Every failure gets exactly one verdict. */
export type Classification = 'flaky' | 'automation' | 'product' | 'environment';
export type Rung = 'rerun' | 'classifier' | 'crawler' | 'claude';

export interface BugDraft {
  title: string;
  steps: string[];
  expected: string;
  actual: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
}

export interface Verdict {
  /** "file.spec.ts > describe > title" */
  test: string;
  file: string;
  line?: number;
  project?: string;
  classification: Classification | 'undecided';
  confidence: number; // 0..1
  rung: Rung;
  signature?: string;
  root_cause: string;
  evidence: string[];
  proposed_fix?: string; // unified diff or plain instruction
  bug_draft?: BugDraft;
  rerun?: { passed: number; failed: number };
}

/** A failed test pulled out of Playwright's JSON report. */
export interface FailedTest {
  test: string;
  file: string;
  line: number;
  project: string;
  error: string;
  stack?: string;
  tracePath?: string;
  screenshotPath?: string;
  stdout?: string;
}
