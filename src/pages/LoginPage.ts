import { expect } from '@playwright/test';
import { BasePage } from './BasePage';
import { by, element } from './spec';

/**
 * Template login page: generic role/label locators that fit most products.
 * The Architect/Stabilizer adapts primaries to the real DOM on the day; alternates stay as heal fallbacks.
 */
export class LoginPage extends BasePage {
  protected readonly path = process.env.LOGIN_PATH ?? '/';

  readonly username = element(
    'Login > Username',
    by.label(/user ?name|e-?mail/i),
    by.role('textbox', /user ?name|e-?mail/i),
    by.testId('username'),
    by.css('input[name="username"], input[type="email"], #user-name'),
  );

  readonly password = element(
    'Login > Password',
    by.label(/password/i),
    by.testId('password'),
    by.css('input[type="password"]'),
  );

  readonly submit = element(
    'Login > Submit',
    by.role('button', /log ?in|sign ?in/i),
    by.testId('login-button'),
    by.css('[type="submit"]'),
  );

  readonly error = element('Login > Error', by.role('alert', /.+/), by.testId('error'), by.css('[class*="error"]'));

  async login(user: string, pass: string): Promise<void> {
    await (await this.el(this.username)).fill(user);
    await (await this.el(this.password)).fill(pass);
    // Stonewake: "Sign in" stays disabled until the terms checkbox is ticked.
    const terms = this.page.getByRole('checkbox', { name: /agree to the .*terms/i });
    if ((await terms.count()) > 0) await terms.check();
    await (await this.el(this.submit)).click();
  }

  async errorText(): Promise<string> {
    return (await this.el(this.error)).innerText();
  }

  /** Used by auth.setup only; feature tests assert on their own landing page. */
  async expectLoggedIn(): Promise<void> {
    await expect(this.page).not.toHaveURL(/login|signin|sign-in/i);
    await expect(this.page.getByLabel(/password/i)).toBeHidden();
  }
}
