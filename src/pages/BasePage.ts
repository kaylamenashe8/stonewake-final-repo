import { expect, type Locator, type Page } from '@playwright/test';
import { Healer, type ElementSpec } from '../utils/healing';

/**
 * Every page object extends BasePage.
 * Rules: expose intent (cart.addItem(name)), not clicks; return locators or state; never assert business
 * outcomes here (assertions live in tests). One locator per element, declared once as an ElementSpec.
 */
export abstract class BasePage {
  /** Path relative to BASE_URL, e.g. '/cart'. */
  protected abstract readonly path: string;
  protected readonly healer: Healer;

  constructor(readonly page: Page) {
    this.healer = new Healer(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(this.path);
    await this.waitUntilReady();
  }

  /** Override with a page-specific readiness signal (a heading, a response). Default: DOM loaded. */
  async waitUntilReady(): Promise<void> {
    await this.page.waitForLoadState('domcontentloaded');
  }

  /** Resolve an ElementSpec through the healer. */
  protected el(spec: ElementSpec): Promise<Locator> {
    return this.healer.locate(spec);
  }

  /** Wait for a network-bound action: clicks and awaits the matching response together. */
  protected async actAndWaitFor(urlPart: string | RegExp, action: () => Promise<void>): Promise<void> {
    const response = this.page.waitForResponse((r) =>
      typeof urlPart === 'string' ? r.url().includes(urlPart) : urlPart.test(r.url()),
    );
    await action();
    await response;
  }

  /** Readiness helper for eventual state, never a hard wait. */
  protected async eventually(fn: () => Promise<unknown>, expected: unknown, timeout = 10_000): Promise<void> {
    await expect.poll(fn, { timeout }).toEqual(expected);
  }
}
