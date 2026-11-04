import type { PageRecord } from './crawl';

/** Free bug signals from the crawl -> crawler/out/signals.md (input for the Bug Reporter). */
export function signalsMarkdown(pages: PageRecord[], base: string): string {
  const rows: string[] = [];
  const add = (kind: string, page: string, detail: string): void => {
    rows.push(`| ${kind} | \`${page}\` | ${detail.replace(/\|/g, '\\|').replace(/\n/g, ' ').slice(0, 240)} |`);
  };
  for (const p of pages) {
    if (p.status >= 500) add('5xx page', p.pattern, `HTTP ${p.status} ${p.url}`);
    else if (p.status >= 400) add('broken link (4xx)', p.pattern, `HTTP ${p.status} ${p.url} (from ${p.referrer ?? 'start'})`);
    for (const c of p.consoleErrors) add('console error', p.pattern, c);
    for (const f of p.failedRequests) add('failed request', p.pattern, f);
    for (const x of p.xhr.filter((r) => r.status >= 500)) add('5xx XHR', p.pattern, `${x.method} ${x.urlPattern} -> ${x.status}`);
    if (p.loadMs > 3000) add('slow page', p.pattern, `${p.loadMs} ms (> 3000)`);
    for (const v of p.axe ?? []) add(`axe ${v.impact}`, p.pattern, `${v.id}: ${v.help} (${v.nodes} nodes)`);
  }
  const header = [
    `# Crawl signals`,
    '',
    `Base: ${base} · generated ${new Date().toISOString()} · ${pages.length} pages · ${rows.length} signals`,
    '',
    'Each row is a candidate for the Bug Reporter: reproduce manually with Jam before drafting a Spira bug.',
    '',
    '| Signal | Page | Detail |',
    '| --- | --- | --- |',
  ];
  return [...header, ...(rows.length ? rows : ['| none | | |'])].join('\n') + '\n';
}
