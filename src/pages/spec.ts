import type { Page } from '@playwright/test';
import type { Alternate, ElementSpec } from '../utils/healing';

type AriaRole = Parameters<Page['getByRole']>[0];

/**
 * Builders that keep ElementSpecs short and enforce the locator order:
 * getByRole+name > getByLabel > getByTestId > getByText > scoped CSS.
 */
export const by = {
  /** A string name is matched exactly; use a RegExp for partial matches. Omit name for unnamed roles (alert). */
  role: (role: AriaRole, name?: string | RegExp): Alternate => ({
    strategy: 'role',
    describe: name === undefined ? `getByRole('${role}')` : `getByRole('${role}', { name: ${String(name)} })`,
    build: (p) =>
      name === undefined ? p.getByRole(role) : p.getByRole(role, { name, exact: typeof name === 'string' }),
  }),
  label: (label: string | RegExp): Alternate => ({
    strategy: 'label',
    describe: `getByLabel(${String(label)})`,
    build: (p) => p.getByLabel(label, { exact: typeof label === 'string' }),
  }),
  testId: (id: string): Alternate => ({
    strategy: 'testid',
    describe: `getByTestId('${id}')`,
    build: (p) => p.getByTestId(id),
  }),
  text: (text: string | RegExp): Alternate => ({
    strategy: 'text',
    describe: `getByText(${String(text)})`,
    build: (p) => p.getByText(text),
  }),
  css: (selector: string): Alternate => ({
    strategy: 'css',
    describe: `locator('${selector}')`,
    build: (p) => p.locator(selector),
  }),
};

/** element('Login > Submit', by.role('button', 'Login'), by.testId('login-button')) */
export function element(name: string, primary: Alternate, ...alternates: Alternate[]): ElementSpec {
  const role =
    primary.strategy === 'role' ? /getByRole\('([^']+)', \{ name: (.+) \}\)/.exec(primary.describe) : null;
  return {
    element: name,
    primary: primary.build,
    primaryDescribe: primary.describe,
    alternates,
    ...(role?.[1] && role[2] && !role[2].startsWith('/')
      ? { fuzzy: { role: role[1] as AriaRole, name: role[2] } }
      : {}),
  };
}
