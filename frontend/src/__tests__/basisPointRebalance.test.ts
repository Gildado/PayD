import { describe, it, expect } from 'vitest';
import {
  computeRebalancedBasisPoints,
  rebalanceAllocations,
  reorderList,
} from '../utils/basispointrebalance';

describe('computeRebalancedBasisPoints', () => {
  it('always sums to exactly 10000', () => {
    const cases = [
      [33.33, 33.33, 33.34],
      [10, 20, 30, 40],
      [1, 1, 1, 1, 1, 1, 1],
      [0.1, 0.2, 99.7],
      [50, 50],
      [100],
    ];

    for (const weights of cases) {
      const result = computeRebalancedBasisPoints(weights);
      expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
    }
  });

  it('preserves relative proportions as closely as integer rounding allows', () => {
    const result = computeRebalancedBasisPoints([50, 25, 25]);
    expect(result).toEqual([5000, 2500, 2500]);
  });

  it('splits evenly when all weights are zero', () => {
    const result = computeRebalancedBasisPoints([0, 0, 0]);
    expect(result).toEqual([3334, 3333, 3333]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
  });

  it('returns an empty array for no entries', () => {
    expect(computeRebalancedBasisPoints([])).toEqual([]);
  });

  it('ignores negative or non-finite weights, treating them as zero weight', () => {
    const result = computeRebalancedBasisPoints([50, Number.NaN, -10]);
    expect(result.reduce((a, b) => a + b, 0)).toBe(10000);
    expect(result[0]).toBe(10000);
  });

  it('breaks remainder ties using the current (new) order', () => {
    // Four equal weights of 25 -> each gets 2500 exactly, no remainder to distribute.
    // Three equal weights of 33.33... -> remainder must go to earliest entries.
    const result = computeRebalancedBasisPoints([1, 1, 1]);
    expect(result).toEqual([3334, 3333, 3333]);
  });
});

describe('rebalanceAllocations', () => {
  it('rebalances percentages so basis points sum to 10000 while preserving order', () => {
    const entries = [
      { id: 'a', percentage: 33.33 },
      { id: 'b', percentage: 33.33 },
      { id: 'c', percentage: 33.33 },
    ];

    const result = rebalanceAllocations(entries);
    const totalBasisPoints = result.reduce(
      (sum, entry) => sum + Math.round(entry.percentage * 100),
      0
    );

    expect(totalBasisPoints).toBe(10000);
    expect(result.map((entry) => entry.id)).toEqual(['a', 'b', 'c']);
  });

  it('re-derives proportions after a reorder swap', () => {
    const original = [
      { id: 'a', percentage: 60 },
      { id: 'b', percentage: 25 },
      { id: 'c', percentage: 15 },
    ];

    const reordered = reorderList(original, 0, 2); // move 'a' to the end
    const rebalanced = rebalanceAllocations(reordered);

    expect(rebalanced.map((entry) => entry.id)).toEqual(['b', 'c', 'a']);
    expect(rebalanced.find((entry) => entry.id === 'a')?.percentage).toBeCloseTo(60, 5);
    const total = rebalanced.reduce((sum, entry) => sum + Math.round(entry.percentage * 100), 0);
    expect(total).toBe(10000);
  });
});

describe('reorderList', () => {
  it('moves an item from source to destination index without mutating input', () => {
    const original = ['a', 'b', 'c', 'd'];
    const result = reorderList(original, 0, 2);

    expect(result).toEqual(['b', 'c', 'a', 'd']);
    expect(original).toEqual(['a', 'b', 'c', 'd']);
  });

  it('handles moving an item backwards', () => {
    const result = reorderList(['a', 'b', 'c', 'd'], 3, 1);
    expect(result).toEqual(['a', 'd', 'b', 'c']);
  });
});
