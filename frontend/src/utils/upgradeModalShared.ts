/**
 * Shared constants / pure helpers for the upgrade modal step components.
 *
 * Kept in a plain `.ts` util (rather than a component file) so the React
 * step files remain components-only for react-refresh / linting purposes.
 */

import type { MigrationStep } from '../services/contractUpgrade';

export const INPUT_CLASS =
  'w-full bg-black/20 border border-hi rounded-xl p-4 text-text outline-none ' +
  'focus:border-accent/50 focus:bg-accent/5 transition-all font-mono text-sm';

export const LABEL_CLASS = 'block text-xs font-bold uppercase tracking-widest text-muted mb-2 ml-1';

export function migrationProgress(steps: MigrationStep[]): {
  completed: number;
  total: number;
  percent: number;
} {
  if (steps.length === 0) return { completed: 0, total: 0, percent: 0 };
  const completed = steps.filter((s) => s.status === 'completed').length;
  return {
    completed,
    total: steps.length,
    percent: Math.round((completed / steps.length) * 100),
  };
}
