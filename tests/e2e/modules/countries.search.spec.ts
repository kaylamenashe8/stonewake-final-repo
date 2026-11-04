import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { CountriesPage } from '../../../src/pages/CountriesPage';

/** A search term no country name contains, and an ISO3 code no country has. */
const UNMATCHED_SEARCH = 'Zzzzqq';
const UNKNOWN_ISO3 = 'ZZZ';

test.describe('Countries', () => {
  test('ui 8 countries: should open the risk profile when a searched country is clicked and show not found when the code is unknown @regression', async ({
    page,
  }) => {
    requirement('REQ-CTRY-01');
    const countries = new CountriesPage(page);

    await test.step('search for Germany and open its risk profile', async () => {
      await countries.goto();
      await countries.searchFor('Germany');
      const germany = countries.countryLink('Germany');
      await expect(germany).toBeVisible();
      await germany.click();
      await expect(page).toHaveURL((url) => url.pathname === '/countries/DEU');
      await expect(countries.pageHeading()).toHaveText('Germany');
      await expect(countries.section('Country risk')).toBeVisible();
      await expect(countries.section('Data sources')).toBeVisible();
    });

    await test.step('an unmatched search lists no countries', async () => {
      await countries.goto();
      await countries.searchFor(UNMATCHED_SEARCH);
      await expect(countries.countryLinks()).toHaveCount(0);
      await expect(await countries.noMatchMessage()).toBeVisible();
    });

    await test.step('an unknown country code shows the not-found page', async () => {
      await countries.openCountry(UNKNOWN_ISO3);
      await expect(page).toHaveTitle('Page not found · Stonewake');
    });
  });
});
