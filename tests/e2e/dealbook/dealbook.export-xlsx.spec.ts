import { test, expect } from '../../../src/fixtures';
import { aiGenerated, requirement } from '../../../src/utils/annotations';
import { DealBookPage } from '../../generated/pages/DealBookPage';
import { savedFile } from '../../generated/pages/downloads';

test.describe('Deal Book Excel export @regression', () => {
  test('should download an Excel workbook when Export is clicked on the Deal Book', async ({ page }) => {
    requirement('T03');
    aiGenerated('b9c303a');
    const dealBook = new DealBookPage(page);
    await dealBook.open();

    const file = await savedFile(await dealBook.exportDeals());

    expect(file.filename).toMatch(/^Stonewake - Deal Book - \d{4}-\d{2}-\d{2}\.xlsx$/);
    expect(file.magic).toMatch(/^PK/); // xlsx is a zip container
    expect(file.bytes).toBeGreaterThan(1_000);
  });
});
