import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { DealBookPage } from './pages/DealBookPage';
import { DealPage } from './pages/DealPage';
import { savedFile } from './pages/downloads';

test.describe('Deal report PDF @regression', () => {
  test('should download a PDF report named after the deal when Download report is clicked', async ({ page }) => {
    requirement('T03');
    const dealBook = new DealBookPage(page);
    await dealBook.open();
    const listed = await dealBook.openFirstDeal();
    const deal = new DealPage(page);
    await deal.waitUntilReady();

    const file = await savedFile(await deal.downloadReport());

    expect(file.filename).toMatch(/^Stonewake - Deal Report - .+\.pdf$/);
    // The filename drops punctuation ("A / B" -> "A B"), so compare letters and digits only.
    const lettersOnly = (s: string): string => s.replace(/[^\p{L}\p{N}]/gu, '').toLowerCase();
    expect(lettersOnly(file.filename)).toContain(lettersOnly(listed.name).slice(0, 24));
    expect(file.magic).toBe('%PDF-');
    expect(file.bytes).toBeGreaterThan(1_000);
  });
});
