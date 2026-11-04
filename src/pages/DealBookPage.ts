import type { Locator } from '@playwright/test';
import { AppPage } from './AppPage';
import { by, element } from './spec';

/** Deal Book (/): the team's deals table with search, filters and the Deals/Following tabs. */
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
  readonly dealsTab = element(
    'Deal Book > Deals tab',
    by.role('tab', 'Deals'),
    by.css('[role="tab"][aria-selected="true"]'),
  );
  readonly noMatch = element('Deal Book > No matching deals', by.text('No matching deals'));

  sectorFilter(): Promise<Locator> {
    return this.el(this.sector);
  }

  dealsTabLocator(): Promise<Locator> {
    return this.el(this.dealsTab);
  }

  noMatchMessage(): Locator {
    return this.noMatch.primary(this.page);
  }

  /** Deal links in the table body, one per deal row (each row's first cell links to /deals/<id>). */
  dealLinks(): Locator {
    return this.page.getByRole('main').getByRole('table').locator('tbody').getByRole('link');
  }

  async searchFor(text: string): Promise<void> {
    await (await this.el(this.search)).fill(text);
  }
}
