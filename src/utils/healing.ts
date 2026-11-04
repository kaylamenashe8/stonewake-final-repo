import { test, type Locator, type Page } from '@playwright/test';
import { env } from '../config/env';
import { logger } from './logger';

/**
 * Self-healing locator (D5). A page object declares a primary locator plus ordered alternates.
 * - Primary resolves within PRIMARY_TIMEOUT -> used as is.
 * - Else alternates are tried in order, then a fuzzy accessible-name match (similarity >= 0.8).
 * - Exactly one visible match -> used, test annotated `healed`, recorded in heal-report.json (by HealReporter).
 * - Zero or several matches -> the original error is thrown.
 * HEAL_MODE=strict (stability gate): any heal fails the test. HEAL_MODE=off: no healing at all.
 */
export const PRIMARY_TIMEOUT = 3_000;
export const FUZZY_THRESHOLD = 0.8;

export type Strategy = 'role' | 'label' | 'testid' | 'text' | 'css' | 'fuzzy';
type AriaRole = Parameters<Page['getByRole']>[0];

export interface Alternate {
  strategy: Strategy;
  describe: string;
  build: (page: Page) => Locator;
}

export interface ElementSpec {
  /** Human name used in reports: "Cart > Checkout button" */
  element: string;
  primary: (page: Page) => Locator;
  primaryDescribe: string;
  alternates?: Alternate[];
  /** Enables the fuzzy accessible-name rung. */
  fuzzy?: { role: AriaRole; name: string };
}

export interface HealRecord {
  test: string;
  element: string;
  old: string;
  new: string;
  strategy: Strategy;
}

export const HEAL_ANNOTATION = 'healed';

/** Normalised Levenshtein similarity in [0,1]. */
export function similarity(a: string, b: string): number {
  const s = a.trim().toLowerCase();
  const t = b.trim().toLowerCase();
  if (!s.length && !t.length) return 1;
  const dp: number[] = Array.from({ length: t.length + 1 }, (_, j) => j);
  for (let i = 1; i <= s.length; i++) {
    let prev = dp[0] ?? 0;
    dp[0] = i;
    for (let j = 1; j <= t.length; j++) {
      const tmp = dp[j] ?? 0;
      dp[j] = Math.min((dp[j] ?? 0) + 1, (dp[j - 1] ?? 0) + 1, prev + (s[i - 1] === t[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return 1 - (dp[t.length] ?? 0) / Math.max(s.length, t.length);
}

async function visibleCount(locator: Locator): Promise<number> {
  const all = await locator.all();
  let n = 0;
  for (const l of all) if (await l.isVisible()) n++;
  return n;
}

/** Cheap accessible-name approximation: aria-label, visible text, input value, title. */
async function accessibleName(l: Locator): Promise<string> {
  const aria = await l.getAttribute('aria-label');
  if (aria) return aria;
  const text = (await l.innerText().catch(() => '')).trim();
  if (text) return text;
  return (await l.getAttribute('value')) ?? (await l.getAttribute('title')) ?? '';
}

async function resolvesAlone(locator: Locator, timeout: number): Promise<boolean> {
  try {
    await locator.waitFor({ state: 'visible', timeout });
    return (await visibleCount(locator)) === 1;
  } catch {
    return false;
  }
}

export class Healer {
  constructor(private readonly page: Page) {}

  /** Returns a locator for the element, healing if allowed. Throws when nothing unique is found. */
  async locate(spec: ElementSpec): Promise<Locator> {
    const primary = spec.primary(this.page);
    if (env.HEAL_MODE === 'off') return primary;
    if (await resolvesAlone(primary, PRIMARY_TIMEOUT)) return primary;

    for (const alt of spec.alternates ?? []) {
      const candidate = alt.build(this.page);
      if ((await visibleCount(candidate)) === 1) return this.record(spec, candidate, alt.strategy, alt.describe);
    }

    if (spec.fuzzy) {
      const fuzzy = await this.fuzzyMatch(spec.fuzzy.role, spec.fuzzy.name);
      if (fuzzy) return this.record(spec, fuzzy.locator, 'fuzzy', `getByRole('${spec.fuzzy.role}', { name: '${fuzzy.name}' })`);
    }

    // Nothing unique: surface the original failure with Playwright's own message.
    await primary.waitFor({ state: 'visible', timeout: 1_000 });
    return primary;
  }

  private async fuzzyMatch(role: AriaRole, wanted: string): Promise<{ locator: Locator; name: string } | null> {
    const matches: { locator: Locator; name: string }[] = [];
    for (const candidate of await this.page.getByRole(role).all()) {
      if (!(await candidate.isVisible())) continue;
      const name = await accessibleName(candidate);
      if (similarity(name, wanted) >= FUZZY_THRESHOLD) matches.push({ locator: candidate, name: name.trim() });
    }
    return matches.length === 1 ? (matches[0] ?? null) : null;
  }

  private record(spec: ElementSpec, locator: Locator, strategy: Strategy, describe: string): Locator {
    const info = test.info();
    const rec: HealRecord = {
      test: info.titlePath.join(' > '),
      element: spec.element,
      old: spec.primaryDescribe,
      new: describe,
      strategy,
    };
    info.annotations.push({ type: HEAL_ANNOTATION, description: JSON.stringify(rec) });
    logger.warn(`HEALED ${rec.element}: ${rec.old} -> ${rec.new} (${strategy})`);
    if (env.HEAL_MODE === 'strict') {
      throw new Error(
        `Self-heal is not allowed in strict mode (stability gate). Commit a locator fix: ${rec.element}: ${rec.old} -> ${rec.new}`,
      );
    }
    return locator;
  }
}
