import { readFile } from 'node:fs/promises';
import type { Download } from '@playwright/test';

/** Bytes needed for the longest signature checked (%PDF-). */
const SIGNATURE_BYTES = 5;

/** Smaller than any real export; catches empty or error-page downloads. */
export const MIN_EXPORT_BYTES = 1_000;

export interface SavedFile {
  filename: string;
  bytes: number;
  /** First bytes as latin1, enough to check the file signature (PK for xlsx, %PDF- for pdf). */
  magic: string;
}

/** Waits for the download to finish and returns its name, size and file signature. */
export async function savedFile(download: Download): Promise<SavedFile> {
  const failure = await download.failure();
  if (failure) throw new Error(`download failed: ${failure}`);
  const content = await readFile(await download.path());
  return {
    filename: download.suggestedFilename(),
    bytes: content.length,
    magic: content.subarray(0, SIGNATURE_BYTES).toString('latin1'),
  };
}
