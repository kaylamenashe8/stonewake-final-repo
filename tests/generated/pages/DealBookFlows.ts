import type { Download } from '@playwright/test';
import { DealBookPage } from '../../../src/pages/DealBookPage';
import { by, element } from '../../../src/pages/spec';

/** Separator in the line under a deal name: "Country · Sector" (country may be missing). */
const SUBTITLE_SEPARATOR = ' · ';

/** Name and sector from a deal link's text: ["New",] name, "Country · Sector" (one per line). */
export function dealLinkParts(text: string): { name: string; sector: string } {
  const lines = text.trim().split('\n');
  return {
    name: lines.at(-2)?.trim() ?? '',
    sector: lines.at(-1)?.split(SUBTITLE_SEPARATOR).at(-1)?.trim() ?? '',
  };
}

/**
 * Crawler-generated Deal Book flows on top of src/pages/DealBookPage (which this lane cannot edit).
 * CHANGELOG REQUEST: fold these methods into src/pages/DealBookPage.
 */
export class DealBookFlows extends DealBookPage {
  readonly exportButton = element('Deal Book > Export', by.role('button', 'Export'));

  /** Clicks Export (POST /deals/excel) and returns the browser download. */
  async exportDeals(): Promise<Download> {
    const button = await this.el(this.exportButton);
    const download = this.page.waitForEvent('download');
    await button.click();
    return download;
  }

  /** Opens the first listed deal (client-side route to /deals/:id); returns the name and sector the list showed. */
  async openFirstDeal(): Promise<{ name: string; sector: string }> {
    // first(): the test takes whichever deal ranks first today instead of a hardcoded id.
    const link = this.dealLinks().first();
    const listed = dealLinkParts(await link.innerText());
    if (!listed.name || !listed.sector)
      throw new Error('Deal Book: cannot read name and sector of the first deal');
    await link.click();
    return listed;
  }
}
