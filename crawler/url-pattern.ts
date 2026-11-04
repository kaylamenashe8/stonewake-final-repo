/**
 * URL normalisation: each URL pattern is visited once.
 * /product/123 -> /product/:id, UUIDs -> :uuid, long hex hashes -> :hash, slugs with digits stay.
 * Query is dropped except keys that change the page meaningfully (page, q, search, sort, category, tab).
 */
const KEEP_QUERY = new Set(['page', 'q', 'search', 'query', 'sort', 'category', 'tab', 'type', 'view']);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NUM = /^\d+$/;
const HASH = /^[0-9a-f]{16,}$/i;
const MIXED_ID = /^(?=.*\d)[a-z0-9_-]{20,}$/i;

export function normalizeSegment(seg: string): string {
  if (UUID.test(seg)) return ':uuid';
  if (NUM.test(seg)) return ':id';
  if (HASH.test(seg)) return ':hash';
  if (MIXED_ID.test(seg)) return ':token';
  return seg;
}

export function urlPattern(raw: string): string {
  const u = new URL(raw);
  const path = u.pathname
    .split('/')
    .map((s) => (s ? normalizeSegment(decodeURIComponent(s)) : s))
    .join('/');
  const kept = [...u.searchParams.keys()].filter((k) => KEEP_QUERY.has(k.toLowerCase())).sort();
  const query = kept.length ? `?${kept.map((k) => `${k}=*`).join('&')}` : '';
  return `${path || '/'}${query}`;
}

/** Same-origin check, ignoring non-http(s) and fragments. */
export function sameOrigin(href: string, base: string): boolean {
  try {
    const u = new URL(href, base);
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/** Canonical URL used for fetching (no fragment). */
export function canonical(href: string, base: string): string {
  const u = new URL(href, base);
  u.hash = '';
  return u.toString();
}

/** Click/submit deny-list: never exercised by the crawler or generated tests without review. */
export const DENY = /log ?out|sign ?out|delete|remove|cancel|\bpay\b|payment|confirm order|place order|purchase|admin|unsubscribe|reset app/i;
