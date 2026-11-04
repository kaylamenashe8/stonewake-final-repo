import type { Locator, Page } from '@playwright/test';
import { BasePage } from '../../../src/pages/BasePage';
import { by, element } from '../../../src/pages/spec';

/** Company profile (/entities/:id), opened from a Network lookup: officers, owners, ownership chain. */
export class CompanyPage extends BasePage {
  /** Reached from a Network lookup (entity ids are register data); goto() is not used. */
  protected readonly path = '/entities';

  readonly title = element(
    'Company > Title',
    {
      strategy: 'role',
      describe: "getByRole('main').getByRole('heading', { level: 1 })",
      build: (p: Page) => p.getByRole('main').getByRole('heading', { level: 1 }),
    },
    by.css('main h1'),
  );

  readonly ownershipChainHeading = element(
    'Company > Ownership chain heading',
    by.role('heading', 'Ownership chain'),
  );

  /** The "Officers and ownership" table is the one with a Relationship column. */
  readonly partiesTable = element('Company > Officers and ownership table', {
    strategy: 'role',
    describe: "getByRole('table').filter({ has: columnheader 'Relationship' })",
    build: (p: Page) =>
      p
        .getByRole('main')
        .getByRole('table')
        .filter({ has: p.getByRole('columnheader', { name: 'Relationship' }) }),
  });

  override async waitUntilReady(): Promise<void> {
    await this.el(this.ownershipChainHeading);
  }

  titleHeading(): Promise<Locator> {
    return this.el(this.title);
  }

  /** Party rows (owners and officers); the header row has no link. A collection, derived from partiesTable. */
  async partyRows(): Promise<Locator> {
    return (await this.el(this.partiesTable)).getByRole('row').filter({ has: this.page.getByRole('link') });
  }

  /** Party rows that carry a register citation (a button naming the register) in their Register cell. */
  async citedPartyRows(): Promise<Locator> {
    // last(): the Register column is the last cell of each row.
    return (await this.partyRows()).filter({ has: this.page.getByRole('cell').last().getByRole('button') });
  }

  /** Rows of the "Owned by" group (the group label prefixes its first row). */
  async ownerRows(): Promise<Locator> {
    return (await this.partyRows()).filter({ hasText: /^Owned by/ });
  }

  /** Rows of the "Officers" group (the group label prefixes its first row). */
  async officerRows(): Promise<Locator> {
    return (await this.partyRows()).filter({ hasText: /^Officers/ });
  }

  /** Names of the parties listed as "Owned by" in the officers and ownership table. */
  async ownerNames(): Promise<string[]> {
    return (await (await this.ownerRows()).getByRole('link').allInnerTexts()).map((n) => n.trim());
  }

  /**
   * Company names on the ownership chain path. Their links point to /entities/ profiles, unlike the table's /network
   * links; the href is the only stable difference, so this is a CSS attribute filter scoped to main.
   */
  async ownershipPathNames(): Promise<string[]> {
    const links = this.page.getByRole('main').locator('a[href^="/entities/"]');
    return (await links.allInnerTexts()).map((n) => n.trim());
  }
}
