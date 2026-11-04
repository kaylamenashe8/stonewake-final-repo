import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { AppPage } from '../../../src/pages/AppPage';
import { credentials, signedOut } from './credentials';

// Sign-in form tests run without the shared session (storageState) so they see the real /login page.
test.describe('Login form', () => {
  test.use({ storageState: signedOut });

  test('ui 1 login ok: should land on the Deal Book when the credentials are valid @smoke @regression', async ({
    page,
    loginPage,
  }) => {
    test.skip(!credentials.available, 'TEST_USER/TEST_PASSWORD not set');
    requirement('REQ-AUTH-01');

    await test.step('an app page without a session shows the sign-in form', async () => {
      await page.goto('/');
      await expect(page).toHaveURL((url) => url.pathname === '/login');
      await expect(page).toHaveTitle('Sign in · Stonewake');
      await expect(await loginPage.heading()).toBeVisible();
    });

    await test.step('valid credentials land on the Deal Book with the sidebar', async () => {
      await loginPage.login(credentials.user, credentials.password);
      await expect(page).toHaveURL((url) => url.pathname === '/');
      await expect(page).toHaveTitle('Deal Book · Stonewake');
      const app = new AppPage(page);
      await expect(app.pageHeading()).toHaveText('Deal Book');
      await expect(await app.sidebar.teamPicker()).toBeVisible();
      for (const module of ['Deal Book', 'Portfolio', 'Countries']) {
        await expect(app.sidebar.navLink(module)).toBeVisible();
      }
      await expect(await app.sidebar.signOutControl()).toBeVisible();
    });
  });

  test('ui 2 wrong password: should show an error and stay on /login when the email and password do not match @regression', async ({
    page,
    loginPage,
    data,
  }) => {
    requirement('REQ-AUTH-02');
    await loginPage.goto();
    // A RUN_ID-prefixed address that has no account, never the shared TEST_USER: repeated failed sign-ins
    // (pre-pr runs this 20+ times) could lock the account every other test signs in with. The product
    // shows the same "do not match" copy for an unknown email as for a wrong password.
    await loginPage.login(data.email(), 'not-the-password');

    await expect(await loginPage.errorMessage()).toHaveText(
      'That email and password do not match. Check both and try again.',
    );
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(await loginPage.heading()).toBeVisible();
    await expect(new AppPage(page).sidebar.root).toHaveCount(0);
  });

  test('ui 3 terms checkbox: should enable Sign in only when the terms are accepted @regression', async ({
    loginPage,
    data,
  }) => {
    requirement('REQ-AUTH-03');
    await loginPage.goto();
    const submit = await loginPage.submitButton();
    await expect(submit).toBeDisabled();

    // Never submitted: generated credentials are enough to exercise the gate.
    await loginPage.fillCredentials(data.email(), 'not-a-real-password');
    await expect(submit).toBeDisabled();

    const terms = await loginPage.termsCheckbox();
    await terms.check();
    await expect(terms).toBeChecked();
    await expect(submit).toBeEnabled();

    await terms.uncheck();
    await expect(terms).not.toBeChecked();
    await expect(submit).toBeDisabled();

    await expect(await loginPage.termsOfServiceLink()).toHaveAttribute('href', 'https://stonewake.ai/terms');
  });
});
