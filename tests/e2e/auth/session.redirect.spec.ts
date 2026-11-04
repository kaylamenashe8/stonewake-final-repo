import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { Sidebar } from '../../../src/components/Sidebar';
import { signedOut } from './credentials';

test.describe('Session guard', () => {
  test.use({ storageState: signedOut });

  test('ui 4 not logged in redirect: should redirect to /login when an app page is opened without a session @smoke @regression', async ({
    page,
    loginPage,
  }) => {
    requirement('REQ-AUTH-04');
    for (const path of ['/', '/portfolio', '/countries/DEU', '/entities']) {
      await page.goto(path);
      await expect(page, `${path} should redirect to /login`).toHaveURL((url) => url.pathname === '/login');
      await expect(await loginPage.heading()).toBeVisible();
    }
    await expect(new Sidebar(page).root).toHaveCount(0);
  });
});
