import { test, expect } from '../../../src/fixtures';
import { requirement } from '../../../src/utils/annotations';
import { AppPage } from '../../../src/pages/AppPage';

test.describe('Sidebar navigation', () => {
  test('ui 6 sidebar: should open every module listed in the sidebar when its link is clicked @regression', async ({
    page,
  }) => {
    requirement('REQ-NAV-01');
    const app = new AppPage(page);
    await app.goto();

    // The module list depends on the workspace's team (C5): drive the test from what the sidebar shows.
    // first(): readiness only, the module list has rendered before it is read.
    await expect(app.sidebar.navLinks().first()).toBeVisible();
    const modules = await app.sidebar.modules();
    expect(modules.length).toBeGreaterThan(0);

    for (const { name, path } of modules) {
      await app.sidebar.navLink(name).click();
      await expect(page, `${name} link should open ${path}`).toHaveURL((url) => url.pathname === path);
      // Heading starts with the link text ("EDD Dossier" -> "EDD Dossiers").
      await expect(app.pageHeading()).toContainText(name);
    }
  });
});
