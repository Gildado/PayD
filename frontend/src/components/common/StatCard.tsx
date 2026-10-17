import React from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { ArrowLink } from './Button';

export type StatCardTone = 'accent' | 'teal' | 'info' | 'success' | 'warning' | 'danger';

export interface StatCardTrend {
  /** Pre-formatted change, e.g. "+12.4%" or "−3". */
  value: string;
  direction: 'up' | 'down' | 'flat';
  /** Comparison context, e.g. "vs last month". */
  label?: string;
  /** Set to false when a rising figure is bad news (failures, fees). */
  upIsGood?: boolean;
  /** Show the change without good/bad colouring (e.g. headcount, total spend). */
  neutral?: boolean;
}

export interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  /** Colours the icon chip, hover border and — with `emphasizeValue` — the figure. */
  tone?: StatCardTone;
  emphasizeValue?: boolean;
  hint?: React.ReactNode;
  trend?: StatCardTrend;
  href?: string;
  linkLabel?: string;
  className?: string;
}

const TREND_ICONS = {
  up: ArrowUpRight,
  down: ArrowDownRight,
  flat: ArrowRight,
} as const;

const TREND_WORDS = { up: 'Up', down: 'Down', flat: 'No change' } as const;

function trendSentiment(trend: StatCardTrend): 'positive' | 'negative' | 'neutral' {
  if (trend.neutral || trend.direction === 'flat') return 'neutral';
  const upIsGood = trend.upIsGood ?? true;
  return (trend.direction === 'up') === upIsGood ? 'positive' : 'negative';
}

/**
 * Minimal bordered KPI card. Renders a `<dt>`/`<dd>` group, so it must be
 * placed inside a <StatCardGrid> (which renders the `<dl>`). Screen readers
 * then announce each figure together with its label.
 */
export const StatCard: React.FC<StatCardProps> = ({
  label,
  value,
  icon,
  tone = 'accent',
  emphasizeValue = false,
  hint,
  trend,
  href,
  linkLabel,
  className,
}) => {
  const TrendIcon = trend ? TREND_ICONS[trend.direction] : null;
  const hasFoot = Boolean(trend || hint || href);

  return (
    <div
      className={['stat-card', className ?? ''].filter(Boolean).join(' ')}
      data-tone={tone}
      data-emphasis={emphasizeValue ? 'true' : undefined}
    >
      <div className="stat-card-head">
        <dt className="stat-card-label">{label}</dt>
        {icon ? (
          <span className="stat-card-icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
      </div>
      <dd className="stat-card-value">{value}</dd>
      {hasFoot ? (
        <dd className="stat-card-foot">
          {trend && TrendIcon ? (
            <span className="stat-card-trend" data-sentiment={trendSentiment(trend)}>
              <TrendIcon size={14} aria-hidden="true" />
              <span className="sr-only">{TREND_WORDS[trend.direction]} </span>
              {trend.value}
            </span>
          ) : null}
          {trend?.label ? <span>{trend.label}</span> : null}
          {hint ? <span>{hint}</span> : null}
          {href ? (
            <ArrowLink to={href} className="stat-card-link">
              {linkLabel ?? 'View details'}
              <span className="sr-only">: {label}</span>
            </ArrowLink>
          ) : null}
        </dd>
      ) : null}
    </div>
  );
};

export interface StatCardGridProps {
  children: React.ReactNode;
  /** Accessible name for the group of figures. */
  label?: string;
  className?: string;
}

/** Responsive grid of <StatCard>s: 1 column at 375px, up to 4 on wide screens. */
export const StatCardGrid: React.FC<StatCardGridProps> = ({ children, label, className }) => {
  const grid = (
    <dl className={['stat-grid', className ?? ''].filter(Boolean).join(' ')}>{children}</dl>
  );
  // A bare <dl> has no role that reliably exposes aria-label, so name a group around it.
  return label ? (
    <div role="group" aria-label={label}>
      {grid}
    </div>
  ) : (
    grid
  );
};
