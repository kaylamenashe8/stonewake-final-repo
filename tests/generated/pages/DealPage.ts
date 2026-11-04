import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../../../src/pages/BasePage';
import { by, element } from '../../../src/pages/spec';

/** Deal detail (/deals/:id): title, Briefing with cited links, Updates with source drawers, Key facts. */
export class DealPage extends BasePage {
  /** Reached by clicking a deal in the Deal Book (ids are live data); goto() is not used. */
  protected readonly path = '/deals';

  readonly title = element(
    'Deal > Title',
    {
      strategy: 'role',
      describe: "getByRole('main').getByRole('heading', { level: 1 })",
      build: (p: Page) => p.getByRole('main').getByRole('heading', { level: 1 }),
    },
    by.css('main h1'),
  );

  readonly briefingHeading = element('Deal > Briefing heading', by.role('heading', 'Briefing'));

  readonly keyFactsHeading = element('Deal > Key facts heading', by.role('heading', 'Key facts'));

  readonly firstSourcesButton = element('Deal > First "N sources" button', {
    strategy: 'role',
    describe: "getByRole('button', { name: /^\\d+ sources?$/ }).first()",
    // first(): every update has its own "N sources" button; any one proves the citation drawer.
    build: (p: Page) => p.getByRole('button', { name: /^\d+ sources?$/ }).first(),
  });

  readonly sourceDrawer = element('Deal > Source drawer', {
    strategy: 'role',
    describe: "getByRole('dialog')",
    build: (p: Page) => p.getByRole('dialog'),
  });

  override async waitUntilReady(): Promise<void> {
    await this.el(this.keyFactsHeading);
  }

  briefing(): Promise<Locator> {
    return this.el(this.briefingHeading);
  }

  titleHeading(): Promise<Locator> {
    return this.el(this.title);
  }

  /**
   * External links cited under the Briefing ("AI drafted from the cited sources · …"). A collection, so a
   * plain scoped locator rather than an ElementSpec (the healer resolves single elements only).
   */
  briefingSourceLinks(): Locator {
    return this.page
      .getByRole('main')
      .getByRole('paragraph')
      .filter({ hasText: /drafted from the cited sources/i })
      .getByRole('link');
  }

  /** Key facts as term -> value (e.g. Sector -> "Mining & metals"); read as a whole list, like briefingSourceLinks. */
  async keyFacts(): Promise<Record<string, string>> {
    await this.el(this.keyFactsHeading);
    const main = this.page.getByRole('main');
    // textContent, not innerText: the terms are uppercased by CSS (text-transform).
    const terms = await main.getByRole('term').allTextContents();
    const values = await main.getByRole('definition').allInnerTexts();
    return Object.fromEntries(terms.map((t, i) => [t.trim(), (values[i] ?? '').trim()]));
  }

  /** Opens the citation drawer of the first update and returns its "View at source" link. */
  async openFirstSource(): Promise<Locator> {
    await (await this.el(this.firstSourcesButton)).click();
    const drawer = await this.el(this.sourceDrawer);
    return drawer.getByRole('link', { name: /^view at source/i });
  }
}
