import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Clock, AlertCircle, XCircle, Loader2 } from 'lucide-react';

export type StatusBadgeVariant =
  | 'success'
  | 'pending'
  | 'warning'
  | 'error'
  | 'loading'
  | 'neutral';

export interface StatusBadgeProps {
  variant: StatusBadgeVariant;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

// Each variant maps to a --status-* semantic token (see index.css), not a
// hardcoded Tailwind palette color -- this is the token/system this
// component exists to demonstrate (#1350): status colors now come from one
// theme-aware source instead of being redeclared per-component, and stay
// in sync with dark/light mode and any future brand re-theming for free.
const variantToken: Record<StatusBadgeVariant, string> = {
  success: '--status-success',
  pending: '--status-pending',
  warning: '--status-warning',
  error: '--status-error',
  loading: '--status-loading',
  neutral: '--status-neutral',
};

const sizeStyles = {
  sm: 'text-xs px-2 py-1 gap-1',
  md: 'text-sm px-2.5 py-1.5 gap-1.5',
  lg: 'text-sm px-3 py-2 gap-2',
};

const iconMap: Record<StatusBadgeVariant, React.ReactNode> = {
  success: <Check size={16} />,
  pending: <Clock size={16} />,
  warning: <AlertCircle size={16} />,
  error: <XCircle size={16} />,
  loading: <Loader2 size={16} className="animate-spin" />,
  neutral: <div className="h-4 w-4 rounded-full bg-current/50" />,
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant,
  label,
  size = 'md',
  className = '',
}) => {
  const { t } = useTranslation();
  const sizeClass = sizeStyles[size];
  const token = `var(${variantToken[variant]})`;

  return (
    <div
      className={`inline-flex items-center rounded-lg border ${sizeClass} ${className}`}
      style={{
        backgroundColor: `color-mix(in srgb, ${token} 15%, transparent)`,
        color: token,
        borderColor: `color-mix(in srgb, ${token} 30%, transparent)`,
      }}
      role="status"
      aria-label={t('common.statusAriaLabel', { label })}
    >
      {iconMap[variant]}
      <span className="font-medium">{label}</span>
    </div>
  );
};
