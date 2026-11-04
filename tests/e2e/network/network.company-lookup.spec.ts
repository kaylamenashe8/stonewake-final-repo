import type { Locator, Page } from '@playwright/test';
import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';

/** A listed German AG: the commercial register names its officers and GLEIF its subsidiaries (19:55 probe). */
const COMPANY = {
  query: 'Siemens Energy',
  name: 'Siemens Energy AG',
  resultLabel: /^Siemens Energy AG DEU · /,
} as const;

/** Table under the network view whose header row includes `column` (Party: officers, From: cited relationships); both are unique to their table. */
function tableWithColumn(page: Page, column: string): Locator {
  return page
    .getByRole('main')
    .getByRole('table')
    .filter({ has: page.getByRole('columnheader', { name: column, exact: true }) });
}

/** Body rows' last cell (the citation column) that carries no source control; scoped CSS inside the table. */
function uncitedRows(table: Locator, page: Page): Locator {
  return table.locator('tbody tr td:last-child').filter({ hasNot: page.getByRole('button') });
}

test.describe('Network: company lookup', () => {
  test('should list officers and ownership relationships each cited to a register when a company network is opened from lookup @regression', async ({
    page,
  }) => {
    requirement('REQ-NET-01');

    await test.step('look up the company and open its network', async () => {
      await page.goto('/network');
      await page.getByRole('textbox', { name: 'Look up a company' }).fill(COMPANY.query);
      // A result is a card holding the company button and its actions; scope to the innermost card for our company.
      const result = page
        .getByRole('main')
        .locator('div')
        .filter({ has: page.getByRole('button', { name: COMPANY.resultLabel }) })
        .filter({ has: page.getByRole('button', { name: 'View network' }) })
        .last();
      await result.getByRole('button', { name: 'View network' }).click();
      await expect(page).toHaveURL(
        (url) => url.pathname === '/network' && /^\d+$/.test(url.searchParams.get('node') ?? ''),
      );
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(`Network of ${COMPANY.name}`);
    });

    await test.step('officers are listed, link to their own network and cite the register', async () => {
      await expect(page.getByRole('heading', { name: 'Officers and ownership', exact: true })).toBeVisible();
      const officers = tableWithColumn(page, 'Party');
      // first(): the officer list is live register data; any officer proves the list is populated.
      await expect(officers.locator('tbody').getByRole('row').first()).toBeVisible();
      await expect(officers.locator('tbody').getByRole('link').first()).toHaveAttribute(
        'href',
        /^\/network\?node=\d+$/,
      );
      await expect(uncitedRows(officers, page)).toHaveCount(0);
    });

    await test.step('every ownership relationship cites its source', async () => {
      await expect(page.getByRole('heading', { name: 'Owners and group', exact: true })).toBeVisible();
      const relationships = tableWithColumn(page, 'From');
      // first(): relationships are live GLEIF/register data; any row proves the list is populated.
      await expect(relationships.locator('tbody').getByRole('row').first()).toBeVisible();
      await expect(uncitedRows(relationships, page)).toHaveCount(0);
    });
  });
});
