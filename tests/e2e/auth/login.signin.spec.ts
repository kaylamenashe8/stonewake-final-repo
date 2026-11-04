import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { Sidebar } from '../../../src/components/Sidebar';
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
    await page.goto('/');
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(page).toHaveTitle('Sign in · Stonewake');
    await expect(await loginPage.headingText()).toBeVisible();

    await loginPage.login(credentials.user, credentials.password);

    await expect(page).toHaveURL((url) => url.pathname === '/');
    await expect(page).toHaveTitle('Deal Book · Stonewake');
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveText('Deal Book');
    const sidebar = new Sidebar(page);
    await expect(await sidebar.teamPicker()).toBeVisible();
    for (const module of ['Deal Book', 'Portfolio', 'Countries']) {
      await expect(sidebar.navLink(module)).toBeVisible();
    }
    await expect(sidebar.root.getByRole('button', { name: 'Sign out', exact: true })).toBeVisible();
  });

  test('ui 2 wrong password: should show an error and stay on /login when the password is wrong @regression', async ({
    page,
    loginPage,
  }) => {
    test.skip(!credentials.available, 'TEST_USER not set');
    requirement('REQ-AUTH-02');
    await loginPage.goto();
    await loginPage.login(credentials.user, 'definitely-wrong-password-123');

    await expect(await loginPage.errorMessage()).toHaveText(
      'That email and password do not match. Check both and try again.',
    );
    await expect(page).toHaveURL((url) => url.pathname === '/login');
    await expect(await loginPage.headingText()).toBeVisible();
    await expect(new Sidebar(page).root).toHaveCount(0);
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
