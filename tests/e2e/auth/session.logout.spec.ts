import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { AppPage } from '../../../src/pages/AppPage';
import { credentials, signedOut } from './credentials';

// Signs in with its own fresh session: signing out of the shared storageState session would end it
// for every other test running in parallel. Sign-out ends only the current session (checked, F23), so
// this test runs in parallel with the rest.
test.describe('Logout', () => {
  test.use({ storageState: signedOut });

  test('ui 5 logout: should end the session and guard app pages when the user signs out @regression', async ({
    page,
    loginPage,
  }) => {
    test.skip(!credentials.available, 'TEST_USER/TEST_PASSWORD not set');
    requirement('REQ-AUTH-05');
    const app = new AppPage(page);

    await test.step('sign in with a fresh session', async () => {
      await loginPage.goto();
      await loginPage.login(credentials.user, credentials.password);
      await expect(page).toHaveURL((url) => url.pathname === '/');
      await expect(app.pageHeading()).toHaveText('Deal Book');
    });

    await test.step('sign out returns to /login', async () => {
      await app.sidebar.signOut();
      await expect(page).toHaveURL((url) => url.pathname === '/login');
      await expect(await loginPage.heading()).toBeVisible();
    });

    await test.step('app pages redirect to /login after sign out', async () => {
      await page.goto('/portfolio');
      await expect(page).toHaveURL((url) => url.pathname === '/login');
      await expect(await loginPage.heading()).toBeVisible();
    });
  });
});
