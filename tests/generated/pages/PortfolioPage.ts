import { BasePage } from '../../../src/pages/BasePage';
import { by, element } from '../../../src/pages/spec';
import type { ElementSpec } from '../../../src/utils/healing';

/** Status tiles on Portfolio, keyed like the API's `statuses` (tile test ids are `tile-<status>`). */
export const PORTFOLIO_TILE_STATUSES = ['red', 'amber', 'insufficient', 'not_assessed', 'green'] as const;
export type PortfolioTileStatus = (typeof PORTFOLIO_TILE_STATUSES)[number];

const TILE_LABELS: Record<PortfolioTileStatus, string> = {
  red: 'Red',
  amber: 'Amber',
  insufficient: 'No score yet',
  not_assessed: 'Not yet assessed',
  green: 'Green',
};

/** "25 active exposures · 8 status changes in 30 days" */
const ACTIVE_EXPOSURES = /^(\d+) active exposures?/;

/** Portfolio (sidebar > Portfolio): monitored book with one count tile per credit status. */
export class PortfolioPage extends BasePage {
  protected readonly path = '/portfolio';

  readonly heading = element('Portfolio > Heading', by.role('heading', 'Portfolio'));

  readonly bookPulse = element('Portfolio > Book pulse', by.testId('book-pulse'), by.text(ACTIVE_EXPOSURES));

  override async waitUntilReady(): Promise<void> {
    await this.el(this.heading);
  }

  /** Tiles have no accessible role or name; the product ships test ids for them (BASELINE). */
  private tile(status: PortfolioTileStatus): ElementSpec {
    return element(
      `Portfolio > Tile ${status}`,
      by.testId(`tile-${status}`),
      by.text(new RegExp(`^${TILE_LABELS[status]}$`)),
    );
  }

  /** Count on a status tile: its text is "<label>\n<count>". */
  async tileCount(status: PortfolioTileStatus): Promise<number> {
    const lines = (await (await this.el(this.tile(status))).innerText()).trim().split('\n');
    return Number.parseInt(lines.at(-1) ?? '', 10);
  }

  async tileCounts(): Promise<Record<PortfolioTileStatus, number>> {
    const counts = await Promise.all(
      PORTFOLIO_TILE_STATUSES.map(async (s) => [s, await this.tileCount(s)] as const),
    );
    return Object.fromEntries(counts) as Record<PortfolioTileStatus, number>;
  }

  async activeExposures(): Promise<number> {
    const text = await (await this.el(this.bookPulse)).innerText();
    return Number.parseInt(ACTIVE_EXPOSURES.exec(text.trim())?.[1] ?? '', 10);
  }
}
