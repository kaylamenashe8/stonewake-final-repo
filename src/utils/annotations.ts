import { test } from '@playwright/test';

/**
 * D9: a test that fails on a confirmed product bug is skipped with its SpiraTest ID.
 * Usage (first line inside the test):  knownBug('SPIRA-123', 'Cart: total ignores quantity', SPIRA_URL)
 * The HTML report then shows the skip reason and a clickable bug annotation.
 */
export function knownBug(spiraId: string, title: string, url?: string): void {
  test.info().annotations.push({ type: 'bug', description: `${spiraId} ${url ?? ''}`.trim() });
  test.skip(true, `${spiraId}: ${title}`);
}

/** Traceability to STP requirement IDs (REQ-AUTH-01). */
export function requirement(...ids: string[]): void {
  for (const id of ids) test.info().annotations.push({ type: 'requirement', description: id });
}

/** Marks a test promoted from the crawler pipeline (docs/AI_LOG.md has the reviewing commit). */
export function aiGenerated(reviewCommit: string): void {
  test.info().annotations.push({ type: 'ai-generated', description: `human-reviewed in ${reviewCommit}` });
}
