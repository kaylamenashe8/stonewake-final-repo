import { expect, type Locator, type Page } from '@playwright/test';
import { Sidebar } from '../components/Sidebar';
import { BasePage } from './BasePage';

/** Any signed-in Stonewake page: sidebar plus one level-1 heading in main. */
export class AppPage extends BasePage {
  protected readonly path: string = '/';
  readonly sidebar: Sidebar;

  constructor(page: Page) {
    super(page);
    this.sidebar = new Sidebar(page);
  }

  /** The page's level-1 heading; there is exactly one per page. */
  pageHeading(): Locator {
    return this.page.getByRole('main').getByRole('heading', { level: 1 });
  }

  /** Level-2 section heading by exact name (e.g. "Briefing", "Country risk"). */
  section(name: string): Locator {
    return this.page.getByRole('main').getByRole('heading', { level: 2, name, exact: true });
  }

  override async waitUntilReady(): Promise<void> {
    await expect(this.pageHeading()).toBeVisible();
  }
}
