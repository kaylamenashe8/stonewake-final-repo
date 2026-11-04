import { expect, type Locator } from '@playwright/test';
import { BasePage } from './BasePage';
import { by, element } from './spec';

/**
 * Stonewake sign-in form (/login): Email, Password, a custom "I agree to the Evaluation Terms" checkbox
 * (button[role=checkbox]) that gates the "Sign in" button, and an "Email me a link" button that must never
 * match the Sign in locator (F10). Primaries are role/label; alternates stay as heal fallbacks.
 */
export class LoginPage extends BasePage {
  protected override readonly path = process.env.LOGIN_PATH ?? '/login';

  readonly heading = element('Login > Heading', by.role('heading', 'Sign in'), by.css('main h1, h1'));

  readonly username = element(
    'Login > Email',
    by.label('Email'),
    by.role('textbox', 'Email'),
    by.css('input[type="email"]'),
  );

  readonly password = element('Login > Password', by.label('Password'), by.css('input[type="password"]'));

  readonly terms = element(
    'Login > Terms checkbox',
    by.role('checkbox', /agree to the .*terms/i),
    by.css('button[role="checkbox"]'),
  );

  readonly submit = element(
    'Login > Sign in',
    by.role('button', /^(log ?in|sign ?in)$/i),
    by.css('button[type="submit"]'),
  );

  readonly termsOfService = element(
    'Login > Terms of Service link',
    by.role('link', 'Terms of Service'),
    by.css('a[href$="/terms"]'),
  );

  readonly error = element('Login > Error', by.text(/do not match/i), by.role('alert'));

  override async waitUntilReady(): Promise<void> {
    await expect(await this.el(this.heading)).toBeVisible();
  }

  headingText(): Promise<Locator> {
    return this.el(this.heading);
  }

  submitButton(): Promise<Locator> {
    return this.el(this.submit);
  }

  termsCheckbox(): Promise<Locator> {
    return this.el(this.terms);
  }

  termsOfServiceLink(): Promise<Locator> {
    return this.el(this.termsOfService);
  }

  errorMessage(): Promise<Locator> {
    return this.el(this.error);
  }

  async fillCredentials(user: string, pass: string): Promise<void> {
    await (await this.el(this.username)).fill(user);
    await (await this.el(this.password)).fill(pass);
  }

  /** Idempotent: the tick is remembered in localStorage (exfin.terms-tick), so check() rather than click(). */
  async acceptTerms(): Promise<void> {
    await (await this.el(this.terms)).check();
  }

  async login(user: string, pass: string): Promise<void> {
    await this.fillCredentials(user, pass);
    await this.acceptTerms();
    await (await this.el(this.submit)).click();
  }

  /** Used by auth.setup only; feature tests assert on their own landing page. */
  async expectLoggedIn(): Promise<void> {
    await expect(this.page).not.toHaveURL(/\/login/);
    await expect(this.page.getByLabel('Password', { exact: true })).toBeHidden();
  }
}
