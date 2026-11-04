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
    else if (a !== null && b !== null && (direction === 'asc' ? a > b : a < b))
      out.push(`#${i}=${a} then #${i + 1}=${b}`);
  }
  return out;
}

export const toEpoch = (iso: string | null): number | null => (iso === null ? null : Date.parse(iso));

/** Documented rule (network): current edges come before closed ones. Returns the first closed-then-current index. */
export function currentBeforeClosedViolations(current: readonly boolean[]): string[] {
  const firstClosed = current.indexOf(false);
  const lateCurrent = firstClosed === -1 ? -1 : current.indexOf(true, firstClosed);
  return lateCurrent === -1 ? [] : [`closed edge #${firstClosed} before current edge #${lateCurrent}`];
}

/** Network edges whose endpoints are missing from the served node list (dangling references). */
export function danglingEdges(
  nodes: readonly { node_id: number }[],
  edges: readonly { id: number; src_node_id: number; dst_node_id: number }[],
): number[] {
  const ids = new Set(nodes.map((n) => n.node_id));
  return edges.filter((e) => !ids.has(e.src_node_id) || !ids.has(e.dst_node_id)).map((e) => e.id);
}
