import { test, expect } from '../../src/fixtures';
import { requirement } from '../../src/utils/annotations';
import { DealBookPage } from './pages/DealBookPage';
import { DealPage } from './pages/DealPage';
import { MIN_EXPORT_BYTES, savedFile } from './pages/downloads';

test.describe('Deal report PDF @regression', () => {
  test('should download a PDF report named after the deal when Download report is clicked', async ({
    page,
  }) => {
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
    // A prefix only: long deal names may be shortened in the filename.
    const NAME_PREFIX_CHARS = 24;
    expect(lettersOnly(file.filename)).toContain(lettersOnly(listed.name).slice(0, NAME_PREFIX_CHARS));
    expect(file.magic).toBe('%PDF-');
    expect(file.bytes).toBeGreaterThan(MIN_EXPORT_BYTES);
  });
});
