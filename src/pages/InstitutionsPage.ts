import type { Locator } from '@playwright/test';
import { AppPage } from './AppPage';
import { by, element } from './spec';

/** Institutions (/entities): agencies, banks and ECAs behind the deals, with search and Kind/Country filters. */
export class InstitutionsPage extends AppPage {
  protected override readonly path = '/entities';

  readonly search = element(
    'Institutions > Search',
    by.role('textbox', 'Search institutions'),
    by.css('main input[placeholder^="Search institutions"]'),
  );
  readonly kind = element('Institutions > Kind filter', by.role('combobox', 'Kind'), by.label('Kind'));
  readonly country = element(
    'Institutions > Country filter',
    by.role('combobox', 'Country'),
    by.label('Country'),
  );

  kindFilter(): Promise<Locator> {
    return this.el(this.kind);
  }

  countryFilter(): Promise<Locator> {
    return this.el(this.country);
  }

  async searchFor(text: string): Promise<void> {
    await (await this.el(this.search)).fill(text);
  }

  /** Institution links in the table body (each row links to /entities/<id>). */
  institutionLinks(): Locator {
    return this.page.getByRole('main').getByRole('table').locator('tbody').getByRole('link');
  }
}
