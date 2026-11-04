import type { Locator } from '@playwright/test';
import { AppPage } from './AppPage';

/** Status tiles in display order; the test id is `tile-<key>` (note: not_assessed uses an underscore). */
export const PORTFOLIO_TILES = ['red', 'amber', 'insufficient', 'not_assessed', 'green'] as const;
export type PortfolioTile = (typeof PORTFOLIO_TILES)[number];

/** Portfolio (/portfolio): status tiles over the monitored book and the company table. */
export class PortfolioPage extends AppPage {
  protected override readonly path = '/portfolio';

  /** Tiles are only reachable by test id (no role or label on them). */
  tile(key: PortfolioTile): Locator {
    return this.page.getByTestId(`tile-${key}`);
  }

  /** Company links in the book table (each row links to /entities/n<id>). */
  companyLinks(): Locator {
    return this.page.getByRole('main').getByRole('table').locator('tbody').getByRole('link');
  }
}
