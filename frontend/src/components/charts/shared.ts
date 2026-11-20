import type { FC } from 'react';
import { Legend } from 'recharts';

/**
 * recharts v3 + React 19: Legend's class-component typings conflict with
 * React.JSX. This alias keeps the original workaround in one place shared by
 * every lazily-loaded chart module.
 */
export const SafeLegend = Legend as unknown as FC<object>;

/** Non-empty tuple so indexed access always has a defined first entry. */
export const PIE_COLORS = ['#6366f1', '#22d3ee', '#f59e0b', '#34d399', '#f87171'] as const;
