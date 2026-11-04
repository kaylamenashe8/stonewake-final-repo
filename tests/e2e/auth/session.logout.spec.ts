import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { Sidebar } from '../../../src/components/Sidebar';
import { credentials, signedOut } from './credentials';

// Signs in with its own fresh session: signing out of the shared storageState session would end it
// for every other test running in parallel.
test.describe('Logout', () => {
  test.use({ storageState: signedOut });

  test('ui 5 logout: should end the session and guard app pages when the user signs out @regression', async ({
    page,
    loginPage,
  }) => {
    test.skip(!credentials.available, 'TEST_USER/TEST_PASSWORD not set');
    requirement('REQ-AUTH-05');
    await loginPage.goto();
    await loginPage.login(credentials.user, credentials.password);
    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Deal Book');

    await new Sidebar(page).signOut();

    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(await loginPage.headingText()).toBeVisible();
    await page.goto('/portfolio');
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(await loginPage.headingText()).toBeVisible();
  });
});
