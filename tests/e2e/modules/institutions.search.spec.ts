import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { InstitutionsPage } from '../../../src/pages/InstitutionsPage';

test.describe('Institutions', () => {
  test('ui 9 institutions: should list only the searched institution and open its page when it is clicked @regression', async ({
    page,
  }) => {
    requirement('REQ-INST-01');
    const institutions = new InstitutionsPage(page);
    await institutions.goto();
    await expect(await institutions.kindFilter()).toBeVisible();
    await expect(await institutions.countryFilter()).toBeVisible();

    // UK Export Finance is reference data (an ECA), present in every workspace.
    await institutions.searchFor('UKEF');
    const ukef = institutions.institutionLinks().filter({ hasText: 'UK Export Finance' });
    await expect(ukef).toHaveCount(1);
    await expect(institutions.institutionLinks()).toHaveCount(1);
    const href = await ukef.getAttribute('href');
    expect(href).toMatch(/^\/entities\/\d+$/);

    await ukef.click();
    await expect(page).toHaveURL((url) => url.pathname === href);
    await expect(page).toHaveTitle('Institutions · Stonewake');
    await expect(institutions.pageHeading()).toHaveText('UKEF');
  });
});
