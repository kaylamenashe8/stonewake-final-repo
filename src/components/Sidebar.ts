import type { Locator, Page } from '@playwright/test';
import { Healer } from '../utils/healing';
import { by, element } from '../pages/spec';
import { linkHref } from './links';

/** A module link as the sidebar shows it: visible name and target path. */
export interface SidebarModule {
  name: string;
  path: string;
}

/**
 * Stonewake app sidebar (role complementary): team picker, module navigation, account actions.
 * The module list depends on the workspace's team (C5), so callers read it from navLinks() instead of
 * assuming a fixed set. Never change the team picker in tests: it is workspace state shared by every worker.
 */
export class Sidebar {
  /**
   * The landmark itself is a plain locator, not an ElementSpec: signed-out tests assert it is absent
   * (toHaveCount(0)), and the healer throws when nothing matches.
   */
  readonly root: Locator;
  private readonly healer: Healer;

  readonly team = element('Sidebar > Team', by.role('combobox', 'Team'), by.label('Team'));
  readonly signOutButton = element('Sidebar > Sign out', by.role('button', 'Sign out'), by.text('Sign out'));

  constructor(readonly page: Page) {
    this.healer = new Healer(page);
    this.root = page.getByRole('complementary');
  }

  teamPicker(): Promise<Locator> {
    return this.healer.locate(this.team);
  }

  signOutControl(): Promise<Locator> {
    return this.healer.locate(this.signOutButton);
  }

  /** Module links inside the sidebar's navigation landmark, in display order. */
  navLinks(): Locator {
    return this.root.getByRole('navigation').getByRole('link');
  }

  /** Name and path of every module link the sidebar shows, in display order. */
  async modules(): Promise<SidebarModule[]> {
    const modules: SidebarModule[] = [];
    for (const link of await this.navLinks().all()) {
      modules.push({ name: (await link.innerText()).trim(), path: await linkHref(link) });
    }
    return modules;
  }

  navLink(name: string): Locator {
    return this.root.getByRole('navigation').getByRole('link', { name, exact: true });
  }

  async signOut(): Promise<void> {
    await (await this.signOutControl()).click();
  }
}
