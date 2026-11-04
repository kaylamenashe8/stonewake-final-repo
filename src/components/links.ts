import type { Locator } from '@playwright/test';

/** The link's href, narrowed to a string: a link the app renders without one is a failure, not a value. */
export async function linkHref(link: Locator): Promise<string> {
  const href = await link.getAttribute('href');
  if (href === null) throw new Error(`Link has no href: ${link.toString()}`);
  return href;
}
