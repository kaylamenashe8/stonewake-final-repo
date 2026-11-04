import type { Locator } from '@playwright/test';
import { AppPage } from './AppPage';
import { by, element } from './spec';

/** Countries (/countries): risk table grouped by region, with a search box. */
export class CountriesPage extends AppPage {
  protected override readonly path = '/countries';

  readonly search = element(
    'Countries > Search',
    by.role('textbox', 'Search countries'),
    by.label('Search countries'),
  );
  readonly noMatch = element('Countries > No matching countries', by.text('No matching countries'));

  async searchFor(text: string): Promise<void> {
    await (await this.el(this.search)).fill(text);
  }

  noMatchMessage(): Promise<Locator> {
    return this.el(this.noMatch);
  }

  countryLink(name: string): Locator {
    return this.page.getByRole('main').getByRole('table').getByRole('link', { name, exact: true });
  }

  /** Links to a country profile (/countries/<ISO3>); region rows are buttons, not links. */
  countryLinks(): Locator {
    return this.page.getByRole('main').getByRole('table').locator('a[href^="/countries/"]');
  }

  async openCountry(iso3: string): Promise<void> {
    await this.page.goto(`/countries/${iso3}`);
  }
}
