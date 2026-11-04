import type { Page } from '@playwright/test';
import { BasePage } from '../../../src/pages/BasePage';
import { by, element } from '../../../src/pages/spec';

const SEARCH = /\/search(\?|$)/;

/** Network (sidebar > Network): company lookup by name; results are register entities. */
export class NetworkPage extends BasePage {
  protected readonly path = '/network';

  readonly lookup = element(
    'Network > Look up a company',
    by.role('textbox', 'Look up a company'),
    by.label('Look up a company'),
  );

  override async waitUntilReady(): Promise<void> {
    await this.el(this.lookup);
  }

  /** Types a company name and waits for the search response (POST /search). */
  async lookUp(name: string): Promise<void> {
    const box = await this.el(this.lookup);
    await this.actAndWaitFor(SEARCH, async () => {
      await box.fill(name);
    });
  }

  /**
   * Opens the lookup result whose label starts with "<name> <ISO3 country>", e.g. "SIEMENS ENERGY LIMITED GBR".
   * Built per call because the name is the test's input.
   */
  async openResult(name: string, country: string): Promise<void> {
    const result = element(`Network > Result ${name} ${country}`, {
      strategy: 'role',
      describe: `getByRole('button', { name: /^${name} ${country} / })`,
      build: (p: Page) =>
        p.getByRole('main').getByRole('button', { name: new RegExp(`^${escapeRegExp(name)} ${country} `) }),
    });
    await (await this.el(result)).click();
  }
}

/** Company names may contain regex characters (".", "("), so they are escaped before matching. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
