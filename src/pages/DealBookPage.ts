import type { Locator, Response } from '@playwright/test';
import { z } from 'zod';
import { linkHref } from '../components/links';
import { AppPage } from './AppPage';
import { by, element } from './spec';

/** Page size the Deal Book requests from POST /deals/list (limit=50). */
export const DEAL_PAGE_SIZE = 50;

const DEALS_LIST = /\/deals\/list(\?|$)/;

/** Only the field the page object reads from POST /deals/list; the full contract is the API lane's. */
const dealsListTotal = z.object({ total: z.number().int().nonnegative() });

/** Separator in the line under a deal name: "Country · Sector" (country may be missing). */
const SUBTITLE_SEPARATOR = ' · ';

/** Sector from a deal link's text, whose last line is "Country · Sector" (lines above: ["New",] name). */
function dealSector(linkText: string): string {
  return linkText.trim().split('\n').at(-1)?.split(SUBTITLE_SEPARATOR).at(-1)?.trim() ?? '';
}

/**
 * Deal Book (/): the team's deals table with search, filters and the Deals/Following tabs.
 * Filters drive POST /deals/list and the ?sector= query.
 */
export class DealBookPage extends AppPage {
  protected override readonly path = '/';

  readonly search = element(
    'Deal Book > Search',
    by.role('textbox', 'Search deals'),
    by.css('main input[placeholder^="Search deals"]'),
  );
  readonly sector = element(
    'Deal Book > Sector filter',
    by.role('combobox', 'All sectors'),
    by.label('All sectors'),
  );
  readonly dealsTab = element('Deal Book > Deals tab', by.role('tab', 'Deals'));
  readonly noMatch = element('Deal Book > No matching deals', by.text('No matching deals'));

  /** Opens the Deal Book and returns the unfiltered `total` reported by /deals/list. */
  async open(): Promise<number> {
    const total = await this.dealsTotal(async () => {
      await this.page.goto(this.path);
    });
    await this.waitUntilReady();
    return total;
  }

  sectorFilter(): Promise<Locator> {
    return this.el(this.sector);
  }

  dealsTabLocator(): Promise<Locator> {
    return this.el(this.dealsTab);
  }

  noMatchMessage(): Promise<Locator> {
    return this.el(this.noMatch);
  }

  /**
   * Deal rows (the header row has no link, so it is excluded). A plain locator, not an ElementSpec: the
   * table is removed when nothing matches, and tests assert that as a count of 0, which the healer cannot.
   */
  dealRows(): Locator {
    return this.page
      .getByRole('main')
      .getByRole('table')
      .getByRole('row')
      .filter({ has: this.page.getByRole('link') });
  }

  /** Deal links, one per deal row (each row's first cell links to /deals/<id>). */
  dealLinks(): Locator {
    return this.dealRows().getByRole('link');
  }

  /** Path of the first listed deal (/deals/<id>): whichever deal the workspace lists first. */
  firstDealHref(): Promise<string> {
    // first(): any deal will do; the test does not assume which deals exist (C4).
    return linkHref(this.dealLinks().first());
  }

  /** The deal link pointing at `href` (a /deals/<id> path read from dealLinks()); href is its only stable key. */
  dealLink(href: string): Locator {
    return this.dealLinks().and(this.page.locator(`[href="${href}"]`));
  }

  async searchFor(text: string): Promise<void> {
    await (await this.el(this.search)).fill(text);
  }

  /** Picks a sector in the filter; returns the filtered `total` reported by /deals/list. */
  async filterBySector(sector: string): Promise<number> {
    const select = await this.sectorFilter();
    return this.dealsTotal(async () => {
      await select.selectOption({ label: sector });
    }, 'sector=');
  }

  /** Sector of every visible deal row, read from the "Country · Sector" line under the deal name. */
  async visibleDealSectors(): Promise<string[]> {
    const texts = await this.dealLinks().allInnerTexts();
    return texts.map(dealSector);
  }

  /** Sector of the first deal in the list: the test picks its filter from live data, not a hardcoded value. */
  async firstDealSector(): Promise<string> {
    // first(): readiness only, waits until at least one deal row has rendered.
    await this.dealRows().first().waitFor();
    const [first] = await this.visibleDealSectors();
    if (!first) throw new Error('Deal Book: first deal row has no sector');
    return first;
  }

  // Not BasePage.actAndWaitFor: the caller needs the response body (total), not just the wait.
  private async dealsTotal(action: () => Promise<void>, urlPart = ''): Promise<number> {
    const response = this.page.waitForResponse(
      (r: Response) =>
        r.request().method() === 'POST' && DEALS_LIST.test(r.url()) && r.url().includes(urlPart),
    );
    await action();
    return dealsListTotal.parse(await (await response).json()).total;
  }
}
