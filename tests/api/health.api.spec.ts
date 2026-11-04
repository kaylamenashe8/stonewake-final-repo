import { test, expect } from '../../src/fixtures';

// @api project (no browser). The API agent replaces this with endpoint specs from docs/API_MAP.md.
test.describe('API health @api', () => {
  test('should answer the base URL with a non-error status when requested', async ({ api }) => {
    const res = await api.call('GET', '/');
    expect(res.status).toBeLessThan(500);
  });
});
