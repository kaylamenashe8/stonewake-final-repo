import type { Locator, Page } from '@playwright/test';

/** Reused UI part. Components scope their locators to a root, so CSS is allowed inside. */
export class Header {
  readonly root: Locator;
  constructor(page: Page) {
    this.root = page.getByRole('banner').or(page.locator('header')).first();
  }

  navLinks(): Locator {
    return this.root.getByRole('link');
  }
}
