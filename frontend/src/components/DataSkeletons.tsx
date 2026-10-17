import React from 'react';

/**
 * Content-shaped skeleton loaders for PayD's major data views (#1501).
 *
 * Each composite mirrors the layout of the content it stands in for (tables,
 * stat cards, card lists, charts, whole dashboards) so the page doesn't jump
 * when data arrives. They share the `.skeleton-shimmer` tokens, which flatten
 * automatically under `prefers-reduced-motion`.
 *
 * Accessibility: the wrapper is a polite `role="status"` region with
 * `aria-busy` and a visually hidden label; the placeholder shapes themselves
 * are `aria-hidden` so screen readers hear one "Loading …" message instead of
 * dozens of empty elements.
 */

const cx = (...classes: Array<string | false | undefined>) => classes.filter(Boolean).join(' ');

/** A single shimmering placeholder shape. */
export function SkeletonBone({
  className = '',
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <span aria-hidden="true" className={cx('skeleton-shimmer block', className)} style={style} />
  );
}

interface SkeletonRegionProps {
  /** Announced to assistive tech while loading, e.g. "Loading employees". */
  label: string;
  children: React.ReactNode;
  className?: string;
}

/** Accessible wrapper that announces a loading state once. */
export function SkeletonRegion({ label, children, className }: SkeletonRegionProps) {
  return (
    <div role="status" aria-live="polite" aria-busy="true" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
}

// Columns beyond the first two collapse on narrow screens so the skeleton
// matches tables that hide or scroll secondary columns on mobile.
const columnVisibility = (index: number) =>
  index >= 4 ? 'hidden lg:block' : index >= 2 ? 'hidden sm:block' : 'block';

const CELL_WIDTHS = ['w-3/4', 'w-1/2', 'w-2/3', 'w-5/12', 'w-3/5', 'w-1/3'];

interface TableSkeletonProps {
  label?: string;
  rows?: number;
  columns?: number;
  /** Render a leading avatar circle in the first column (e.g. people lists). */
  withAvatar?: boolean;
  className?: string;
}

/** Placeholder for a data table: header row plus `rows` body rows. */
export function TableSkeleton({
  label = 'Loading table',
  rows = 5,
  columns = 4,
  withAvatar = false,
  className,
}: TableSkeletonProps) {
  const cols = Array.from({ length: columns }, (_, i) => i);
  const gridStyle = { gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` };

  return (
    <SkeletonRegion label={label} className={cx('skeleton-surface overflow-hidden', className)}>
      <div
        className="grid gap-4 border-b border-[var(--border)] bg-[var(--surface-hi)] px-4 py-3 sm:px-6"
        style={gridStyle}
      >
        {cols.map((col) => (
          <SkeletonBone key={col} className={cx('h-3 w-1/2 rounded-full', columnVisibility(col))} />
        ))}
      </div>
      {Array.from({ length: rows }, (_, row) => (
        <div
          key={row}
          className="grid items-center gap-4 border-b border-[var(--border)] px-4 py-4 last:border-b-0 sm:px-6"
          style={gridStyle}
        >
          {cols.map((col) =>
            col === 0 && withAvatar ? (
              <div key={col} className="flex items-center gap-3">
                <SkeletonBone className="h-9 w-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <SkeletonBone className="h-3.5 w-3/4 rounded-full" />
                  <SkeletonBone className="h-3 w-1/2 rounded-full" />
                </div>
              </div>
            ) : (
              <SkeletonBone
                key={col}
                className={cx(
                  'h-3.5 rounded-full',
                  CELL_WIDTHS[(row + col) % CELL_WIDTHS.length],
                  columnVisibility(col)
                )}
              />
            )
          )}
        </div>
      ))}
    </SkeletonRegion>
  );
}

interface StatCardsSkeletonProps {
  label?: string;
  count?: number;
  /** Tailwind grid classes; defaults to the auto-fit `.stat-grid` used by <StatCardGrid>. */
  gridClassName?: string;
  className?: string;
}

/** Placeholder for a row of KPI / summary cards. */
export function StatCardsSkeleton({
  label = 'Loading summary',
  count = 4,
  gridClassName,
  className,
}: StatCardsSkeletonProps) {
  // Matches <StatCardGrid>/<StatCard> geometry so the swap to real data
  // doesn't shift the layout. A custom gridClassName opts out of the
  // auto-fit grid for legacy callers.
  return (
    <SkeletonRegion label={label} className={className}>
      <div className={gridClassName ? cx('grid gap-4', gridClassName) : 'stat-grid'}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton-surface stat-card">
            <div className="stat-card-head">
              <SkeletonBone className="h-3.5 w-24 rounded-full" />
              <SkeletonBone className="h-9 w-9 rounded-xl" />
            </div>
            <SkeletonBone className="h-8 w-32 rounded-lg" />
            <SkeletonBone className="h-3 w-20 rounded-full" />
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

interface CardListSkeletonProps {
  label?: string;
  count?: number;
  /** Tailwind grid classes for the list; defaults to a single column. */
  gridClassName?: string;
  className?: string;
}

/** Placeholder for stacked content cards (transactions, contracts, insights). */
export function CardListSkeleton({
  label = 'Loading items',
  count = 3,
  gridClassName = 'grid-cols-1',
  className,
}: CardListSkeletonProps) {
  return (
    <SkeletonRegion label={label} className={className}>
      <div className={cx('grid gap-4', gridClassName)}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton-surface p-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <SkeletonBone className="h-5 w-20 rounded-full" />
                <SkeletonBone className="h-5 w-16 rounded-full" />
              </div>
              <SkeletonBone className="h-3 w-24 rounded-full" />
            </div>
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 space-y-2.5">
                <SkeletonBone className="h-4 w-3/5 rounded-full" />
                <SkeletonBone className="h-3 w-2/5 rounded-full" />
              </div>
              <SkeletonBone className="h-6 w-24 shrink-0 rounded-lg" />
            </div>
          </div>
        ))}
      </div>
    </SkeletonRegion>
  );
}

// Bar heights (percent of the plot area); the values are unique so they double as keys.
const CHART_BARS = [45, 70, 55, 85, 60, 92, 74, 66];

interface ChartSkeletonProps {
  label?: string;
  /** Height of the plot area in pixels. */
  height?: number;
  className?: string;
}

/** Placeholder for a chart panel: title, legend and a bar silhouette. */
export function ChartPanelSkeleton({
  label = 'Loading chart',
  height = 220,
  className,
}: ChartSkeletonProps) {
  return (
    <SkeletonRegion label={label} className={cx('skeleton-surface p-5', className)}>
      <div className="mb-5 flex items-center justify-between gap-4">
        <SkeletonBone className="h-4 w-40 rounded-full" />
        <div className="hidden gap-2 sm:flex">
          <SkeletonBone className="h-3 w-14 rounded-full" />
          <SkeletonBone className="h-3 w-14 rounded-full" />
        </div>
      </div>
      <div className="flex items-end gap-2 sm:gap-3" style={{ height }}>
        {CHART_BARS.map((pct, i) => (
          <SkeletonBone
            key={pct}
            className={cx('flex-1 rounded-t-lg', i >= 5 && 'hidden sm:block')}
            style={{ height: `${pct}%` }}
          />
        ))}
      </div>
    </SkeletonRegion>
  );
}

interface DashboardSkeletonProps {
  label?: string;
  statCount?: number;
  className?: string;
}

/** Full dashboard placeholder: KPI row, chart panel and a table. */
export function DashboardSkeleton({
  label = 'Loading dashboard',
  statCount = 4,
  className,
}: DashboardSkeletonProps) {
  return (
    <SkeletonRegion label={label} className={cx('space-y-6', className)}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: statCount }, (_, i) => (
          <div key={i} className="skeleton-surface space-y-4 p-5">
            <SkeletonBone className="h-3 w-24 rounded-full" />
            <SkeletonBone className="h-7 w-32 rounded-lg" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="skeleton-surface p-5 xl:col-span-2">
          <SkeletonBone className="mb-5 h-4 w-40 rounded-full" />
          <SkeletonBone className="h-56 w-full rounded-xl" />
        </div>
        <div className="skeleton-surface space-y-3 p-5">
          <SkeletonBone className="mb-2 h-4 w-32 rounded-full" />
          {Array.from({ length: 5 }, (_, i) => (
            <div key={i} className="flex items-center gap-3">
              <SkeletonBone className="h-8 w-8 shrink-0 rounded-full" />
              <SkeletonBone className="h-3 flex-1 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    </SkeletonRegion>
  );
}
