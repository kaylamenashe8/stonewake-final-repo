import { readFile } from 'node:fs/promises';
import type { Download } from '@playwright/test';

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
  return { filename: download.suggestedFilename(), bytes: content.length, magic: content.subarray(0, 5).toString('latin1') };
}
