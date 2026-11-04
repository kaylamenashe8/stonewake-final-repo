import type { Locator, Page, Response } from '@playwright/test';
import { BasePage } from '../../../src/pages/BasePage';
import { by, element } from '../../../src/pages/spec';

/** Page size the Deal Book requests from POST /deals/list (limit=50). */
export const DEAL_PAGE_SIZE = 50;

const DEALS_LIST = /\/deals\/list(\?|$)/;

/** Deal Book (sidebar > Deal Book, path "/"). Filters drive POST /deals/list and the ?sector= query. */
export class DealBookPage extends BasePage {
  protected readonly path = '/';

  readonly heading = element('Deal Book > Heading', by.role('heading', 'Deal Book'), by.text(/^Deal Book$/));

  readonly sectorFilter = element(
    'Deal Book > Sector filter',
    by.label('All sectors'),
    by.role('combobox', 'All sectors'),
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

  /** Deal rows (the header row has no link, so it is excluded). */
  async dealRows(): Promise<Locator> {
    const table = await this.el(this.dealsTable);
    return table.getByRole('row').filter({ has: this.page.getByRole('link') });
  }

  /** Sector of every visible deal row, read from the "Country · Sector" line under the deal name. */
  async visibleDealSectors(): Promise<string[]> {
    const links = (await this.dealRows()).getByRole('link');
    const texts = await links.allInnerTexts();
    return texts.map((t) => {
      const subtitle = t.trim().split('\n').at(-1) ?? '';
      return subtitle.split(' · ').at(-1)?.trim() ?? '';
    });
  }

  /** Sector of the first deal in the list: the test picks its filter from live data, not a hardcoded value. */
  async firstDealSector(): Promise<string> {
    await (await this.dealRows()).first().waitFor();
    const [first] = await this.visibleDealSectors();
    if (!first) throw new Error('Deal Book: first deal row has no sector');
    return first;
  }

  /** Name and sector of the first listed deal, then opens it (client-side route to /deals/:id). */
  async openFirstDeal(): Promise<{ name: string; sector: string }> {
    // first(): the test takes whichever deal ranks first today instead of a hardcoded id.
    const link = (await this.dealRows()).first().getByRole('link');
    const lines = (await link.innerText()).trim().split('\n');
    const name = lines.at(-2)?.trim() ?? '';
    const sector = lines.at(-1)?.split(' · ').at(-1)?.trim() ?? '';
    if (!name || !sector) throw new Error(`Deal Book: cannot read name and sector from "${lines.join(' | ')}"`);
    await link.click();
    return { name, sector };
  }

  private async dealsTotal(action: () => Promise<void>, urlPart = ''): Promise<number> {
    const response = this.page.waitForResponse(
      (r: Response) => r.request().method() === 'POST' && DEALS_LIST.test(r.url()) && r.url().includes(urlPart),
    );
    await action();
    const body = (await (await response).json()) as { total?: unknown };
    if (typeof body.total !== 'number') throw new Error('Deal Book: /deals/list response has no numeric total');
    return body.total;
  }
}
