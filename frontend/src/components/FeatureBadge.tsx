import React from 'react';
import { useTranslation } from 'react-i18next';
import { Sparkles, Clock, Zap, Rocket } from 'lucide-react';

export type FeatureBadgeVariant =
  | 'new'
  | 'coming-soon'
  | 'beta'
  | 'in-progress';

export interface FeatureBadgeProps {
  /** Variant determines semantic styling, color token and default label */
  variant?: FeatureBadgeVariant;
  /** Custom text label override */
  label?: string;
  /** Size of the pill badge */
  size?: 'sm' | 'md' | 'lg';
  /** Whether to display a micro indicator dot */
  dot?: boolean;
  /** Whether the indicator dot should pulse */
  pulse?: boolean;
  /** Custom icon override */
  icon?: React.ReactNode;
  /** Additional CSS class names */
  className?: string;
  /** Custom children element */
  children?: React.ReactNode;
}

// Maps each variant to the mainnet-readiness brand tokens (see frontend/src/index.css)
// 'new': Teal accent (--accent2) for freshly shipped capabilities
// 'coming-soon': Bright blue accent (--accent3) for upcoming features
// 'beta': Deep blue primary (--accent) for preview features
// 'in-progress': Amber status token (--status-pending) for active builds
const variantTokens: Record<FeatureBadgeVariant, { token: string; defaultLabelKey: string; defaultText: string }> = {
  new: {
    token: '--accent2',
    defaultLabelKey: 'featureBadge.new',
    defaultText: 'New',
  },
  'coming-soon': {
    token: '--accent3',
    defaultLabelKey: 'featureBadge.comingSoon',
    defaultText: 'Coming Soon',
  },
  beta: {
    token: '--accent',
    defaultLabelKey: 'featureBadge.beta',
    defaultText: 'Beta',
  },
  'in-progress': {
    token: '--status-pending',
    defaultLabelKey: 'featureBadge.inProgress',
    defaultText: 'In Progress',
  },
};

const defaultIcons: Record<FeatureBadgeVariant, React.ReactNode> = {
  new: <Sparkles className="w-3 h-3 shrink-0" aria-hidden="true" />,
  'coming-soon': <Clock className="w-3 h-3 shrink-0" aria-hidden="true" />,
  beta: <Zap className="w-3 h-3 shrink-0" aria-hidden="true" />,
  'in-progress': <Rocket className="w-3 h-3 shrink-0" aria-hidden="true" />,
};

const sizeStyles: Record<'sm' | 'md' | 'lg', string> = {
  sm: 'text-[10px] px-2.5 py-0.5 gap-1.5',
  md: 'text-xs px-3 py-1 gap-2',
  lg: 'text-sm px-3.5 py-1.5 gap-2.5',
};

/**
 * FeatureBadge Component
 *
 * A pill-shaped badge component for flagging in-progress, beta, or newly shipped
 * features across the PayD workforce platform.
 *
 * Adheres to the myworkpay.com-inspired mainnet design tokens:
 * - Rounded pill silhouette (`var(--radius-pill)`)
 * - Deep blue / teal / bright-blue semantic tokens with dark & light mode parity
 * - High contrast WCAG AA compliant text on dynamic translucent surfaces
 * - Full ARIA support (`role="status"` and accessible labeling)
 */
export const FeatureBadge: React.FC<FeatureBadgeProps> = ({
  variant = 'new',
  label,
  size = 'sm',
  dot = true,
  pulse = false,
  icon,
  className = '',
  children,
}) => {
  const { t } = useTranslation();
  const config = variantTokens[variant] || variantTokens.new;
  const colorToken = `var(${config.token})`;
  const displayLabel = children || label || t(config.defaultLabelKey, config.defaultText);
  const resolvedIcon = icon !== undefined ? icon : dot ? null : defaultIcons[variant];

  return (
    <span
      role="status"
      aria-label={typeof displayLabel === 'string' ? displayLabel : t(config.defaultLabelKey, config.defaultText)}
      className={`inline-flex items-center font-bold uppercase tracking-wider rounded-full border transition-colors select-none ${sizeStyles[size]} ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${colorToken} 12%, transparent)`,
        borderColor: `color-mix(in srgb, ${colorToken} 28%, transparent)`,
        color: colorToken,
      }}
    >
      {dot && (
        <span
          className={`w-1.5 h-1.5 rounded-full shrink-0 ${pulse ? 'animate-pulse' : ''}`}
          style={{ backgroundColor: colorToken }}
          aria-hidden="true"
        />
      )}
      {resolvedIcon}
      <span>{displayLabel}</span>
    </span>
  );
};

export default FeatureBadge;
