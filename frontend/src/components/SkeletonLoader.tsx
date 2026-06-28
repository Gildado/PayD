import type { CSSProperties } from 'react';

// ── Types ─────────────────────────────────────────────────────────────────────

export type SkeletonVariant = 'text' | 'card' | 'table-row' | 'avatar' | 'badge' | 'chart';

interface SkeletonBaseProps {
  /** Number of repeated skeleton lines/rows to render. Defaults to 1. */
  count?: number;
  /** Additional Tailwind classes applied to each skeleton element. */
  className?: string;
}

interface SkeletonTextProps extends SkeletonBaseProps {
  variant: 'text';
  /** Approximate width of each line. Defaults to 'full'. */
  width?: 'full' | '3/4' | '2/3' | '1/2' | '1/3' | '1/4';
}

interface SkeletonCardProps extends SkeletonBaseProps {
  variant: 'card';
  /** Height of the card skeleton in Tailwind units. Defaults to 32. */
  height?: number;
}

interface SkeletonTableRowProps extends SkeletonBaseProps {
  variant: 'table-row';
  /** Number of columns per row. Defaults to 4. */
  columns?: number;
}

interface SkeletonAvatarProps extends SkeletonBaseProps {
  variant: 'avatar';
  /** Avatar size in pixels. Defaults to 40. */
  size?: number;
}

interface SkeletonBadgeProps extends SkeletonBaseProps {
  variant: 'badge';
}

interface SkeletonChartProps extends SkeletonBaseProps {
  variant: 'chart';
  /** Height of the chart placeholder in pixels. Defaults to 200. */
  height?: number;
}

export type SkeletonProps =
  | SkeletonTextProps
  | SkeletonCardProps
  | SkeletonTableRowProps
  | SkeletonAvatarProps
  | SkeletonBadgeProps
  | SkeletonChartProps;

// ── Width map ─────────────────────────────────────────────────────────────────

const WIDTH_MAP: Record<NonNullable<SkeletonTextProps['width']>, string> = {
  full: 'w-full',
  '3/4': 'w-3/4',
  '2/3': 'w-2/3',
  '1/2': 'w-1/2',
  '1/3': 'w-1/3',
  '1/4': 'w-1/4',
};

// ── Base shimmer element ──────────────────────────────────────────────────────

const SHIMMER_BASE = 'animate-pulse rounded bg-zinc-800/70 relative overflow-hidden';

// ── Renderers ─────────────────────────────────────────────────────────────────

function TextSkeleton({ count = 1, width = 'full', className = '' }: SkeletonTextProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          role="presentation"
          aria-hidden
          className={`block h-3.5 ${WIDTH_MAP[width]} ${SHIMMER_BASE} ${className}`}
          style={
            count > 1
              ? ({ '--index': i, width: `calc(100% - ${i * 8}%)` } as CSSProperties)
              : undefined
          }
        />
      ))}
    </>
  );
}

function CardSkeleton({ count = 1, height = 32, className = '' }: SkeletonCardProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="presentation"
          aria-hidden
          className={`w-full ${SHIMMER_BASE} ${className}`}
          style={{ height: `${height * 4}px` }}
        />
      ))}
    </>
  );
}

function TableRowSkeleton({ count = 3, columns = 4, className = '' }: SkeletonTableRowProps) {
  return (
    <>
      {Array.from({ length: count }, (_, rowIdx) => (
        <tr key={rowIdx} role="presentation" aria-hidden>
          {Array.from({ length: columns }, (_, colIdx) => (
            <td key={colIdx} className="py-2.5 pr-4">
              <span
                className={`block h-3.5 ${SHIMMER_BASE} ${className}`}
                style={{ width: `${60 + ((colIdx * 13) % 35)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function AvatarSkeleton({ count = 1, size = 40, className = '' }: SkeletonAvatarProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          role="presentation"
          aria-hidden
          className={`block shrink-0 rounded-full ${SHIMMER_BASE} ${className}`}
          style={{ width: size, height: size }}
        />
      ))}
    </>
  );
}

function BadgeSkeleton({ count = 1, className = '' }: SkeletonBadgeProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          role="presentation"
          aria-hidden
          className={`inline-block h-5 w-16 rounded-full ${SHIMMER_BASE} ${className}`}
        />
      ))}
    </>
  );
}

function ChartSkeleton({ count = 1, height = 200, className = '' }: SkeletonChartProps) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          role="presentation"
          aria-hidden
          className={`w-full ${SHIMMER_BASE} ${className}`}
          style={{ height }}
        />
      ))}
    </>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

/**
 * Composable skeleton loader component supporting multiple layout variants.
 *
 * All variants are fully accessible: each element carries `role="presentation"`
 * and `aria-hidden` so screen readers skip the placeholder content.
 *
 * @example
 * // Text skeleton — 3 lines with narrowing widths
 * <SkeletonLoader variant="text" count={3} />
 *
 * @example
 * // Card placeholder
 * <SkeletonLoader variant="card" height={48} />
 *
 * @example
 * // Table rows inside a tbody
 * <tbody>
 *   <SkeletonLoader variant="table-row" count={5} columns={6} />
 * </tbody>
 *
 * @example
 * // Avatar with custom size
 * <SkeletonLoader variant="avatar" size={56} />
 */
export function SkeletonLoader(props: SkeletonProps) {
  switch (props.variant) {
    case 'text':
      return <TextSkeleton {...props} />;
    case 'card':
      return <CardSkeleton {...props} />;
    case 'table-row':
      return <TableRowSkeleton {...props} />;
    case 'avatar':
      return <AvatarSkeleton {...props} />;
    case 'badge':
      return <BadgeSkeleton {...props} />;
    case 'chart':
      return <ChartSkeleton {...props} />;
  }
}
