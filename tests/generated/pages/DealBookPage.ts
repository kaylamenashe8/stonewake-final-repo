import type { Locator, Page, Response } from '@playwright/test';
import { z } from 'zod';
import { BasePage } from '../../../src/pages/BasePage';
import { by, element } from '../../../src/pages/spec';

/** Page size the Deal Book requests from POST /deals/list (limit=50). */
export const DEAL_PAGE_SIZE = 50;

const DEALS_LIST = /\/deals\/list(\?|$)/;

/** Only the field the page object reads from POST /deals/list; the full contract is the API lane's. */
const dealsListTotal = z.object({ total: z.number().int().nonnegative() });

/** Separator in the line under a deal name: "Country · Sector" (country may be missing). */
const SUBTITLE_SEPARATOR = ' · ';

/** Name and sector from a deal link's text: ["New",] name, "Country · Sector" (one per line). */
export function dealLinkParts(text: string): { name: string; sector: string } {
  const lines = text.trim().split('\n');
  return {
    name: lines.at(-2)?.trim() ?? '',
    sector: lines.at(-1)?.split(SUBTITLE_SEPARATOR).at(-1)?.trim() ?? '',
  };
}

/** Deal Book (sidebar > Deal Book, path "/"). Filters drive POST /deals/list and the ?sector= query. */
export class DealBookPage extends BasePage {
  protected readonly path = '/';

  readonly heading = element('Deal Book > Heading', by.role('heading', 'Deal Book'), by.text(/^Deal Book$/));

  readonly sectorFilter = element(
    'Deal Book > Sector filter',
    by.role('combobox', 'All sectors'),
    by.label('All sectors'),
  );

  readonly dealsTable = element(
    'Deal Book > Deals table',
    {
      strategy: 'role',
      describe: "getByRole('main').getByRole('table')",
      build: (p: Page) => p.getByRole('main').getByRole('table'),
    },
    by.css('main table'),
  );

  /** Opens the Deal Book and returns the unfiltered `total` reported by /deals/list. */
  async open(): Promise<number> {
    const total = await this.dealsTotal(async () => {
      await this.page.goto(this.path);
    });
    await this.el(this.heading);
    return total;
  }

  /** Picks a sector in the filter; returns the filtered `total` reported by /deals/list. */
  async filterBySector(sector: string): Promise<number> {
    const select = await this.el(this.sectorFilter);
    return this.dealsTotal(async () => {
      await select.selectOption({ label: sector });
    }, 'sector=');
  }

  /**
   * Deal rows (the header row has no link, so it is excluded). A collection, so it is derived from the
   * dealsTable ElementSpec instead of being its own spec (the healer resolves single elements only).
   */
  async dealRows(): Promise<Locator> {
    const table = await this.el(this.dealsTable);
    return table.getByRole('row').filter({ has: this.page.getByRole('link') });
  }

  /** Sector of every visible deal row, read from the "Country · Sector" line under the deal name. */
  async visibleDealSectors(): Promise<string[]> {
    const links = (await this.dealRows()).getByRole('link');
    const texts = await links.allInnerTexts();
    return texts.map((t) => dealLinkParts(t).sector);
  }

  /** Sector of the first deal in the list: the test picks its filter from live data, not a hardcoded value. */
  async firstDealSector(): Promise<string> {
    // first(): readiness only, waits until at least one deal row has rendered.
    await (await this.dealRows()).first().waitFor();
    const [first] = await this.visibleDealSectors();
    if (!first) throw new Error('Deal Book: first deal row has no sector');
    return first;
  }

  /** Opens the first listed deal (client-side route to /deals/:id); returns the name and sector the list showed. */
  async openFirstDeal(): Promise<{ name: string; sector: string }> {
    // first(): the test takes whichever deal ranks first today instead of a hardcoded id.
    const link = (await this.dealRows()).first().getByRole('link');
    const listed = dealLinkParts(await link.innerText());
    if (!listed.name || !listed.sector)
      throw new Error('Deal Book: cannot read name and sector of the first deal');
    await link.click();
    return listed;
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
