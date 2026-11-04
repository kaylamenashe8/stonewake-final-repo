import type { Locator, Page } from '@playwright/test';
import { Healer } from '../utils/healing';
import { by, element } from '../pages/spec';

/**
 * Stonewake app sidebar (role complementary): team picker, module navigation, account actions.
 * The module list depends on the workspace's team (C5), so callers read it from navLinks() instead of
 * assuming a fixed set. Never change the team picker in tests: it is workspace state shared by every worker.
 */
export class Sidebar {
  readonly root: Locator;
  private readonly healer: Healer;

  readonly sidebar = element('Sidebar', by.role('complementary'), by.css('#app-sidebar'), by.css('aside'));
  readonly team = element('Sidebar > Team', by.role('combobox', 'Team'), by.label('Team'));
  readonly signOutButton = element('Sidebar > Sign out', by.role('button', 'Sign out'), by.text('Sign out'));

  constructor(readonly page: Page) {
    this.healer = new Healer(page);
    this.root = page.getByRole('complementary');
  }

  container(): Promise<Locator> {
    return this.healer.locate(this.sidebar);
  }

  teamPicker(): Promise<Locator> {
    return this.healer.locate(this.team);
  }

  /** Module links inside the sidebar's navigation landmark, in display order. */
  navLinks(): Locator {
    return this.root.getByRole('navigation').getByRole('link');
  }

  navLink(name: string): Locator {
    return this.root.getByRole('navigation').getByRole('link', { name, exact: true });
  }

  async signOut(): Promise<void> {
    await (await this.healer.locate(this.signOutButton)).click();
  }
}
