import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { DealBookOrder } from './pages/DealBookOrder';

/** Non-increasing (highest or newest first); ties keep any order. */
const descending = (values: number[]): number[] => [...values].sort((a, b) => b - a);

const collator = new Intl.Collator('en', { sensitivity: 'base' });

test.describe('Deal Book order @regression', () => {
  test('should list deals from highest to lowest score when the order is Score', async ({ page }) => {
    requirement('T04');
    const dealBook = new DealBookOrder(page);
    await dealBook.open();

    const serverOrder = await test.step('pick Order: Score', () => dealBook.orderBy('score'));

    await test.step('the list shows the server order, highest score first', async () => {
      await expect(page).toHaveURL(/[?&]sort=score(&|$)/);
      // Polled: the rows re-render after the sorted response; until then the default order is on screen.
      await expect.poll(() => dealBook.visibleDealPaths()).toEqual(serverOrder);
      const scores = await dealBook.visibleScores();
      expect(scores.length).toBeGreaterThan(1);
      expect(scores.every(Number.isFinite)).toBe(true);
      expect(scores).toEqual(descending(scores));
    });
  });

  test('should list deals alphabetically by name when the order is Name', async ({ page }) => {
    requirement('T04');
    const dealBook = new DealBookOrder(page);
    await dealBook.open();

    const serverOrder = await test.step('pick Order: Name', () => dealBook.orderBy('name'));

    await test.step('the list shows the server order, A to Z', async () => {
      await expect(page).toHaveURL(/[?&]sort=name(&|$)/);
      await expect.poll(() => dealBook.visibleDealPaths()).toEqual(serverOrder);
      const names = await dealBook.visibleDealNames();
      expect(names.length).toBeGreaterThan(1);
      // Case-insensitive: the list shows "ACC UK Group ..." before "Aclara Project ...".
      expect(names).toEqual([...names].sort(collator.compare));
    });
  });

  test('should list the most recently active deals first when the order is Last activity', async ({ page }) => {
    requirement('T04');
    const dealBook = new DealBookOrder(page);
    await dealBook.open();

    const serverOrder = await test.step('pick Order: Last activity', () => dealBook.orderBy('last_activity'));

    await test.step('the list shows the server order, newest activity first', async () => {
      await expect(page).toHaveURL(/[?&]sort=last_activity(&|$)/);
      await expect.poll(() => dealBook.visibleDealPaths()).toEqual(serverOrder);
      const dates = await dealBook.visibleLastActivity();
      expect(dates.length).toBeGreaterThan(1);
      expect(dates.every(Number.isFinite)).toBe(true);
      expect(dates).toEqual(descending(dates));
    });
  });
});
