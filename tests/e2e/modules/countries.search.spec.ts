import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { CountriesPage } from '../../../src/pages/CountriesPage';

test.describe('Countries', () => {
  test('ui 8 countries: should find a country, open its risk profile, and show not found for an unknown code @regression', async ({
    page,
  }) => {
    requirement('REQ-CTRY-01');
    const countries = new CountriesPage(page);
    await countries.goto();

    await countries.searchFor('Germany');
    const germany = countries.countryLink('Germany');
    await expect(germany).toBeVisible();
    await germany.click();
    await expect(page).toHaveURL((url) => url.pathname === '/countries/DEU');
    await expect(countries.pageHeading()).toHaveText('Germany');
    await expect(countries.section('Country risk')).toBeVisible();
    await expect(countries.section('Data sources')).toBeVisible();

    await countries.goto();
    await countries.searchFor('Zzzzqq');
    await expect(countries.noMatchMessage()).toBeVisible();
    await expect(countries.countryLinks()).toHaveCount(0);

    await countries.openCountry('ZZZ');
    await expect(page).toHaveTitle('Page not found · Stonewake');
  });
});
