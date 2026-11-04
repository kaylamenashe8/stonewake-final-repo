import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { CompanyPage } from './pages/CompanyPage';
import { NetworkPage } from './pages/NetworkPage';

// The product's own lookup example ("for example Siemens Energy"); the UK subsidiary files officers and a
// parent with Companies House and GLEIF, so it has owners, officers and a chain. Register data, not live scores.
const QUERY = 'Siemens Energy';
const COMPANY = 'SIEMENS ENERGY LIMITED';
const COUNTRY = 'GBR';

test.describe('Network company lookup @regression', () => {
  test('should show owners, officers and the ownership chain, each cited, when a company is looked up', async ({
    page,
  }) => {
    requirement('T08');
    const network = new NetworkPage(page);
    const company = new CompanyPage(page);

    await test.step(`look up ${QUERY} and open ${COMPANY}`, async () => {
      await network.goto();
      await network.lookUp(QUERY);
      await network.openResult(COMPANY, COUNTRY);
      await expect(page).toHaveURL(/\/entities\/n\d+/);
      await company.waitUntilReady();
      await expect(await company.titleHeading()).toHaveText(COMPANY);
    });

    const owners =
      await test.step('owners and officers are listed, every row cited to a register', async () => {
        const rows = await company.partyRows();
        await expect(rows.filter({ hasText: /^Owned by/ })).not.toHaveCount(0);
        await expect(rows.filter({ hasText: /^Officers/ })).not.toHaveCount(0);
        const total = await rows.count();
        await expect(await company.citedPartyRows()).toHaveCount(total);
        return company.ownerNames();
      });

    await test.step('the ownership chain path leads to a listed owner', async () => {
      const [owner] = owners;
      expect(owner).toBeTruthy();
      expect(await company.ownershipPathNames()).toContain(owner);
    });
  });
});
