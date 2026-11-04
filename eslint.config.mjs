// Lint is the enforcement layer for the coding standards in CLAUDE.md.
// The Architect may start with LINT_LEVEL=warn on an inherited repo, then flip to error.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import playwright from 'eslint-plugin-playwright';
import prettier from 'eslint-config-prettier';

const level = process.env.LINT_LEVEL === 'warn' ? 'warn' : 'error';

export default tseslint.config(
  {
    ignores: [
      'node_modules/**',
      'playwright-report/**',
      'test-results/**',
      'blob-report/**',
      'control-center/**',
      'crawler/out/**',
      'triage/out/**',
      '**/*.js',
      '**/*.mjs',
      // Legacy flat specs from the baseline (177 errors, 54 warnings, docs/BASELINE.md). They are being moved
      // and fixed by the Stabilizers (tests/api/existing/, tests/e2e/); the moved files are linted in full.
      // Remove these two lines once both files are gone (DECISIONS D16).
      'tests/api.spec.ts',
      'tests/ui.spec.ts',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': level,
      '@typescript-eslint/await-thenable': level,
      '@typescript-eslint/no-misused-promises': level,
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
      'no-restricted-syntax': [
        level,
        { selector: "CallExpression[callee.property.name='$']", message: 'page.$ is deprecated: use locators.' },
        { selector: "CallExpression[callee.property.name='$$']", message: 'page.$$ is deprecated: use locators.' },
        { selector: "CallExpression[callee.property.name='waitForSelector']", message: 'Use web-first assertions instead of waitForSelector.' },
        { selector: "Literal[value=/^\\/\\/|^xpath=/]", message: 'XPath is banned: use getByRole / getByLabel / getByTestId.' },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'src/**/*.ts'],
    ...playwright.configs['flat/recommended'],
    rules: {
      ...playwright.configs['flat/recommended'].rules,
      'playwright/no-wait-for-timeout': level,
      'playwright/no-force-option': level,
      'playwright/prefer-web-first-assertions': level,
      'playwright/no-conditional-in-test': level,
      'playwright/no-focused-test': 'error',
      'playwright/no-skipped-test': ['error', { allowConditional: true }],
      'playwright/no-element-handle': level,
      'playwright/no-eval': level,
      'playwright/no-page-pause': 'error',
      'playwright/no-networkidle': level,
      'playwright/expect-expect': ['error', { assertFunctionNames: ['expectNoSeriousA11y', 'expectPageScreenshot', 'expectLoggedIn'] }],
    },
  },
  {
    // Scripts, triage and crawler are Node tooling, not tests.
    files: ['scripts/**/*.ts', 'triage/**/*.ts', 'crawler/**/*.ts'],
    rules: {
      'playwright/no-conditional-in-test': 'off',
      'playwright/no-wait-for-timeout': 'off',
      'no-console': 'off',
    },
  },
  prettier,
);
