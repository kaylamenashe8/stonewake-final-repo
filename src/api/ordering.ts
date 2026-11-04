/**
 * Pure helpers for sort-contract checks. Kept out of specs so tests stay free of branching.
 * Documented rule (GET /v1/deals): rows without a value come last in both directions.
 */
export type Direction = 'asc' | 'desc';

/** Index pairs (i, i+1) that break the order; empty array = correctly ordered, nulls last. */
export function orderViolations(values: readonly (number | null)[], direction: Direction): string[] {
  const out: string[] = [];
  for (let i = 0; i + 1 < values.length; i++) {
    const a = values[i] ?? null;
    const b = values[i + 1] ?? null;
    if (a === null && b !== null) out.push(`#${i} null before #${i + 1}=${b}`);
    else if (a !== null && b !== null && (direction === 'asc' ? a > b : a < b)) out.push(`#${i}=${a} then #${i + 1}=${b}`);
  }
  return out;
}

export const toEpoch = (iso: string | null): number | null => (iso === null ? null : Date.parse(iso));
