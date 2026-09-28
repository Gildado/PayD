/**
 * Basis-point rebalancing for revenue split recipients.
 *
 * Revenue split percentages are stored client-side as floating point values
 * (0-100) but ultimately settle on-chain as integer basis points (0-10000)
 * that must sum to exactly 10000. Naively converting each percentage to
 * basis points independently (`Math.round(percentage * 100)`) can leave the
 * total a few basis points off from 10000 due to rounding.
 *
 * Reordering recipients changes visual/report priority and execution order,
 * so whenever a reorder happens we recompute the basis-point distribution
 * using the "largest remainder" method (a.k.a. Hamilton's method): each
 * recipient gets the floor of its proportional share, and any leftover
 * basis points (to reach exactly 10000) are handed out one at a time to the
 * recipients with the largest fractional remainder, using the *new* order
 * as the tie-breaker. This keeps relative proportions intact while
 * guaranteeing the total always equals 10000 bps.
 */

const TOTAL_BASIS_POINTS = 10000;

export interface RebalanceEntry {
  percentage: number;
}

/**
 * Given an ordered list of relative weights (e.g. current percentages),
 * returns integer basis points for each entry, in the same order, that
 * always sum to exactly 10000. Relative proportions are preserved as
 * closely as integer rounding allows.
 */
export function computeRebalancedBasisPoints(weights: number[]): number[] {
  const safeWeights = weights.map((weight) => (Number.isFinite(weight) && weight > 0 ? weight : 0));
  const totalWeight = safeWeights.reduce((sum, weight) => sum + weight, 0);

  if (safeWeights.length === 0) {
    return [];
  }

  if (totalWeight <= 0) {
    // No usable weights (e.g. all zero) — split as evenly as possible.
    const base = Math.floor(TOTAL_BASIS_POINTS / safeWeights.length);
    const remainder = TOTAL_BASIS_POINTS - base * safeWeights.length;
    return safeWeights.map((_, index) => base + (index < remainder ? 1 : 0));
  }

  const raw = safeWeights.map((weight) => (weight / totalWeight) * TOTAL_BASIS_POINTS);
  const floors = raw.map((value) => Math.floor(value));
  const distributed = floors.reduce((sum, value) => sum + value, 0);
  let remainder = TOTAL_BASIS_POINTS - distributed;

  const remainders = raw
    .map((value, index) => ({ index, frac: value - floors[index] }))
    // Largest fractional remainder first; ties broken by current (new) order
    // so that earlier-positioned recipients win ties, matching the visual
    // priority conveyed by the new ordering.
    .sort((a, b) => b.frac - a.frac || a.index - b.index);

  const result = [...floors];
  for (let i = 0; i < remainders.length && remainder > 0; i += 1) {
    result[remainders[i].index] += 1;
    remainder -= 1;
  }

  return result;
}

/**
 * Rebalances a list of recipients (in their new order) so the underlying
 * basis points sum to exactly 10000, returning updated percentages
 * (0-100, two decimal precision) alongside the original entries.
 */
export function rebalanceAllocations<T extends RebalanceEntry>(entries: T[]): T[] {
  const basisPoints = computeRebalancedBasisPoints(entries.map((entry) => entry.percentage));

  return entries.map((entry, index) => ({
    ...entry,
    percentage: basisPoints[index] / 100,
  }));
}

/**
 * Moves the item at `sourceIndex` to `destinationIndex` within a new array
 * (does not mutate the input) — the standard reorder helper used by
 * drag-and-drop reorder handlers.
 */
export function reorderList<T>(list: T[], sourceIndex: number, destinationIndex: number): T[] {
  const result = [...list];
  const [moved] = result.splice(sourceIndex, 1);
  result.splice(destinationIndex, 0, moved);
  return result;
}
