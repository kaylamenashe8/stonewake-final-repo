import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { chromium, type Locator, type Page } from '@playwright/test';
import { similarity } from '../src/utils/healing';
import type { Verdict } from './types';
import type { FailedTestEx } from './report';
import { parseReport } from './report';
import { readTrace } from './trace';
import { OUT_DIR, ensureDir, findFiles, slug, truncate, withBudget, writeJson } from './util';
import { isMain } from './util';

/**
 * Rung 3 (D4): reopen the page where the test failed and look for the element it wanted.
 * Found under a new name/position/page → automation (proposes a locator or navigation).
 * Element missing everywhere WITH page errors → product; missing on a healthy page → undecided (state/setup).
 * Page does not load → environment.
 * Budget 3 min per failure, at most 3 failures per run.
 */
export const BUDGET_MS = 3 * 60_000;
export const MAX_FAILURES = 3;
const MAX_PAGES = 15;
const PROPOSE_THRESHOLD = 0.6;

type AriaRole = Parameters<Page['getByRole']>[0];

export interface Target {
  kind: 'role' | 'testid' | 'text' | 'label' | 'placeholder' | 'css';
  role?: string;
  name?: string;
  raw: string;
}

export interface Found {
  url: string;
  locator: string;
  name: string;
  role: string;
  similarity: number;
}

export interface CrawlEvidence {
  test: string;
  startUrl: string;
  loaded: boolean;
  status?: number;
  pageErrors: string[];
  target?: Target;
  originalMatches?: number;
  found: Found[];
  pagesVisited: string[];
  ariaSnapshot?: string;
  screenshot?: string;
  verdict: Verdict;
}

