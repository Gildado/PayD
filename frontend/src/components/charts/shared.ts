import type { FC } from 'react';
import { Legend } from 'recharts';

/**
 * recharts v3 + React 19: Legend's class-component typings conflict with
 * React.JSX. This alias keeps the workaround in one place shared by every
 * lazily-loaded chart module.
 */
export const SafeLegend = Legend as unknown as FC<object>;

/** Non-empty tuple so indexed access always has a defined first entry. */
export const PIE_COLORS = [
  'var(--chart-1, #3b82f6)',
  'var(--chart-2, #10b981)',
  'var(--chart-3, #f59e0b)',
  'var(--chart-4, #ef4444)',
] as const;
