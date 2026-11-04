/**
 * Site-map crawler (D8). Runs locally, out of band; never part of CI or the gate.
 *   npm run crawl -- [--base https://x] [--max-pages 150] [--max-depth 3] [--no-axe] [--delay 1000]
 * Read-only: it follows links and records forms/actions; it never clicks buttons or submits forms.
 * Links matching the deny-list (logout, delete, pay, admin...) are recorded but never followed.
 */
import { mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { parseArgs } from 'node:util';
import { chromium, type Browser, type Page, type Response } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { DENY, canonical, sameOrigin, urlPattern } from './url-pattern';
import { signalsMarkdown } from './signals';

export interface FormField {
  name: string;
  type: string;
  label: string;
  required: boolean;
}
export interface FormRecord {
  action: string;
  method: string;
  fields: FormField[];
  submit: string;
}
export interface ActionRecord {
  role: string;
  name: string;
  denied: boolean;
  /** Set by click discovery when clicking it changed the URL (SPA routes without hrefs). */
  navigatesTo?: string;
}
export interface XhrRecord {
  method: string;
  url: string;
  urlPattern: string;
  status: number;
  contentType: string;
  requestBody?: string;
  responseBody?: string;
}
export interface AxeViolation {
  id: string;
  impact: string;
  help: string;
  nodes: number;
}
export interface PageRecord {
  url: string;
  pattern: string;
  depth: number;
  referrer?: string;
  status: number;
  title: string;
  loadMs: number;
  ariaSnapshot: string;
  forms: FormRecord[];
  actions: ActionRecord[];
  links: string[];
  deniedLinks: string[];
  consoleErrors: string[];
  failedRequests: string[];
  xhr: XhrRecord[];
  axe?: AxeViolation[];
}

/** Click discovery never touches deny-listed actions, nor ones that look like they change data. */
const MUTATING = /add|save|submit|update|edit|send|post|create|buy|checkout|continue|finish|apply|upload/i;

const BODY_LIMIT = 2_000;
const ARIA_LIMIT = 6_000;
const OUT = 'crawler/out';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

const { values: args } = parseArgs({
  options: {
    base: { type: 'string' },
    'max-pages': { type: 'string', default: '150' },
    'max-depth': { type: 'string', default: '3' },
    delay: { type: 'string', default: '1000' },
    'no-axe': { type: 'boolean', default: false },
    'storage-state': { type: 'string', default: '.auth/user.json' },
    start: { type: 'string', default: '/' },
    headed: { type: 'boolean', default: false },
    'click-limit': { type: 'string', default: '8' },
    'no-click': { type: 'boolean', default: false },
  },
  allowPositionals: true,
});

async function pageFacts(page: Page): Promise<Pick<PageRecord, 'forms' | 'actions' | 'links'>> {
  // tsx/esbuild wraps named functions in __name(); define it in the page so evaluate() bodies run.
  await page.evaluate('globalThis.__name = globalThis.__name || ((f) => f)');
  return page.evaluate(() => {
    // tsconfig lib has DOM but not DOM.Iterable, so NodeLists go through Array.from.
    const all = (sel: string, root: ParentNode = document): Element[] => Array.from(root.querySelectorAll(sel));
    const text = (el: Element | null): string => (el?.textContent ?? '').replace(/\s+/g, ' ').trim();
    const nameOf = (el: Element): string =>
      el.getAttribute('aria-label') ??
      (text(el) || (el as HTMLInputElement).value || el.getAttribute('title') || el.getAttribute('placeholder') || '');
    const labelFor = (el: Element): string => {
      const id = el.getAttribute('id');
      const lbl = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : el.closest('label');
      return text(lbl) || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '';
    };
    const forms = all('form').map((f) => ({
      action: f.getAttribute('action') ?? '',
      method: (f.getAttribute('method') ?? 'get').toLowerCase(),
      fields: all('input, select, textarea', f)
        .filter((i) => (i as HTMLInputElement).type !== 'hidden')
        .map((i) => ({
          name: i.getAttribute('name') ?? i.getAttribute('id') ?? '',
          type: i.tagName === 'INPUT' ? (i as HTMLInputElement).type : i.tagName.toLowerCase(),
          label: labelFor(i),
          required: (i as HTMLInputElement).required || i.getAttribute('aria-required') === 'true',
        })),
      submit: nameOf(f.querySelector('[type="submit"], button:not([type="button"])') ?? f),
    }));
    // Loose forms (SPAs without <form>): group visible inputs into one pseudo-form.
    const loose = all('input, select, textarea').filter(
      (i) => !i.closest('form') && (i as HTMLInputElement).type !== 'hidden',
    );
    if (loose.length)
      forms.push({
        action: '(no form element)',
        method: 'js',
        fields: loose.map((i) => ({
          name: i.getAttribute('name') ?? i.getAttribute('id') ?? '',
          type: i.tagName === 'INPUT' ? (i as HTMLInputElement).type : i.tagName.toLowerCase(),
          label: labelFor(i),
          required: (i as HTMLInputElement).required,
        })),
        submit: '',
      });
    const visible = (el: Element): boolean => {
      const r = el.getBoundingClientRect();
      return r.width > 0 && r.height > 0;
    };
    const actions = [
      ...all('button, [role="button"], input[type="submit"], input[type="button"], a[href]'),
    ]
      .filter(visible)
      .map((el) => ({
        role: el.getAttribute('role') ?? (el.tagName === 'A' && el.hasAttribute('href') ? 'link' : 'button'),
        name: nameOf(el).slice(0, 80),
      }))
      .filter((a) => a.name);
    const links = all('a[href]').map((a) => (a as HTMLAnchorElement).href);
    const unique = actions.filter((a, i) => actions.findIndex((b) => b.role === a.role && b.name === a.name) === i);
    return { forms, actions: unique.map((a) => ({ ...a, denied: false })), links };
  });
}

async function main(): Promise<void> {
  if (args.base) process.env.BASE_URL = args.base;
  const { env } = await import('../src/config/env');
  const base = args.base ?? env.BASE_URL;
  const maxPages = Number(args['max-pages']);
  const maxDepth = Number(args['max-depth']);
  const delay = Number(args.delay);
  const storage = args['storage-state'];

  const browser = await chromium.launch({ headless: !args.headed });
  const context = await browser.newContext({
    baseURL: base,
    locale: env.LOCALE,
    timezoneId: env.TIMEZONE,
    viewport: { width: 1366, height: 900 },
    ...(storage && existsSync(storage) ? { storageState: storage } : {}),
  });
  console.log(`crawl ${base} (max ${maxPages} pages, depth ${maxDepth}, ${storage && existsSync(storage) ? 'logged in' : 'anonymous'})`);

  const appOrigins = new Set([new URL(base).origin, ...(env.API_URL ? [new URL(env.API_URL).origin] : [])]);
  const clickLimit = args['no-click'] ? 0 : Number(args['click-limit']);
  const probed = new Set<string>();
  const seen = new Set<string>();
  const queue: { url: string; depth: number; referrer?: string }[] = [{ url: canonical(args.start, base), depth: 0 }];
  const pages: PageRecord[] = [];

  while (queue.length && pages.length < maxPages) {
    const next = queue.shift();
    if (!next) break;
    const pattern = urlPattern(next.url);
    if (seen.has(pattern)) continue;
    seen.add(pattern);

    const page = await context.newPage();
    const consoleErrors: string[] = [];
    const failedRequests: string[] = [];
    const xhr: XhrRecord[] = [];
    const pending: Promise<void>[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 300));
    });
    page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message.slice(0, 300)}`));
    page.on('requestfailed', (r) => failedRequests.push(`${r.method()} ${r.url()} ${r.failure()?.errorText ?? ''}`));
    page.on('response', (res: Response) => {
      const req = res.request();
      const type = req.resourceType();
      if (res.status() >= 400 && type !== 'document') failedRequests.push(`${req.method()} ${res.url()} -> ${res.status()}`);
      if (type !== 'xhr' && type !== 'fetch') return;
      if (!appOrigins.has(new URL(res.url()).origin)) return; // skip fonts, analytics, CDNs
      pending.push(
        (async () => {
          const contentType = res.headers()['content-type'] ?? '';
          let responseBody: string | undefined;
          if (/json|text|xml/.test(contentType)) responseBody = (await res.text().catch(() => '')).slice(0, BODY_LIMIT);
          xhr.push({
            method: req.method(),
            url: res.url(),
            urlPattern: urlPattern(res.url()),
            status: res.status(),
            contentType,
            ...(req.postData() ? { requestBody: (req.postData() ?? '').slice(0, BODY_LIMIT) } : {}),
            ...(responseBody === undefined ? {} : { responseBody }),
          });
        })(),
      );
    });

    const started = Date.now();
    let status = 0;
    try {
      const resp = await page.goto(next.url, { waitUntil: 'load', timeout: 30_000 });
      status = resp?.status() ?? 0;
    } catch (e) {
      consoleErrors.push(`navigation: ${(e as Error).message.split('\n')[0] ?? ''}`);
    }
    const loadMs = Date.now() - started;
    // Let late XHRs land without a hard dependency on networkidle.
    await page.waitForLoadState('networkidle', { timeout: 3_000 }).catch(() => undefined);
    await Promise.allSettled(pending);

    const landed = page.url();
    if (!sameOrigin(landed, base)) {
      console.log(`  skip (left origin): ${next.url} -> ${landed}`);
      await page.close();
      continue;
    }
    const facts = await pageFacts(page).catch((e: unknown) => {
      console.log(`  facts failed: ${String(e).split('\n')[0] ?? ''}`);
      return { forms: [], actions: [], links: [] };
    });
    const ariaSnapshot = (await page.locator('body').ariaSnapshot().catch(() => '')).slice(0, ARIA_LIMIT);
    let axe: AxeViolation[] | undefined;
    if (!args['no-axe']) {
      axe = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa'])
        .analyze()
        .then((r) =>
          r.violations
            .filter((v) => v.impact === 'critical' || v.impact === 'serious')
            .map((v) => ({ id: v.id, impact: v.impact ?? '', help: v.help, nodes: v.nodes.length })),
        )
        .catch(() => undefined);
    }

    const links: string[] = [];
    const deniedLinks: string[] = [];
    for (const href of new Set(facts.links)) {
      if (!sameOrigin(href, base)) continue;
      const c = canonical(href, base);
      if (DENY.test(c)) {
        deniedLinks.push(c);
        continue;
      }
      links.push(c);
      if (next.depth < maxDepth && !seen.has(urlPattern(c))) queue.push({ url: c, depth: next.depth + 1, referrer: next.url });
    }

    // Click discovery for SPA routes: each probe runs in a throwaway context, so any state change is discarded.
    const discovered = new Map<string, string>();
    const candidates = facts.actions
      .filter((a) => !DENY.test(a.name) && !MUTATING.test(a.name) && !probed.has(`${a.role}:${a.name}`))
      .slice(0, clickLimit);
    for (const a of candidates) {
      probed.add(`${a.role}:${a.name}`);
      const target = await probeClick(browser, storage, landed, a.role as Parameters<Page['getByRole']>[0], a.name, base);
      if (!target) continue;
      discovered.set(`${a.role}:${a.name}`, target);
      if (next.depth < maxDepth && !seen.has(urlPattern(target)))
        queue.push({ url: target, depth: next.depth + 1, referrer: landed });
    }

    const rec: PageRecord = {
      url: landed,
      pattern: urlPattern(landed),
      depth: next.depth,
      ...(next.referrer ? { referrer: next.referrer } : {}),
      status,
      title: await page.title().catch(() => ''),
      loadMs,
      ariaSnapshot,
      forms: facts.forms,
      actions: facts.actions.map((a) => {
        const to = discovered.get(`${a.role}:${a.name}`);
        return { ...a, denied: DENY.test(a.name), ...(to ? { navigatesTo: urlPattern(to) } : {}) };
      }),
      links,
      deniedLinks,
      consoleErrors,
      failedRequests,
      xhr,
      ...(axe ? { axe } : {}),
    };
    seen.add(rec.pattern); // redirects: mark the landed pattern too
    pages.push(rec);
    console.log(`  [${pages.length}] d${next.depth} ${status} ${rec.pattern} (${loadMs} ms, ${xhr.length} xhr)`);
    await page.close();
    await sleep(delay);
  }

  await browser.close();
  mkdirSync(OUT, { recursive: true });

  const api = new Map<string, { method: string; urlPattern: string; statuses: number[]; usedBy: Set<string> }>();
  for (const p of pages)
    for (const x of p.xhr) {
      const key = `${x.method} ${x.urlPattern}`;
      const e = api.get(key) ?? { method: x.method, urlPattern: x.urlPattern, statuses: [], usedBy: new Set<string>() };
      if (!e.statuses.includes(x.status)) e.statuses.push(x.status);
      e.usedBy.add(p.pattern);
      api.set(key, e);
    }
  const endpoints = [...api.values()].map((e) => ({ ...e, usedBy: [...e.usedBy] }));

  writeFileSync(`${OUT}/site-map.json`, JSON.stringify({ base, generatedAt: new Date().toISOString(), pages, endpoints }, null, 2));
  writeFileSync(`${OUT}/site-map.md`, siteMapMarkdown(base, pages, endpoints));
  writeFileSync(`${OUT}/signals.md`, signalsMarkdown(pages, base));
  console.log(`done: ${pages.length} pages, ${endpoints.length} API endpoints -> ${OUT}/site-map.{json,md}, signals.md`);
}

async function probeClick(
  browser: Browser,
  storage: string | undefined,
  url: string,
  role: Parameters<Page['getByRole']>[0],
  name: string,
  base: string,
): Promise<string | null> {
  const ctx = await browser.newContext({ ...(storage && existsSync(storage) ? { storageState: storage } : {}) });
  try {
    const p = await ctx.newPage();
    await p.goto(url, { waitUntil: 'load', timeout: 20_000 });
    const primary = p.getByRole(role, { name, exact: true });
    const target = (await primary.count()) ? primary : p.getByRole(role === 'link' ? 'button' : 'link', { name, exact: true });
    await target.first().click({ timeout: 3_000 });
    await p.waitForURL((u) => u.toString() !== url, { timeout: 2_500 });
    const to = canonical(p.url(), base);
    return sameOrigin(to, base) && !DENY.test(to) ? to : null;
  } catch {
    return null;
  } finally {
    await ctx.close();
  }
}

function siteMapMarkdown(
  base: string,
  pages: PageRecord[],
  endpoints: { method: string; urlPattern: string; statuses: number[]; usedBy: string[] }[],
): string {
  const lines = [
    '# Site map',
    '',
    `Base: ${base} · ${new Date().toISOString()} · ${pages.length} page patterns · ${endpoints.length} API endpoints`,
    '',
    '## Pages',
    '',
    '| Pattern | Title | Status | Load ms | Forms (fields) | Actions | Console errors |',
    '| --- | --- | --- | --- | --- | --- | --- |',
    ...pages.map(
      (p) =>
        `| \`${p.pattern}\` | ${p.title.replace(/\|/g, '/')} | ${p.status} | ${p.loadMs} | ${p.forms
          .map((f) => f.fields.length)
          .join(', ') || '-'} | ${p.actions.filter((a) => a.role === 'button').map((a) => (a.denied ? `~~${a.name}~~` : a.name)).slice(0, 6).join(', ').replace(/\|/g, '/') || '-'} | ${p.consoleErrors.length} |`,
    ),
    '',
    '## API endpoints (from XHR/fetch)',
    '',
    '| Method | Pattern | Statuses | Used by |',
    '| --- | --- | --- | --- |',
    ...endpoints.map((e) => `| ${e.method} | \`${e.urlPattern}\` | ${e.statuses.join(', ')} | ${e.usedBy.map((u) => `\`${u}\``).join(' ')} |`),
    '',
    '## Forms',
    '',
    ...pages.flatMap((p) =>
      p.forms.map(
        (f) =>
          `- \`${p.pattern}\` ${f.method.toUpperCase()} ${f.action || '(self)'}: ${f.fields
            .map((x) => `${x.label || x.name} (${x.type}${x.required ? ', required' : ''})`)
            .join('; ')}${f.submit ? ` → "${f.submit}"` : ''}`,
      ),
    ),
    '',
    '## Navigation found by click discovery',
    '',
    ...pages.flatMap((p) =>
      p.actions.filter((a) => a.navigatesTo).map((a) => `- \`${p.pattern}\` ${a.role} "${a.name}" → \`${a.navigatesTo ?? ''}\``),
    ),
    '',
    'Struck-through actions match the deny-list and are never exercised.',
  ];
  return lines.join('\n') + '\n';
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});