const unquote = (s: string): string => s.replace(/^['"`/]|['"`/]i?$/g, '');

/** Parses the failing locator out of a Playwright error ("waiting for getByRole('button', { name: 'Buy' })"). */
export function parseTarget(error: string): Target | undefined {
  const m =
    /(?:waiting for|Locator:|locator resolved to|violation:)\s*((?:getBy\w+|locator)\([^\n]*?\))(?=\s|$|\.|\n)/.exec(error) ??
    /((?:getBy\w+|locator)\([^\n]*\))/.exec(error);
  const raw = m?.[1];
  if (!raw) return undefined;
  const role = /getByRole\(['"](\w+)['"](?:,\s*\{\s*name:\s*(['"/].*?['"/]i?)\s*(?:,|\}))?/.exec(raw);
  if (role?.[1]) return { kind: 'role', role: role[1], ...(role[2] ? { name: unquote(role[2]) } : {}), raw };
  const simple = /getBy(TestId|Text|Label|Placeholder)\((['"/].*?['"/]i?)\s*[,)]/.exec(raw);
  if (simple?.[1] && simple[2]) {
    const kind = simple[1].toLowerCase() as Target['kind'];
    return { kind, name: unquote(simple[2]), raw };
  }
  const css = /locator\((['"])(.*?)\1/.exec(raw);
  if (css?.[2]) return { kind: 'css', name: css[2], raw };
  return { kind: 'css', raw };
}

const SEARCH_ROLES: AriaRole[] = ['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'tab', 'menuitem', 'heading', 'option', 'switch'];

async function accessibleName(l: Locator): Promise<string> {
  const aria = await l.getAttribute('aria-label').catch(() => null);
  if (aria) return aria.trim();
  const text = (await l.innerText({ timeout: 1_000 }).catch(() => '')).trim();
  if (text) return text.split('\n')[0] ?? text;
  return ((await l.getAttribute('value').catch(() => null)) ?? (await l.getAttribute('placeholder').catch(() => null)) ?? '').trim();
}

/** Counts how many visible elements the original locator matches on this page. */
async function originalMatches(page: Page, t: Target): Promise<number> {
  let loc: Locator;
  switch (t.kind) {
    case 'role':
      loc = page.getByRole(t.role as AriaRole, t.name ? { name: t.name } : {});
      break;
    case 'testid':
      loc = page.getByTestId(t.name ?? '');
      break;
    case 'text':
      loc = page.getByText(t.name ?? '');
      break;
    case 'label':
      loc = page.getByLabel(t.name ?? '');
      break;
    case 'placeholder':
      loc = page.getByPlaceholder(t.name ?? '');
      break;
    case 'css':
      if (!t.name) return 0;
      loc = page.locator(t.name);
  }
  let n = 0;
  for (const l of await loc.all().catch(() => [])) if (await l.isVisible().catch(() => false)) n++;
  return n;
}

async function searchPage(page: Page, t: Target): Promise<Found[]> {
  const wanted = (t.name ?? '').replace(/[-_]/g, ' ');
  if (!wanted) return [];
  const roles = t.kind === 'role' && t.role ? [t.role as AriaRole, ...SEARCH_ROLES.filter((r) => r !== t.role)] : SEARCH_ROLES;
  const found: Found[] = [];
  for (const role of roles) {
    for (const l of (await page.getByRole(role).all().catch(() => [])).slice(0, 80)) {
      if (!(await l.isVisible().catch(() => false))) continue;
      const name = await accessibleName(l);
      if (!name) continue;
      const score = Math.max(similarity(name, wanted), name.toLowerCase().includes(wanted.toLowerCase()) ? 0.85 : 0);
      if (score >= PROPOSE_THRESHOLD) {
        // Same role scores slightly higher so the proposal stays close to the original intent.
        const bonus = t.kind === 'role' && role === t.role ? 0.05 : 0;
        found.push({
          url: page.url(),
          role,
          name,
          similarity: Math.min(1, score + bonus),
          locator: `getByRole('${role}', { name: '${name.replace(/'/g, "\\'")}' })`,
        });
      }
    }
  }
  return found.sort((a, b) => b.similarity - a.similarity).slice(0, 5);
}

function startUrlFor(f: FailedTestEx): string {
  const trace = readTrace(f.tracePath);
  const last = trace.documentUrls[trace.documentUrls.length - 1];
  if (last) return last;
  const gotoUrl = [...trace.actions].reverse().find((a) => a.method === 'goto')?.params.url;
  const base = process.env.BASE_URL ?? 'about:blank';
  return typeof gotoUrl === 'string' ? new URL(gotoUrl, base).toString() : base;
}

function mkVerdict(f: FailedTestEx, v: Omit<Verdict, 'test' | 'file' | 'line' | 'project' | 'rung'>): Verdict {
  return { test: f.test, file: f.file, line: f.line, project: f.project, rung: 'crawler', ...v };
}

async function diagnoseOne(f: FailedTestEx): Promise<CrawlEvidence> {
  const dir = ensureDir(join(OUT_DIR, 'crawl'));
  const id = slug(f.test);
  const startUrl = startUrlFor(f);
  const target = parseTarget(f.error);
  const storageState = existsSync('.auth/user.json') && !/auth|login/i.test(f.file) ? '.auth/user.json' : undefined;
  const browser = await chromium.launch();
  const pageErrors: string[] = [];
  const ev: CrawlEvidence = {
    test: f.test,
    startUrl,
    loaded: false,
    pageErrors,
    ...(target ? { target } : {}),
    found: [],
    pagesVisited: [],
    verdict: mkVerdict(f, { classification: 'undecided', confidence: 0.3, root_cause: 'crawler inconclusive', evidence: [] }),
  };
  try {
    const context = await browser.newContext(storageState ? { storageState } : {});
    const page = await context.newPage();
    page.on('pageerror', (e) => pageErrors.push(e.message));
    const res = await page.goto(startUrl, { timeout: 20_000 }).catch((e: unknown) => {
      ev.verdict = mkVerdict(f, {
        classification: 'environment',
        confidence: 0.8,
        root_cause: `Page does not load: ${String(e).split('\n')[0] ?? ''}`,
        evidence: [`goto ${startUrl} failed`],
      });
      return null;
    });
    if (!res) return ev;
    ev.status = res.status();
    if (res.status() >= 500) {
      ev.verdict = mkVerdict(f, {
        classification: res.status() >= 502 && res.status() <= 504 ? 'environment' : 'product',
        confidence: 0.8,
        root_cause: `Page ${startUrl} returned ${res.status()}.`,
        evidence: [`${res.status()} GET ${startUrl}`],
      });
      return ev;
    }
    ev.loaded = true;
    await page.waitForLoadState('domcontentloaded');
    ev.pagesVisited.push(page.url());
    ev.ariaSnapshot = truncate(await page.locator('body').ariaSnapshot({ timeout: 5_000 }).catch(() => ''), 6_000);
    ev.screenshot = join(dir, `${id}.png`);
    await page.screenshot({ path: ev.screenshot, fullPage: true }).catch(() => undefined);

    if (!target) {
      ev.verdict = pageErrors.length
        ? mkVerdict(f, {
            classification: 'product',
            confidence: 0.75,
            root_cause: 'No locator in the error; the page throws uncaught errors when reopened.',
            evidence: pageErrors.slice(0, 5).map((e) => `pageerror: ${e}`),
          })
        : mkVerdict(f, {
            classification: 'undecided',
            confidence: 0.3,
            root_cause: 'No locator in the error and the page looks healthy: needs Claude.',
            evidence: [`page ${page.url()} loaded with status ${ev.status}`],
          });
      return ev;
    }

    ev.originalMatches = await originalMatches(page, target);
    if (ev.originalMatches > 1) {
      ev.verdict = mkVerdict(f, {
        classification: 'automation',
        confidence: 0.85,
        root_cause: `Locator ${target.raw} matches ${ev.originalMatches} visible elements (strict mode). Scope it inside a component or use a more specific name.`,
        evidence: [`${ev.originalMatches} matches on ${page.url()}`],
        proposed_fix: `Scope ${target.raw} to its container, e.g. page.getByRole('region', { name: '…' }).${target.raw}`,
      });
      return ev;
    }
    if (ev.originalMatches === 1) {
      ev.verdict = mkVerdict(f, {
        classification: 'automation',
        confidence: 0.7,
        root_cause: `Element ${target.raw} exists when the page is reopened: likely a timing/wait or a missing step before it, not a product fault.`,
        evidence: [`original locator resolves on ${page.url()}`],
        proposed_fix: `Wait with a web-first assertion (await expect(${target.raw}).toBeVisible()) or the response that renders it, and check the preceding step.`,
      });
      return ev;
    }

    ev.found.push(...(await searchPage(page, target)));
    // Same-origin pages within depth 2.
    const origin = new URL(page.url()).origin;
    const queue: { url: string; depth: number }[] = [];
    const seen = new Set([page.url().split('#')[0]]);
    const enqueue = async (depth: number): Promise<void> => {
      const hrefs = await page
        .locator('a[href]')
        .evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).href))
        .catch(() => [] as string[]);
      for (const h of hrefs) {
        const clean = h.split('#')[0] ?? h;
        if (!clean.startsWith(origin) || seen.has(clean) || /logout|sign-?out|delete|remove/i.test(clean)) continue;
        seen.add(clean);
        queue.push({ url: clean, depth });
      }
    };
    if (!ev.found.length) await enqueue(1);
    while (!ev.found.length && queue.length && ev.pagesVisited.length < MAX_PAGES) {
      const next = queue.shift();
      if (!next) break;
      const r = await page.goto(next.url, { timeout: 15_000 }).catch(() => null);
      if (!r) continue;
      ev.pagesVisited.push(page.url());
      ev.found.push(...(await searchPage(page, target)));
      if (next.depth < 2) await enqueue(next.depth + 1);
    }

    const best = ev.found[0];
    if (best) {
      const samePage = best.url.split('#')[0] === startUrl.split('#')[0];
      ev.verdict = mkVerdict(f, {
        classification: 'automation',
        confidence: Math.min(0.95, 0.6 + 0.3 * best.similarity),
        root_cause: samePage
          ? `Element not found as ${target.raw}; a close match exists on the same page: ${best.locator}.`
          : `Element not on ${startUrl}; found on ${best.url} as ${best.locator}: navigation changed or a step is missing.`,
        evidence: ev.found.map((x) => `${x.similarity.toFixed(2)} ${x.locator} @ ${x.url}`),
        proposed_fix: samePage
          ? `Replace ${target.raw} with ${best.locator} in the page object.`
          : `Navigate to ${new URL(best.url).pathname} before the step, then use ${best.locator}.`,
      });
    } else if (!pageErrors.length) {
      // Missing everywhere on a healthy page is usually missing state (test order, leftover data, a skipped
      // step), not a product fault. Calling it product would skip the test with a false Spira bug (D9).
      ev.verdict = mkVerdict(f, {
        classification: 'undecided',
        confidence: 0.4,
        root_cause: `Element ${target.raw} is missing on ${startUrl} (${ev.pagesVisited.length} page(s) searched), but the page reports no errors: check the test's own setup, data and whether it depends on another test.`,
        evidence: [`pages searched: ${ev.pagesVisited.length}`, 'no page errors, no failed requests'],
      });
    } else {
      ev.verdict = mkVerdict(f, {
        classification: 'product',
        confidence: 0.8,
        root_cause: `Element ${target.raw} is missing on ${startUrl} and on ${ev.pagesVisited.length - 1} same-origin page(s) within depth 2.`,
        evidence: [
          `pages searched: ${ev.pagesVisited.length}`,
          ...pageErrors.slice(0, 3).map((e) => `pageerror: ${e}`),
        ],
        bug_draft: {
          title: `${target.name ?? target.raw}: element missing`,
          steps: [`Open ${startUrl}`, `Look for ${target.raw}`],
          expected: `${target.name ?? 'The element'} is shown`,
          actual: 'The element is not on the page or any linked page',
          severity: 'medium',
        },
      });
    }
    return ev;
  } finally {
    await browser.close();
  }
}

export async function crawlerDiagnose(f: FailedTestEx): Promise<CrawlEvidence> {
  const fallback: CrawlEvidence = {
    test: f.test,
    startUrl: '',
    loaded: false,
    pageErrors: [],
    found: [],
    pagesVisited: [],
    verdict: mkVerdict(f, {
      classification: 'undecided',
      confidence: 0.2,
      root_cause: `Crawler budget (${BUDGET_MS / 1000}s) exceeded`,
      evidence: [],
    }),
  };
  return withBudget(
    BUDGET_MS,
    diagnoseOne(f).catch((e: unknown) => ({ ...fallback, verdict: { ...fallback.verdict, root_cause: `Crawler error: ${String(e)}` } })),
    fallback,
  );
}

/** Local helper: find the test in results.json, or run it once to get a fresh failure. */
function findOrRun(arg: string): FailedTestEx | undefined {
  const all = findFiles('test-results', 'results.json').flatMap(parseReport);
  const match = (f: FailedTestEx): boolean => f.test.includes(arg) || `${f.file}:${f.line}` === arg || f.file === arg;
  const known = all.find(match);
  if (known) return known;
  const dir = join(OUT_DIR, 'diagnose-run');
  const json = join(dir, 'results.json');
  const isPath = /\.spec\.ts(:\d+)?$/.test(arg);
  spawnSync(
    'npx',
    ['playwright', 'test', ...(isPath ? [arg] : ['-g', arg]), '--project=chromium', '--retries=0', '--workers=1', '--trace=on', '--reporter=json', `--output=${join(dir, 'test-results')}`],
    { env: { ...process.env, PLAYWRIGHT_JSON_OUTPUT_NAME: json, FORCE_COLOR: '0' }, stdio: 'inherit' },
  );
  return existsSync(json) ? parseReport(json)[0] : undefined;
}

/* CLI: npm run diagnose -- <test title | file:line>   (or no arg: the first 3 failures in test-results) */
async function main(): Promise<void> {
  const arg = process.argv[2];
  const targets = arg
    ? [findOrRun(arg)].filter((x): x is FailedTestEx => Boolean(x))
    : findFiles('test-results', 'results.json').flatMap(parseReport).slice(0, MAX_FAILURES);
  if (!targets.length) {
    console.log(arg ? `No failure found for "${arg}" (it passed, or the name did not match).` : 'No failures in test-results.');
    return;
  }
  const evidence: CrawlEvidence[] = [];
  for (const f of targets) {
    const ev = await crawlerDiagnose(f);
    evidence.push(ev);
    const v = ev.verdict;
    console.log(`\n${f.test}\n  verdict: ${v.classification} (${v.confidence.toFixed(2)})\n  cause:   ${v.root_cause}`);
    if (v.proposed_fix) console.log(`  fix:     ${v.proposed_fix}`);
  }
  writeJson(join(OUT_DIR, 'crawl-evidence.json'), evidence);
  console.log(`\nEvidence → ${join(OUT_DIR, 'crawl-evidence.json')}`);
}

if (isMain(import.meta.url)) {
  main().catch((e: unknown) => {
    console.error(e);
    process.exit(1);
  });
}
