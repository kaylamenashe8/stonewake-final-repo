import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { CountriesPage } from '../../../src/pages/CountriesPage';

/** Egypt is the reference country profile in docs/product/DEMO_VIDEO.md Flow 4: every risk component is scored. */
const COUNTRY = { iso3: 'EGY', name: 'Egypt' } as const;

/** Each scored component of the country risk and the publisher its citation must point to. */
const CITED_COMPONENTS = [
  { label: /Corruption Perceptions Index/, publisher: /^https:\/\/www\.transparency\.org\// },
  { label: /Governance indicators \(WGI\)/, publisher: /^https:\/\/data360\.worldbank\.org\// },
  { label: /FATF lists/, publisher: /^https:\/\/www\.fatf-gafi\.org\// },
  { label: /Country sanctions programs \(OFAC\/EU\/UN\)/, publisher: /^https:\/\/ofac\.treasury\.gov\// },
] as const;

test.describe('Countries: country profile', () => {
  test('should show a 0-100 risk score with every indicator cited to its publisher when a country profile is opened @regression', async ({
    page,
  }) => {
    requirement('REQ-CTY-01');
    const countries = new CountriesPage(page);

    await countries.openCountry(COUNTRY.iso3);
    await expect(countries.pageHeading()).toHaveText(COUNTRY.name);

    // The risk card has no landmark, so scope to the innermost block (last() in DOM order) holding both its heading
    // and its component list. `has` needs a page-rooted locator, so AppPage.section() (main-rooted) cannot be reused.
    const riskHeading = page.getByRole('heading', { level: 2, name: 'Country risk', exact: true });
    const riskSection = page
      .getByRole('main')
      .locator('div')
      .filter({ has: riskHeading })
      .filter({ has: page.getByRole('list') })
      .last();
    const components = riskSection.getByRole('listitem');

    await test.step('the compiled risk score is a number out of 100', async () => {
      const score = riskSection.getByText(/^\d{1,3}\s*\/\s*100$/);
      await expect(score).toBeVisible();
      const value = Number((await score.innerText()).split('/')[0]?.trim());
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    });

    await test.step('each scored indicator shows its points and links to its publisher', async () => {
      for (const { label, publisher } of CITED_COMPONENTS) {
        const row = components.filter({ hasText: label });
        await expect(row, `one row for ${String(label)}`).toHaveCount(1);
        await expect(row).toContainText(/[+-]\d+\.\d/);
        // Each component row carries exactly one citation link; strict mode fails if that changes.
        await expect(row.getByRole('link')).toHaveAttribute('href', publisher);
      }
    });
  });
});
