import type { Locator, Response } from '@playwright/test';
import { z } from 'zod';
import { DealBookPage } from '../../../src/pages/DealBookPage';
import { by, element } from '../../../src/pages/spec';

/** Order options in Deal Book > Filters, keyed by their `?sort=` value. */
export const DEAL_ORDERS = {
  score: 'Score',
  name: 'Name',
  last_activity: 'Last activity',
} as const;
export type DealOrder = keyof typeof DEAL_ORDERS;

/** Only the field this check reads from POST /deals/list; the full contract is the API lane's. */
const dealsListIds = z.object({ items: z.array(z.object({ deal_id: z.string().min(1) })) });

/** Score badge name: "Relevance score 84 of 100". */
const SCORE_NAME = /^Relevance score (\d+) of 100$/;

/**
 * Deal Book ordering on top of src/pages/DealBookPage (which this lane cannot edit).
 * CHANGELOG REQUEST: fold these members into src/pages/DealBookPage.
 */
export class DealBookOrder extends DealBookPage {
  readonly filtersButton = element('Deal Book > Filters', by.role('button', 'Filters'));
  readonly orderSelect = element('Deal Book > Filters > Order', by.role('combobox', 'Order'), by.label('Order'));

  /**
   * Opens Filters, picks an Order option and returns the deal paths (/deals/<id>) in the order the
   * server sorted them (POST /deals/list?sort=<order>).
   */
  async orderBy(order: DealOrder): Promise<string[]> {
    const filters = await this.el(this.filtersButton);
    if ((await filters.getAttribute('aria-expanded')) !== 'true') await filters.click();
    const select = await this.el(this.orderSelect);
    const response = this.page.waitForResponse(
      (r: Response) =>
        r.request().method() === 'POST' && r.url().includes('/deals/list') && r.url().includes(`sort=${order}`),
    );
    await select.selectOption({ label: DEAL_ORDERS[order] });
    const { items } = dealsListIds.parse(await (await response).json());
    return items.map((i) => `/deals/${i.deal_id}`);
  }

  /** Paths of the visible deal links, top to bottom. */
  async visibleDealPaths(): Promise<string[]> {
    return this.dealLinks().evaluateAll((links) => links.map((a) => a.getAttribute('href') ?? ''));
  }

  /** Deal names top to bottom; a link's text is ["New",] name, "Country · Sector" (one per line). */
  async visibleDealNames(): Promise<string[]> {
    const texts = await this.dealLinks().allInnerTexts();
    return texts.map((t) => t.trim().split('\n').at(-2)?.trim() ?? '');
  }

  /** Relevance scores top to bottom, read from each row's score badge. */
  async visibleScores(): Promise<number[]> {
    const names = await this.scoreBadges().evaluateAll((imgs) => imgs.map((i) => i.getAttribute('aria-label') ?? ''));
    return names.map((n) => Number.parseInt(SCORE_NAME.exec(n)?.[1] ?? '', 10));
  }

  /** "Last activity" dates top to bottom (cells read "3 Nov 2026"), as epoch milliseconds. */
  async visibleLastActivity(): Promise<number[]> {
    const headers = await this.page.getByRole('main').getByRole('table').getByRole('columnheader').allInnerTexts();
    const column = headers.findIndex((h) => h.trim().toLowerCase() === 'last activity');
    if (column < 0) throw new Error('Deal Book: no "Last activity" column');
    // Cells have no accessible name; match them to the header by cellIndex (CSS scoped to the deal rows).
    const cells = await this.dealRows().locator('td').evaluateAll(
      (tds, col) =>
        tds
          .filter((td) => (td as HTMLTableCellElement).cellIndex === col)
          .map((td) => td.textContent.trim()),
      column,
    );
    return cells.map((c) => Date.parse(`${c} UTC`));
  }

  private scoreBadges(): Locator {
    return this.dealRows().getByRole('img', { name: SCORE_NAME });
  }
}
