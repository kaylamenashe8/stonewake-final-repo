import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Screenshot helper with default masks for dynamic content (ads, carousels, timestamps).
 * Baselines are generated ONLY in Docker (docker compose run update-snapshots), never on macOS (D11).
 */
export const DEFAULT_MASKS = [
  '[class*="carousel"]',
  '[class*="slider"]',
  '[class*="ad-"]',
  'iframe',
  'time',
  '[data-dynamic]',
];

export async function expectPageScreenshot(
  page: Page,
  name: string,
  opts: { extraMasks?: string[]; fullPage?: boolean } = {},
): Promise<void> {
  const mask: Locator[] = [...DEFAULT_MASKS, ...(opts.extraMasks ?? [])].map((s) => page.locator(s));
  await expect(page).toHaveScreenshot(`${name}.png`, { mask, fullPage: opts.fullPage ?? false });
}
